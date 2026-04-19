import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ScoredChunk } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { JinaEmbedder } from "../embeddings/jina.embedder.js";
import { VECTOR_STORE, type IVectorStore, type SearchOptions } from "./interfaces/vector-store.interface.js";
import { RERANKER, type IReranker } from "./interfaces/reranker.interface.js";

export interface RetrieveOptions {
  query: string;
  topK?: number;
  finalK?: number;
  filter?: SearchOptions["filter"];
}

/**
 * Two-stage retrieval:
 *   1. Embed the query (`retrieval.query` task for asymmetric matching).
 *   2. Weaviate hybrid search (BM25 × vector, alpha from env) for topK
 *      candidates — or pure vector search when ENABLE_HYBRID_SEARCH is off.
 *   3. Jina cross-encoder rerank to finalK — or truncate-by-score when
 *      ENABLE_RERANKER is off.
 *
 * The retrieval stage is intentionally "broad then sharp": the bi-encoder is
 * cheap enough to cast a wide net (top-20), and the cross-encoder reorders the
 * shortlist using full query↔chunk attention, which measurably beats the pooled
 * similarity alone.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(JinaEmbedder) private readonly embedder: JinaEmbedder,
    @Inject(VECTOR_STORE) private readonly vectorStore: IVectorStore,
    @Inject(RERANKER) private readonly reranker: IReranker,
  ) {}

  async retrieve(options: RetrieveOptions): Promise<ScoredChunk[]> {
    const { env } = this.config;
    const topK = options.topK ?? env.RETRIEVAL_TOP_K;
    const finalK = options.finalK ?? env.RETRIEVAL_FINAL_K;
    const query = options.query.trim();
    if (!query) return [];

    const queryVector = await this.embedder.embedQuery(query);

    const searchOptions: SearchOptions = {
      k: topK,
      ...(options.filter ? { filter: options.filter } : {}),
      ...(env.ENABLE_HYBRID_SEARCH ? { alpha: env.HYBRID_ALPHA } : {}),
    };
    const candidates = await this.vectorStore.search(query, queryVector, searchOptions);
    this.logger.log(
      `Retrieved ${candidates.length} candidates (mode=${env.ENABLE_HYBRID_SEARCH ? `hybrid α=${env.HYBRID_ALPHA}` : "vector"})`,
    );

    if (candidates.length === 0) return [];

    if (!env.ENABLE_RERANKER || candidates.length <= finalK) {
      return candidates.slice(0, finalK);
    }

    const reranked = await this.reranker.rerank(query, candidates, finalK);
    this.logger.log(`Reranked to top ${reranked.length} (model=${env.JINA_RERANKER_MODEL})`);
    return reranked;
  }
}
