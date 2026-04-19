import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateObject } from "ai";
import { z } from "zod";
import {
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
import { QueryRewriterService } from "../generation/query-rewriter/query-rewriter.service.js";
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
    @Inject(QueryRewriterService) private readonly rewriter: QueryRewriterService,
    @Inject(LLM_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  /**
   * Run one conversational turn end-to-end: retrieve → generate → drain
   * stream → collect citations. Returns timing for the summary report.
   */
  async runTurn(question: string, history: ChatMessage[]): Promise<TurnExecution> {
    const start = Date.now();

    const retrievalQuery = await this.rewriter.rewrite(question, history);
    const retrievedChunks = await this.retrieval.retrieve({ query: retrievalQuery });
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

    // Permissive schema: accept any number for `score`, then clamp to [1,5] in
    // post-processing. Ollama-hosted judges (deepseek-v3.2 in particular)
    // occasionally emit out-of-range scores like -1 even with an explicit 1–5
    // rubric; we'd rather normalize one bad value than abort the whole run.
    const RawJudgeTurnScoreSchema = z.object({
      relevance: z.object({ score: z.number(), reasoning: z.string() }),
      groundedness: z.object({ score: z.number(), reasoning: z.string() }),
    });

    let raw: z.infer<typeof RawJudgeTurnScoreSchema>;
    try {
      const { object } = await generateObject({
        model: this.llm.judgeModel(),
        schema: RawJudgeTurnScoreSchema,
        prompt: system,
        mode: "json",
      });
      raw = object;
    } catch (err) {
      // deepseek-v3.2 occasionally leaks chain-of-thought tokens (often CJK
      // characters like "我们发现5") directly into the score position, breaking
      // JSON.parse. The rest of the payload is usually fine — try to salvage
      // it by scrubbing non-numeric junk from `"score":` values.
      const e = err as Error & { text?: string };
      const recovered = typeof e.text === "string" ? recoverJudgeJson(e.text) : null;
      if (recovered) {
        const parsed = RawJudgeTurnScoreSchema.safeParse(recovered);
        if (parsed.success) {
          this.logger.warn(
            `Judge emitted malformed JSON, recovered by scrubbing non-numeric score tokens: "${truncate(e.message, 120)}"`,
          );
          raw = parsed.data;
        } else {
          this.logger.error(`Judge recovery parsed JSON but failed schema validation: ${parsed.error.message}`);
          throw err;
        }
      } else {
        throw err;
      }
    }

    const normalized: JudgeTurnScore = {
      relevance: {
        score: clampScore(raw.relevance.score, turn.question, "relevance", this.logger),
        reasoning: raw.relevance.reasoning,
      },
      groundedness: {
        score: clampScore(raw.groundedness.score, turn.question, "groundedness", this.logger),
        reasoning: raw.groundedness.reasoning,
      },
    };
    return normalized;
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

/**
 * Recover judge JSON when the model (deepseek-v3.2 is the usual culprit)
 * injects non-JSON tokens right before a numeric score, e.g.:
 *   "score":我们发现5,
 * Strategy: for every `"score":` position, drop any characters up to the first
 * digit/minus so the value is parseable, then try JSON.parse again. Returns
 * null if the scrubbed text still isn't valid JSON.
 */
function recoverJudgeJson(raw: string): unknown | null {
  // Also strip markdown fences in case the model wrapped the object.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const body = fenced?.[1]?.trim() ?? raw.trim();
  const scrubbed = body.replace(/("score"\s*:)\s*[^\-0-9]*?(-?\d+(?:\.\d+)?)/g, "$1 $2");
  try {
    return JSON.parse(scrubbed);
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Coerce a raw judge score into the 1–5 integer range. Out-of-range values
 * (seen: -1, 0) get clamped with a warning so the eval still reports a useful
 * number instead of crashing on Zod validation.
 */
function clampScore(raw: number, question: string, dimension: string, logger: Logger): number {
  const rounded = Math.round(raw);
  if (rounded >= 1 && rounded <= 5) return rounded;
  const clamped = Math.min(5, Math.max(1, rounded));
  logger.warn(
    `Judge emitted out-of-range ${dimension} score ${raw} for "${question.slice(0, 60)}" — clamped to ${clamped}`,
  );
  return clamped;
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
