import { Module } from "@nestjs/common";
import { ConfigModule } from "../common/config/config.module.js";
import { PromptsModule } from "../prompts/prompts.module.js";
import { RetrievalModule } from "../retrieval/retrieval.module.js";
import { GenerationModule } from "../generation/generation.module.js";
import { EvaluationService } from "./evaluation.service.js";

/**
 * Wraps the runtime services the eval harness needs: retrieval (hybrid search
 * + rerank), generation (streamText + generateObject), the prompt loader, and
 * the LLM provider (for the judge model). Not imported by AppModule — the
 * `pnpm evaluate` script spins up a dedicated application context that
 * imports this module directly, same pattern as ingestion.
 */
@Module({
  imports: [ConfigModule, PromptsModule, RetrievalModule, GenerationModule],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
