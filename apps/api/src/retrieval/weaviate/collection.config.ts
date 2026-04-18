/**
 * Weaviate collection schema for ingested document chunks. Declaring this as
 * plain config keeps the shape visible in source — `ensureCollection()` reads
 * from here rather than embedding schema literals inside the client.
 *
 * The collection stores BOTH dense (named "default") and sparse BM25-style
 * vectors, enabling hybrid search in Phase 6 without schema migration.
 */
export const DOCUMENT_CHUNK_PROPERTIES = [
  { name: "sourceTitle", dataType: "text" as const, indexFilterable: true },
  { name: "sourceType", dataType: "text" as const, indexFilterable: true },
  { name: "chunkIndex", dataType: "int" as const, indexFilterable: true },
  { name: "text", dataType: "text" as const, indexSearchable: true },
] as const;

export type DocumentChunkProperty = (typeof DOCUMENT_CHUNK_PROPERTIES)[number]["name"];
