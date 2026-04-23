import { z } from "zod";
import { CitationSchema } from "./citation.schema.js";

export const ChatRoleSchema = z.enum(["system", "user", "assistant"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
  createdAt: z.string().datetime().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1, "message cannot be empty").max(4000),
  sessionId: z.string().min(1).max(128),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

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
    chunks: z.array(
      z.object({
        id: z.string(),
        sourceTitle: z.string(),
        sourceType: z.string(),
        excerpt: z.string(),
        score: z.number(),
      }),
    ),
  }),
  /**
   * Agent-mode only. Emitted when the model invokes a tool so the UI can show
   * a live "🔍 searching…" badge. `id` is the AI SDK's `toolCallId`, used to
   * match the later `tool-call-end` event.
   */
  z.object({
    type: z.literal("tool-call-start"),
    id: z.string(),
    name: z.string(),
    args: z.unknown(),
  }),
  z.object({ type: z.literal("tool-call-end"), id: z.string() }),
  /**
   * Emitted after the last `token` and before `citations`. Lets the client
   * drop the typing cursor immediately instead of waiting for citation
   * extraction (which can add a second or two).
   */
  z.object({ type: z.literal("text-end") }),
  z.object({ type: z.literal("error"), message: z.string(), recoverable: z.boolean() }),
  z.object({ type: z.literal("done") }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
