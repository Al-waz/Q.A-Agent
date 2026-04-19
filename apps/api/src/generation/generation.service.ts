import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateObject, streamText, type CoreMessage } from "ai";
import {
  CitationsBlockSchema,
  type ChatMessage,
  type CitationsBlock,
  type ScoredChunk,
} from "@qa/schemas";
import { PromptLoaderService } from "../prompts/prompt-loader.service.js";
import { LLM_PROVIDER, type ILLMProvider } from "./interfaces/llm-provider.interface.js";

export interface GenerateStreamInput {
  userMessage: string;
  history: ChatMessage[];
  retrievedChunks: ScoredChunk[];
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
    private readonly prompts: PromptLoaderService,
    @Inject(LLM_PROVIDER) private readonly provider: ILLMProvider,
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
      });
      return object;
    } catch (err) {
      // Don't fail the whole turn if structured extraction hiccups — the answer
      // still streamed. Fall back to a deterministic extraction from [N] markers.
      this.logger.warn(`generateObject citations failed, falling back to regex extraction: ${(err as Error).message}`);
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
