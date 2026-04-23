import { Inject, Injectable, Logger } from "@nestjs/common";
import { streamText, type CoreMessage } from "ai";
import {
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
        resolveCitations(fallbackCitations(accumulated, input.retrievedChunks));
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
        resolveCitations(fallbackCitations(accumulated, collected));
      } catch (err) {
        textChannel.fail(err);
        toolChannel.fail(err);
        rejectChunks(err);
        rejectCitations(err);
      }
    })();

    return { textStream: textChannel.iter, citations, collectedChunks, toolEvents: toolChannel.iter };
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
 * Build the citation block directly from the inline `[N]` markers the model
 * wrote. Runs synchronously — no extra LLM call — so the UI can mount
 * clickable citation pills the moment tokens finish streaming.
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
