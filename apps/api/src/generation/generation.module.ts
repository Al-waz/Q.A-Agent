import { Module } from "@nestjs/common";
import { ProviderModule } from "./provider/provider.module.js";
import { GenerationService } from "./generation.service.js";
import { QueryRewriterService } from "./query-rewriter/query-rewriter.service.js";

@Module({
  imports: [ProviderModule],
  providers: [GenerationService, QueryRewriterService],
  exports: [GenerationService, QueryRewriterService, ProviderModule],
})
export class GenerationModule {}
