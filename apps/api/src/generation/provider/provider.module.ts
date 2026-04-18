import { Module } from "@nestjs/common";
import { LLM_PROVIDER } from "../interfaces/llm-provider.interface.js";
import { OpenRouterProvider } from "./openrouter.provider.js";

@Module({
  providers: [
    OpenRouterProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: OpenRouterProvider,
    },
  ],
  exports: [LLM_PROVIDER, OpenRouterProvider],
})
export class ProviderModule {}
