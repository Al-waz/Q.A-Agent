import { z } from "zod";
import { CitationSchema } from "./citation.schema.js";
export const ChatRoleSchema = z.enum(["system", "user", "assistant"]);
export const ChatMessageSchema = z.object({
    role: ChatRoleSchema,
    content: z.string(),
    createdAt: z.string().datetime().optional(),
});
export const ChatRequestSchema = z.object({
    message: z.string().min(1, "message cannot be empty").max(4000),
    sessionId: z.string().min(1).max(128),
});
/**
 * Discriminated union of server-sent events framed by ChatController into the
 * Fastify response stream. The client decodes each event type and renders
 * accordingly (tokens append to visible message; citations populate footer;
 * errors surface a toast).
 */
export const ChatStreamEventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("token"), delta: z.string() }),
    z.object({ type: z.literal("citations"), citations: z.array(CitationSchema) }),
    z.object({
        type: z.literal("retrieved"),
        chunks: z.array(z.object({
            id: z.string(),
            sourceTitle: z.string(),
            sourceType: z.string(),
            excerpt: z.string(),
            score: z.number(),
        })),
    }),
    z.object({ type: z.literal("error"), message: z.string(), recoverable: z.boolean() }),
    z.object({ type: z.literal("done") }),
]);
//# sourceMappingURL=chat.schema.js.map