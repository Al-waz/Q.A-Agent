import { Module } from "@nestjs/common";
import { RERANKER } from "../interfaces/reranker.interface.js";
import { JinaRerankerService } from "./jina-reranker.service.js";

@Module({
  providers: [
    JinaRerankerService,
    {
      provide: RERANKER,
      useExisting: JinaRerankerService,
    },
  ],
  exports: [RERANKER, JinaRerankerService],
})
export class RerankerModule {}
