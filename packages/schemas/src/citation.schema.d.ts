import { z } from "zod";
/**
 * Spec-mandated citation schema. Do not modify field names or types without
 * updating the take-home brief — both `api` and `web` depend on this exact shape.
 */
export declare const CitationSchema: z.ZodObject<{
    id: z.ZodNumber;
    sourceTitle: z.ZodString;
    excerpt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceTitle: string;
    id: number;
    excerpt: string;
}, {
    sourceTitle: string;
    id: number;
    excerpt: string;
}>;
export type Citation = z.infer<typeof CitationSchema>;
export declare const CitationsBlockSchema: z.ZodObject<{
    citations: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        sourceTitle: z.ZodString;
        excerpt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }, {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    citations: {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }[];
}, {
    citations: {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }[];
}>;
export type CitationsBlock = z.infer<typeof CitationsBlockSchema>;
//# sourceMappingURL=citation.schema.d.ts.map