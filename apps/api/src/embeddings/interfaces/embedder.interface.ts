export const EMBEDDER = Symbol("IEmbedder");

export interface IEmbedder {
  /**
   * Embed a single text (e.g. a user query).
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Batch-embed documents. Implementations should handle rate limits and
   * batching internally so callers can pass arbitrarily-sized arrays.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;
}
