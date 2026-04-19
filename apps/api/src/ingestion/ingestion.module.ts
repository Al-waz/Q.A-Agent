import { Module } from "@nestjs/common";
import { ConfigModule } from "../common/config/config.module.js";
import { EmbeddingsModule } from "../embeddings/embeddings.module.js";
import { RetrievalModule } from "../retrieval/retrieval.module.js";
import { WikiFetcherService } from "./wiki-fetcher.service.js";
import { ChunkerService } from "./chunker.service.js";
import { IngestionService } from "./ingestion.service.js";

/**
 * Pulls in the dependencies the ingestion pipeline needs: ConfigService for
 * chunker hyperparameters, the Jina embedder, and the Weaviate vector store.
 *
 * Not registered in AppModule by default — the runtime API doesn't need
 * ingestion. The `pnpm ingest` script spins up an application context that
 * imports this module directly.
 */
@Module({
  imports: [ConfigModule, EmbeddingsModule, RetrievalModule],
  providers: [WikiFetcherService, ChunkerService, IngestionService],
  exports: [WikiFetcherService, ChunkerService, IngestionService],
})
export class IngestionModule {}
