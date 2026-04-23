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

export type ToolLifecycleEvent =
  | { type: "tool-call-start"; id: string; name: string; args: unknown }
  | { type: "tool-call-end"; id: string };

export interface GenerateAgentStreamHandles extends GenerateStreamHandles {
  /**
   * Resolves AFTER the stream is exhausted with the chunks the agent actually
   * retrieved via tool calls during the turn, in first-sighting order. The
   * numeric `id` used in [N] markers matches `collectedChunks[id-1]`.
   */
  collectedChunks: Promise<ScoredChunk[]>;
  /**
   * Tool lifecycle events (start/end) surfaced live so the UI can render a
   * "🔍 searching…" pill while the tool is running. Interleaves with
   * `textStream` — consumers should multiplex both or poll this separately.
   */
  toolEvents: AsyncIterable<ToolLifecycleEvent>;
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
        .map((m) => ({
          role: m.role,
          content: m.role === "assistant" ? stripCitationMarkers(m.content) : m.content,
        })),
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
        .map((m) => ({
          role: m.role,
          content: m.role === "assistant" ? stripCitationMarkers(m.content) : m.content,
        })),
      { role: "user", content: input.userMessage },
    ];

    const collected: ScoredChunk[] = [];
    const tools = {
      searchDocuments: this.searchTool.build(collected),
      getDocumentSummary: this.summaryTool.build(collected),
    };

    // Hard timeout so a stalled provider surfaces as a clean error event
    // instead of hanging the SSE connection until the browser gives up.
    const abortCtrl = new AbortController();
    const timeoutMs = 60_000;
    const timeoutId = setTimeout(() => abortCtrl.abort(new Error(`agent streamText timed out after ${timeoutMs}ms`)), timeoutMs);

    let capturedError: unknown = null;
    const result = streamText({
      model: this.provider.agentModel(),
      system,
      messages,
      tools,
      maxSteps: this.config.env.AGENT_MAX_STEPS,
      abortSignal: abortCtrl.signal,
      onError: ({ error }) => {
        this.logger.error(`agent streamText failed: ${error instanceof Error ? error.message : String(error)}`);
        capturedError = error;
      },
    });

    // Two channels fan out from the one `fullStream` loop: text deltas go to
    // the consumer that streams tokens to SSE, tool lifecycle events go to a
    // separate consumer that can render live "🔍 searching…" badges. Both
    // close when fullStream finishes. Consumers MUST drain both iterables
    // (Promise.all) to avoid one blocking the other.
    const textChannel = createAsyncChannel<string>();
    const toolChannel = createAsyncChannel<ToolLifecycleEvent>();

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

    let accumulated = "";
    const self = this;
    // Background pump: consume fullStream exactly once, fan out to both
    // channels. We kick it off eagerly here (not inside a generator) so tool
    // events flow even before the caller starts iterating the text stream.
    void (async () => {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            accumulated += part.textDelta;
            textChannel.push(part.textDelta);
          } else if (part.type === "tool-call") {
            self.logger.log(`tool-call: ${part.toolName}(${JSON.stringify(part.args)})`);
            toolChannel.push({
              type: "tool-call-start",
              id: part.toolCallId,
              name: part.toolName,
              args: part.args,
            });
          } else if (part.type === "tool-result") {
            toolChannel.push({ type: "tool-call-end", id: part.toolCallId });
          } else if (part.type === "error") {
            self.logger.error(`fullStream error part: ${JSON.stringify(part.error)}`);
          } else if (part.type === "finish") {
            self.logger.log(`fullStream finish: reason=${part.finishReason}`);
          } else {
            self.logger.debug(`fullStream part: ${part.type}`);
          }
        }
        textChannel.close();
        toolChannel.close();
        if (capturedError) throw capturedError;
        if (accumulated.length === 0) {
          throw new Error("Agent produced no tokens (empty model response)");
        }
        self.logger.log(`Agent turn complete: ${collected.length} chunk(s) retrieved across tool calls`);
        resolveChunks(collected);
        const block = await self.extractCitations(accumulated, collected);
        resolveCitations(block);
      } catch (err) {
        textChannel.fail(err);
        toolChannel.fail(err);
        rejectChunks(err);
        rejectCitations(err);
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    return { textStream: textChannel.iter, citations, collectedChunks, toolEvents: toolChannel.iter };
  }

  /**
   * Build the structured citations block via `generateObject`. Required by the
   * spec: citations are emitted as a typed payload AFTER the streamed answer.
   * If the model returns malformed JSON we fall through to a deterministic
   * regex-based extraction over the answer's `[N]` markers so the turn never
   * fails on a structured-output hiccup.
   */
  private async extractCitations(answer: string, chunks: ScoredChunk[]): Promise<CitationsBlock> {
    if (!/\[\d+\]/.test(answer) || chunks.length === 0) {
      return { citations: [] };
    }

    const sources = formatRetrievedContext(chunks);
    const prompt = await this.prompts.load("system", "citations", { answer, sources });

    try {
      const { object } = await generateObject({
        model: this.provider.chatModel(),
        schema: CitationsBlockSchema,
        prompt,
        mode: "json",
      });
      return object;
    } catch (err) {
      const e = err as Error & { text?: string };
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
 * Strip ``` fences and surrounding prose, then JSON.parse the inner body.
 * Some models (gemma4 in particular) wrap structured output in markdown
 * fences despite instructions; this lets us recover before falling through
 * to deterministic regex extraction.
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
 * Minimal single-producer/single-consumer async channel with backpressure-free
 * buffering. Used to fan `streamText`'s `fullStream` out to two consumers
 * (token SSE + tool-event SSE) without double-iterating the upstream.
 */
function createAsyncChannel<T>(): {
  push: (value: T) => void;
  close: () => void;
  fail: (err: unknown) => void;
  iter: AsyncIterable<T>;
} {
  const buffer: T[] = [];
  const waiters: Array<(v: IteratorResult<T, undefined>) => void> = [];
  let closed = false;
  let error: unknown = null;

  const push = (value: T): void => {
    if (closed) return;
    const waiter = waiters.shift();
    if (waiter) waiter({ value, done: false });
    else buffer.push(value);
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    while (waiters.length > 0) waiters.shift()!({ value: undefined, done: true });
  };
  const fail = (err: unknown): void => {
    if (closed) return;
    error = err;
    closed = true;
    while (waiters.length > 0) waiters.shift()!({ value: undefined, done: true });
  };

  const iter: AsyncIterable<T> = {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T, undefined>> {
          if (error) return Promise.reject(error);
          if (buffer.length > 0) return Promise.resolve({ value: buffer.shift()!, done: false });
          if (closed) return Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve) => waiters.push(resolve));
        },
      };
    },
  };

  return { push, close, fail, iter };
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
 * Strip inline `[N]` citation markers from a previous assistant turn before
 * replaying it as history. The numbers refer to chunks that were collected
 * in that earlier turn and have no meaning in the new turn's context — and
 * they're pure token noise to the model.
 */
function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Deterministic citation builder from inline `[N]` markers. Used as a
 * fallback when `generateObject` fails or returns malformed JSON — keeps
 * the turn resilient instead of failing the whole stream.
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
