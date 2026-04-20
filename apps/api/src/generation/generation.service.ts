import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateObject, streamText, type CoreMessage } from "ai";
import {
  CitationsBlockSchema,
  type ChatMessage,
  type CitationsBlock,
  type ScoredChunk,
} from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { PromptLoaderService } from "../prompts/prompt-loader.service.js";
import { SearchDocumentsTool } from "../tools/search-documents.tool.js";
import { GetDocumentSummaryTool } from "../tools/get-document-summary.tool.js";
import { LLM_PROVIDER, type ILLMProvider } from "./interfaces/llm-provider.interface.js";

export interface GenerateStreamInput {
  userMessage: string;
  history: ChatMessage[];
  retrievedChunks: ScoredChunk[];
  userName: string;
  collectionName: string;
}

export interface GenerateAgentStreamInput {
  userMessage: string;
  history: ChatMessage[];
  userName: string;
  collectionName: string;
}

export interface GenerateStreamHandles {
  /** Async iterable of text deltas (tokens). */
  textStream: AsyncIterable<string>;
  /**
   * Resolves AFTER the text stream is exhausted, with the structured
   * citations block produced by `generateObject(CitationsBlockSchema)`.
   */
  citations: Promise<CitationsBlock>;
}

export interface GenerateAgentStreamHandles extends GenerateStreamHandles {
  /**
   * Resolves AFTER the stream is exhausted with the chunks the agent actually
   * retrieved via tool calls during the turn, in first-sighting order. The
   * numeric `id` used in [N] markers matches `collectedChunks[id-1]`.
   */
  collectedChunks: Promise<ScoredChunk[]>;
}

/**
 * Owns interaction with the AI SDK:
 *   - `streamText` for the user-visible answer with inline [N] markers.
 *   - `generateObject(CitationsBlockSchema)` for the structured citations
 *     block, run once the full answer is available.
 *
 * Transport-agnostic — the ChatController pipes `textStream` into SSE, and the
 * eval harness consumes the same handles without HTTP plumbing.
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PromptLoaderService) private readonly prompts: PromptLoaderService,
    @Inject(LLM_PROVIDER) private readonly provider: ILLMProvider,
    @Inject(SearchDocumentsTool) private readonly searchTool: SearchDocumentsTool,
    @Inject(GetDocumentSummaryTool) private readonly summaryTool: GetDocumentSummaryTool,
  ) {}

  async generateStream(input: GenerateStreamInput): Promise<GenerateStreamHandles> {
    const retrievedContext = formatRetrievedContext(input.retrievedChunks);
    const system = await this.prompts.load("system", "chat", {
      userName: input.userName,
      collectionName: input.collectionName,
      retrievedContext,
    });

    const messages: CoreMessage[] = [
      ...input.history
        .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.userMessage },
    ];

    // AI SDK v4 routes provider errors through `onError` instead of throwing
    // from the `textStream` iterator. We capture into a local and rethrow
    // once the stream drains so the caller (ChatService) can emit an SSE
    // error event instead of silently delivering an empty answer.
    let capturedError: unknown = null;
    const result = streamText({
      model: this.provider.chatModel(),
      system,
      messages,
      onError: ({ error }) => {
        this.logger.error(`streamText failed: ${error instanceof Error ? error.message : String(error)}`);
        capturedError = error;
      },
    });

    let accumulated = "";
    let resolveCitations: (value: CitationsBlock) => void = () => {};
    let rejectCitations: (reason: unknown) => void = () => {};
    const citations = new Promise<CitationsBlock>((resolve, reject) => {
      resolveCitations = resolve;
      rejectCitations = reject;
    });

    const self = this;
    async function* tapped(): AsyncGenerator<string> {
      try {
        for await (const delta of result.textStream) {
          accumulated += delta;
          yield delta;
        }
        if (capturedError) throw capturedError;
        if (accumulated.length === 0) {
          throw new Error("Generation produced no tokens (empty model response)");
        }
        const block = await self.extractCitations(accumulated, input.retrievedChunks);
        resolveCitations(block);
      } catch (err) {
        rejectCitations(err);
        throw err;
      }
    }

    return { textStream: tapped(), citations };
  }

  /**
   * Agentic generation path (ENABLE_TOOL_USE=true). Instead of pre-fetching
   * context and stuffing it into the system prompt, the agent drives retrieval
   * itself via `searchDocuments` + `getDocumentSummary` tools, up to
   * `AGENT_MAX_STEPS` rounds of model↔tool traffic.
   *
   * The tools close over a shared `collectedChunks` array so every chunk the
   * agent sees gets a stable numeric id (first-sighting order), which is the
   * same id the model uses in its `[N]` citation markers. After the stream
   * drains we reuse the existing `extractCitations` path — citations work
   * identically to the non-agent flow.
   */
  async generateAgentStream(input: GenerateAgentStreamInput): Promise<GenerateAgentStreamHandles> {
    const system = await this.prompts.load("system", "agent", {
      userName: input.userName,
      collectionName: input.collectionName,
    });

    const messages: CoreMessage[] = [
      ...input.history
        .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.userMessage },
    ];

    const collected: ScoredChunk[] = [];
    const tools = {
      searchDocuments: this.searchTool.build(collected),
      getDocumentSummary: this.summaryTool.build(collected),
    };

    let capturedError: unknown = null;
    const result = streamText({
      model: this.provider.chatModel(),
      system,
      messages,
      tools,
      maxSteps: this.config.env.AGENT_MAX_STEPS,
      onError: ({ error }) => {
        this.logger.error(`agent streamText failed: ${error instanceof Error ? error.message : String(error)}`);
        capturedError = error;
      },
    });

    let accumulated = "";
    let resolveCitations: (value: CitationsBlock) => void = () => {};
    let rejectCitations: (reason: unknown) => void = () => {};
    const citations = new Promise<CitationsBlock>((resolve, reject) => {
      resolveCitations = resolve;
      rejectCitations = reject;
    });
    let resolveChunks: (value: ScoredChunk[]) => void = () => {};
    let rejectChunks: (reason: unknown) => void = () => {};
    const collectedChunks = new Promise<ScoredChunk[]>((resolve, reject) => {
      resolveChunks = resolve;
      rejectChunks = reject;
    });

    const self = this;
    async function* tapped(): AsyncGenerator<string> {
      try {
        for await (const delta of result.textStream) {
          accumulated += delta;
          yield delta;
        }
        if (capturedError) throw capturedError;
        if (accumulated.length === 0) {
          throw new Error("Agent produced no tokens (empty model response)");
        }
        self.logger.log(`Agent turn complete: ${collected.length} chunk(s) retrieved across tool calls`);
        resolveChunks(collected);
        const block = await self.extractCitations(accumulated, collected);
        resolveCitations(block);
      } catch (err) {
        rejectChunks(err);
        rejectCitations(err);
        throw err;
      }
    }

    return { textStream: tapped(), citations, collectedChunks };
  }

  private async extractCitations(answer: string, chunks: ScoredChunk[]): Promise<CitationsBlock> {
    // Short-circuit: if the answer has no [N] markers, skip the extra LLM call.
    if (!/\[\d+\]/.test(answer) || chunks.length === 0) {
      return { citations: [] };
    }

    const sources = formatRetrievedContext(chunks);
    const system = await this.prompts.load("system", "citations", { answer, sources });

    try {
      const { object } = await generateObject({
        model: this.provider.chatModel(),
        schema: CitationsBlockSchema,
        prompt: system,
        mode: "json",
      });
      return object;
    } catch (err) {
      // Don't fail the whole turn if structured extraction hiccups — the answer
      // still streamed. Try to recover the raw text (gemma4 loves to wrap JSON
      // in markdown fences) before falling back to deterministic regex.
      const e = err as Error & { text?: string; cause?: unknown };
      if (typeof e.text === "string") {
        const recovered = tryParseFencedJson(e.text);
        if (recovered) {
          const parsed = CitationsBlockSchema.safeParse(recovered);
          if (parsed.success) {
            this.logger.log("Recovered citations from fenced JSON in model output");
            return parsed.data;
          }
        }
      }
      this.logger.warn(`generateObject citations failed, falling back to regex extraction: ${e.message}`);
      return fallbackCitations(answer, chunks);
    }
  }
}

/**
 * Serialize retrieved chunks as numbered sources the model can cite:
 *
 *   [1] Apollo 11 — Mission summary
 *   {text}
 *
 *   [2] ...
 */
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
 * Gemma4 (and other chat-tuned models) routinely wrap structured output in
 * ```json fences despite instructions not to. Strip fences + any surrounding
 * prose and try to JSON.parse the inner body. Returns null on any failure —
 * callers fall through to the regex-based deterministic extraction.
 */
function tryParseFencedJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Deterministic citation builder from inline `[N]` markers. Only used when
 * `generateObject` fails — keeps the stream resilient.
 */
function fallbackCitations(answer: string, chunks: ScoredChunk[]): CitationsBlock {
  const ids = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1 && n <= chunks.length) ids.add(n);
  }
  const citations = [...ids].sort((a, b) => a - b).map((id) => {
    const chunk = chunks[id - 1]!;
    return { id, sourceTitle: chunk.sourceTitle, excerpt: chunk.text.slice(0, 240) };
  });
  return { citations };
}
