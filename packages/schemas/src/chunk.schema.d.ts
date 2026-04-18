import { z } from "zod";
export declare const SourceTypeSchema: z.ZodEnum<["mission", "astronaut", "spacecraft"]>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export declare const ChunkMetadataSchema: z.ZodObject<{
    sourceTitle: z.ZodString;
    sourceType: z.ZodEnum<["mission", "astronaut", "spacecraft"]>;
    chunkIndex: z.ZodNumber;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceTitle: string;
    sourceType: "mission" | "astronaut" | "spacecraft";
    chunkIndex: number;
    text: string;
}, {
    sourceTitle: string;
    sourceType: "mission" | "astronaut" | "spacecraft";
    chunkIndex: number;
    text: string;
}>;
export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;
export declare const ScoredChunkSchema: z.ZodObject<{
    sourceTitle: z.ZodString;
    sourceType: z.ZodEnum<["mission", "astronaut", "spacecraft"]>;
    chunkIndex: z.ZodNumber;
    text: z.ZodString;
} & {
    id: z.ZodString;
    score: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sourceTitle: string;
    sourceType: "mission" | "astronaut" | "spacecraft";
    chunkIndex: number;
    text: string;
    id: string;
    score: number;
}, {
    sourceTitle: string;
    sourceType: "mission" | "astronaut" | "spacecraft";
    chunkIndex: number;
    text: string;
    id: string;
    score: number;
}>;
export type ScoredChunk = z.infer<typeof ScoredChunkSchema>;
export declare const DocumentChunkSchema: z.ZodObject<{
    sourceTitle: z.ZodString;
    sourceType: z.ZodEnum<["mission", "astronaut", "spacecraft"]>;
    chunkIndex: z.ZodNumber;
    text: z.ZodString;
} & {
    id: z.ZodString;
    vector: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    sourceTitle: string;
    sourceType: "mission" | "astronaut" | "spacecraft";
    chunkIndex: number;
    text: string;
    id: string;
    vector?: number[] | undefined;
}, {
    sourceTitle: string;
    sourceType: "mission" | "astronaut" | "spacecraft";
    chunkIndex: number;
    text: string;
    id: string;
    vector?: number[] | undefined;
}>;
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
//# sourceMappingURL=chunk.schema.d.ts.map