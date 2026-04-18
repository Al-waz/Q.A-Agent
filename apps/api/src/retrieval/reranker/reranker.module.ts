import { Module } from "@nestjs/common";
import { RERANKER } from "../interfaces/reranker.interface.js";
import { VoyageRerankerService } from "./voyage-reranker.service.js";

@Module({
  providers: [
    VoyageRerankerService,
    {
      provide: RERANKER,
      useExisting: VoyageRerankerService,
    },
  ],
  exports: [RERANKER, VoyageRerankerService],
})
export class RerankerModule {}
