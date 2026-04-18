import { Injectable } from "@nestjs/common";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { ConfigService } from "../../common/config/config.service.js";
import type { ILLMProvider } from "../interfaces/llm-provider.interface.js";

/**
 * OpenRouter is OpenAI-compatible — the `@ai-sdk/openai` provider works as-is
 * by overriding `baseURL`. This means swapping to direct OpenAI / Ollama / any
 * OpenAI-compatible endpoint is a single env-var change.
 */
@Injectable()
export class OpenRouterProvider implements ILLMProvider {
  private readonly client: ReturnType<typeof createOpenAI>;

  constructor(private readonly config: ConfigService) {
    this.client = createOpenAI({
      apiKey: this.config.env.OPENROUTER_API_KEY,
      baseURL: this.config.env.OPENROUTER_BASE_URL,
      compatibility: "compatible",
    });
  }

  chatModel(): LanguageModelV1 {
    return this.client(this.config.env.OPENROUTER_MODEL);
  }

  judgeModel(): LanguageModelV1 {
    return this.client(this.config.env.JUDGE_MODEL);
  }

  utilityModel(): LanguageModelV1 {
    // Same family for now; Phase 6 may swap to a smaller/faster variant for
    // query-rewriting latency.
    return this.client(this.config.env.OPENROUTER_MODEL);
  }
}
