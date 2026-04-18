import { z } from "zod";
export declare const ChatRoleSchema: z.ZodEnum<["system", "user", "assistant"]>;
export type ChatRole = z.infer<typeof ChatRoleSchema>;
export declare const ChatMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["system", "user", "assistant"]>;
    content: z.ZodString;
    createdAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: "system" | "user" | "assistant";
    content: string;
    createdAt?: string | undefined;
}, {
    role: "system" | "user" | "assistant";
    content: string;
    createdAt?: string | undefined;
}>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export declare const ChatRequestSchema: z.ZodObject<{
    message: z.ZodString;
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    sessionId: string;
}, {
    message: string;
    sessionId: string;
}>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
/**
 * Discriminated union of server-sent events framed by ChatController into the
 * Fastify response stream. The client decodes each event type and renders
 * accordingly (tokens append to visible message; citations populate footer;
 * errors surface a toast).
 */
export declare const ChatStreamEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"token">;
    delta: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "token";
    delta: string;
}, {
    type: "token";
    delta: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"citations">;
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
    type: "citations";
    citations: {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }[];
}, {
    type: "citations";
    citations: {
        sourceTitle: string;
        id: number;
        excerpt: string;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"retrieved">;
    chunks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceTitle: z.ZodString;
        sourceType: z.ZodString;
        excerpt: z.ZodString;
        score: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sourceTitle: string;
        sourceType: string;
        id: string;
        score: number;
        excerpt: string;
    }, {
        sourceTitle: string;
        sourceType: string;
        id: string;
        score: number;
        excerpt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "retrieved";
    chunks: {
        sourceTitle: string;
        sourceType: string;
        id: string;
        score: number;
        excerpt: string;
    }[];
}, {
    type: "retrieved";
    chunks: {
        sourceTitle: string;
        sourceType: string;
        id: string;
        score: number;
        excerpt: string;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
    message: z.ZodString;
    recoverable: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "error";
    recoverable: boolean;
}, {
    message: string;
    type: "error";
    recoverable: boolean;
}>, z.ZodObject<{
    type: z.ZodLiteral<"done">;
}, "strip", z.ZodTypeAny, {
    type: "done";
}, {
    type: "done";
}>]>;
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
//# sourceMappingURL=chat.schema.d.ts.map