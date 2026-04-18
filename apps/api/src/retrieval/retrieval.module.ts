import { Module } from "@nestjs/common";
import { EmbeddingsModule } from "../embeddings/embeddings.module.js";
import { WeaviateModule } from "./weaviate/weaviate.module.js";
import { RerankerModule } from "./reranker/reranker.module.js";
import { RetrievalService } from "./retrieval.service.js";

@Module({
  imports: [EmbeddingsModule, WeaviateModule, RerankerModule],
  providers: [RetrievalService],
  exports: [RetrievalService, WeaviateModule, RerankerModule],
})
export class RetrievalModule {}
