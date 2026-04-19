import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateObject } from "ai";
import {
  JudgeTurnScoreSchema,
  type Citation,
  type ChatMessage,
  type JudgeTurnScore,
  type ScoredChunk,
  type TestCaseTurn,
} from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { PromptLoaderService } from "../prompts/prompt-loader.service.js";
import { RetrievalService } from "../retrieval/retrieval.service.js";
import { GenerationService } from "../generation/generation.service.js";
import { LLM_PROVIDER, type ILLMProvider } from "../generation/interfaces/llm-provider.interface.js";

export interface TurnExecution {
  retrievedChunks: ScoredChunk[];
  answer: string;
  citations: Citation[];
  latencyMs: number;
}

export interface CitationAccuracyReport {
  hasCitations: boolean;
  allMarkersResolved: boolean;
  excerptsMatchChunks: boolean;
  score: number;
}

/**
 * Phase 5 eval harness. Reuses the exact runtime services the chat endpoint
 * uses (retrieval → generation) so evaluated behavior matches production
 * behavior. Scoring is layered:
 *   - Relevance + Groundedness: LLM-as-judge with a 1–5 anchored rubric
 *     (judge model = different family from the chat model to reduce self-bias).
 *   - Citation accuracy: fully deterministic — marker resolution + excerpt
 *     substring match against retrieved chunk text. No LLM variance there.
 */
@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PromptLoaderService) private readonly prompts: PromptLoaderService,
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(LLM_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  /**
   * Run one conversational turn end-to-end: retrieve → generate → drain
   * stream → collect citations. Returns timing for the summary report.
   */
  async runTurn(question: string, history: ChatMessage[]): Promise<TurnExecution> {
    const start = Date.now();

    const retrievedChunks = await this.retrieval.retrieve({ query: question });
    if (retrievedChunks.length === 0) {
      const latencyMs = Date.now() - start;
      return {
        retrievedChunks: [],
        answer: "I don't have information about that in the current corpus.",
        citations: [],
        latencyMs,
      };
    }

    const { textStream, citations } = await this.generation.generateStream({
      userMessage: question,
      history,
      retrievedChunks,
      userName: "evaluator",
      collectionName: this.config.env.WEAVIATE_COLLECTION,
    });

    let answer = "";
    for await (const delta of textStream) answer += delta;
    const citationBlock = await citations;

    return {
      retrievedChunks,
      answer,
      citations: citationBlock.citations,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Score a single turn on relevance + groundedness in one combined judge
   * call. The judge sees the retrieved context that the chat model had, so it
   * can check groundedness against the *same* evidence.
   */
  async judgeTurn(
    turn: TestCaseTurn,
    execution: TurnExecution,
  ): Promise<JudgeTurnScore> {
    const retrievedContext = formatRetrievedContext(execution.retrievedChunks);
    const system = await this.prompts.load("system", "judge", {
      collectionName: this.config.env.WEAVIATE_COLLECTION,
      question: turn.question,
      expectedBehavior: turn.expectedBehavior,
      retrievedContext,
      answer: execution.answer,
    });

    const { object } = await generateObject({
      model: this.llm.judgeModel(),
      schema: JudgeTurnScoreSchema,
      prompt: system,
      mode: "json",
    });
    return object;
  }

  /**
   * Deterministic citation audit — no LLM, no judge noise. Checks:
   *   1. Did the answer include any `[N]` markers at all?
   *   2. Does every marker resolve to a retrieved chunk (no invented numbers)?
   *   3. Does every cited excerpt actually appear in the referenced chunk's
   *      text? (catches hallucinated excerpts even when the marker is valid.)
   * The composite `score ∈ [0,1]` is the mean of the three boolean checks.
   */
  citationAccuracy(answer: string, citations: Citation[], chunks: ScoredChunk[]): CitationAccuracyReport {
    const markerIds = new Set<number>();
    for (const match of answer.matchAll(/\[(\d+)\]/g)) {
      const n = Number(match[1]);
      if (Number.isInteger(n) && n >= 1) markerIds.add(n);
    }
    const hasCitations = markerIds.size > 0;

    const allMarkersResolved =
      markerIds.size > 0 && [...markerIds].every((id) => id >= 1 && id <= chunks.length);

    const excerptsMatchChunks =
      citations.length === 0 ||
      citations.every((c) => {
        const chunk = chunks[c.id - 1];
        if (!chunk) return false;
        return normalize(chunk.text).includes(normalize(c.excerpt));
      });

    const components = [hasCitations, allMarkersResolved, excerptsMatchChunks];
    const score = components.filter(Boolean).length / components.length;
    return { hasCitations, allMarkersResolved, excerptsMatchChunks, score };
  }
}

function formatRetrievedContext(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) return "(no sources retrieved)";
  return chunks
    .map((c, i) => {
      const header = c.section ? `${c.sourceTitle} — ${c.section}` : c.sourceTitle;
      return `[${i + 1}] ${header}\n${c.text}`;
    })
    .join("\n\n");
}

/**
 * Soft text match: collapse whitespace + lowercase. The cited excerpt is
 * supposed to be a verbatim quote from the chunk, but we don't want a rogue
 * trailing space or casing mismatch to fail an otherwise-correct citation.
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}
