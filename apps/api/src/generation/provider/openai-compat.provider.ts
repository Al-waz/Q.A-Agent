import { Inject, Injectable } from "@nestjs/common";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { ConfigService } from "../../common/config/config.service.js";
import type { ILLMProvider } from "../interfaces/llm-provider.interface.js";

/**
 * OpenAI-compatible LLM provider. Works with any service that implements the
 * OpenAI chat-completions spec — we default to Ollama Cloud, but swapping to
 * OpenRouter, direct OpenAI, Groq, Together, or a local Ollama is a single
 * env change (`LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL`). The rest of the
 * codebase depends only on the `ILLMProvider` interface, so providers can be
 * subclassed here without touching callers.
 */
@Injectable()
export class OpenAICompatProvider implements ILLMProvider {
  private readonly client: ReturnType<typeof createOpenAI>;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.client = createOpenAI({
      apiKey: this.config.env.LLM_API_KEY,
      baseURL: this.config.env.LLM_BASE_URL,
      compatibility: "compatible",
    });
  }

  chatModel(): LanguageModelV1 {
    return this.client(this.config.env.LLM_MODEL);
  }

  judgeModel(): LanguageModelV1 {
    return this.client(this.config.env.JUDGE_MODEL);
  }

  utilityModel(): LanguageModelV1 {
    // Same model as chat for now; Phase 6 may swap to a smaller/faster variant
    // for query-rewriting latency.
    return this.client(this.config.env.LLM_MODEL);
  }
}
