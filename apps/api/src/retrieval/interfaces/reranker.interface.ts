import type { ScoredChunk } from "@qa/schemas";

export const RERANKER = Symbol("IReranker");

export interface IReranker {
  /**
   * Re-score and re-order candidate chunks against the query. Implementations
   * should return the top `topK` items. Input order is NOT preserved.
   */
  rerank(query: string, candidates: ScoredChunk[], topK: number): Promise<ScoredChunk[]>;
}
