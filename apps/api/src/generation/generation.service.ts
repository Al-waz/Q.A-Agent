import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ChatMessage, CitationsBlock, ScoredChunk } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
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
   * citations block produced by `generateObject(CitationSchema)`.
   */
  citations: Promise<CitationsBlock>;
}

/**
 * Owns interaction with the AI SDK:
 *   - `streamText` for the user-visible answer with inline [N] markers.
 *   - `generateObject(CitationSchema)` for the structured citations block.
 *
 * The ChatController is responsible for piping the textStream through
 * FastifyReply.raw and emitting SSE events. This service is transport-agnostic
 * so it can be reused by the eval harness without HTTP plumbing.
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prompts: PromptLoaderService,
    @Inject(LLM_PROVIDER) private readonly provider: ILLMProvider,
  ) {}

  generateStream(_input: GenerateStreamInput): Promise<GenerateStreamHandles> {
    throw new Error("GenerationService.generateStream not implemented (Phase 3)");
  }
}
