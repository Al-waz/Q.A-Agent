import { z } from "zod";

/**
 * Spec-mandated citation schema. Do not modify field names or types without
 * updating the take-home brief — both `api` and `web` depend on this exact shape.
 */
export const CitationSchema = z.object({
  id: z.number().int().positive(),
  sourceTitle: z.string().min(1),
  excerpt: z.string().min(1),
});
export type Citation = z.infer<typeof CitationSchema>;

export const CitationsBlockSchema = z.object({
  citations: z.array(CitationSchema),
});
export type CitationsBlock = z.infer<typeof CitationsBlockSchema>;
