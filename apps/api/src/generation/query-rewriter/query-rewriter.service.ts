import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ChatMessage } from "@qa/schemas";
import { ConfigService } from "../../common/config/config.service.js";
import { PromptLoaderService } from "../../prompts/prompt-loader.service.js";
import { LLM_PROVIDER, type ILLMProvider } from "../interfaces/llm-provider.interface.js";

/**
 * Rewrites a user message into a self-contained search query using
 * conversation history. Feature-flagged by ENABLE_QUERY_REWRITING.
 * Phase 6.
 */
@Injectable()
export class QueryRewriterService {
  private readonly logger = new Logger(QueryRewriterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prompts: PromptLoaderService,
    @Inject(LLM_PROVIDER) private readonly provider: ILLMProvider,
  ) {}

  rewrite(_message: string, _history: ChatMessage[]): Promise<string> {
    throw new Error("QueryRewriterService.rewrite not implemented (Phase 6)");
  }
}
