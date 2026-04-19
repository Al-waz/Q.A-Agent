import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ScoredChunk } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { JinaEmbedder } from "../embeddings/jina.embedder.js";
import { VECTOR_STORE, type IVectorStore } from "./interfaces/vector-store.interface.js";
import { RERANKER, type IReranker } from "./interfaces/reranker.interface.js";

export interface RetrieveOptions {
  query: string;
  topK?: number;
  finalK?: number;
  filter?: { sourceType?: string; sourceTitle?: string };
}

/**
 * Orchestrates the two-stage retrieval pipeline:
 *   1. Embed the query (Jina embeddings v3).
 *   2. Hybrid search in Weaviate for topK candidates (default 20).
 *   3. Rerank to finalK (default 5) via Jina reranker v2.
 *
 * Feature flags (ENABLE_HYBRID_SEARCH, ENABLE_RERANKER) degrade this pipeline
 * gracefully to pure vector search if external services are unavailable.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly embedder: JinaEmbedder,
    @Inject(VECTOR_STORE) private readonly vectorStore: IVectorStore,
    @Inject(RERANKER) private readonly reranker: IReranker,
  ) {}

  retrieve(_options: RetrieveOptions): Promise<ScoredChunk[]> {
    throw new Error("RetrievalService.retrieve not implemented (Phase 3; rerank Phase 6)");
  }
}
