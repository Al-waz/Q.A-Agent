import { z } from "zod";
export const SourceTypeSchema = z.enum(["mission", "astronaut", "spacecraft"]);
export const ChunkMetadataSchema = z.object({
    sourceTitle: z.string().min(1),
    sourceType: SourceTypeSchema,
    chunkIndex: z.number().int().nonnegative(),
    text: z.string().min(1),
});
export const ScoredChunkSchema = ChunkMetadataSchema.extend({
    id: z.string(),
    score: z.number(),
});
export const DocumentChunkSchema = ChunkMetadataSchema.extend({
    id: z.string(),
    vector: z.array(z.number()).optional(),
});
//# sourceMappingURL=chunk.schema.js.map