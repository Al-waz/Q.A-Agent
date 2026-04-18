import type { ChunkMetadata, ScoredChunk } from "@qa/schemas";

export const VECTOR_STORE = Symbol("IVectorStore");

export interface UpsertInput extends ChunkMetadata {
  id: string;
  vector: number[];
}

export interface SearchOptions {
  /** Number of candidates to return. */
  k: number;
  /** Optional metadata filter (e.g. `{ sourceType: "mission" }`). */
  filter?: Partial<Pick<ChunkMetadata, "sourceType" | "sourceTitle">>;
  /**
   * Hybrid search alpha: 0 = keyword (BM25) only, 1 = vector only. When omitted
   * or when the vector store does not support hybrid, pure vector search is
   * used.
   */
  alpha?: number;
}

export interface IVectorStore {
  ensureCollection(): Promise<void>;
  upsert(items: UpsertInput[]): Promise<void>;
  search(query: string, vector: number[], options: SearchOptions): Promise<ScoredChunk[]>;
  count(): Promise<number>;
  reset(): Promise<void>;
}
