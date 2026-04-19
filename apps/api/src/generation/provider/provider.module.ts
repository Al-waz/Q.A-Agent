import { Module } from "@nestjs/common";
import { LLM_PROVIDER } from "../interfaces/llm-provider.interface.js";
import { OpenAICompatProvider } from "./openai-compat.provider.js";

@Module({
  providers: [
    OpenAICompatProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: OpenAICompatProvider,
    },
  ],
  exports: [LLM_PROVIDER, OpenAICompatProvider],
})
export class ProviderModule {}
