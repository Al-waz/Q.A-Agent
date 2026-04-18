import { z } from "zod";

export const SourceTypeSchema = z.enum(["mission", "astronaut", "spacecraft"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ChunkMetadataSchema = z.object({
  sourceTitle: z.string().min(1),
  sourceType: SourceTypeSchema,
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1),
});
export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;

export const ScoredChunkSchema = ChunkMetadataSchema.extend({
  id: z.string(),
  score: z.number(),
});
export type ScoredChunk = z.infer<typeof ScoredChunkSchema>;

export const DocumentChunkSchema = ChunkMetadataSchema.extend({
  id: z.string(),
  vector: z.array(z.number()).optional(),
});
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
