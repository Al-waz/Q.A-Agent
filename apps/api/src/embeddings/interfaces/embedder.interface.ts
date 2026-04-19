export const EMBEDDER = Symbol("IEmbedder");

export interface EmbedDocumentsOptions {
  /**
   * When true, the embedder sends the entire `texts` array as a single
   * API call with `late_chunking` enabled (provider-side token-level
   * pooling across the joined context). The caller must keep the total
   * tokens under the model's context window (~8K for Jina v3/v4). When
   * false (default), the embedder batches internally with rate limiting
   * and each text is embedded independently.
   */
  lateChunking?: boolean;
}

export interface IEmbedder {
  /**
   * Embed a single text (e.g. a user query).
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Batch-embed documents. Implementations should handle rate limits and
   * batching internally so callers can pass arbitrarily-sized arrays.
   */
  embedDocuments(texts: string[], options?: EmbedDocumentsOptions): Promise<number[][]>;
}
