import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { ChatMessage, ChatRequest, ChatStreamEvent, ScoredChunk } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { SessionService } from "../session/session.service.js";
import { RetrievalService } from "../retrieval/retrieval.service.js";
import { GenerationService } from "../generation/generation.service.js";
import { QueryRewriterService } from "../generation/query-rewriter/query-rewriter.service.js";

/**
 * Orchestrates one chat turn end-to-end:
 *   1. Load session history (sliding window).
 *   2. Retrieve top-K chunks (hybrid search + rerank).
 *   3. Stream SSE events on `reply.raw`: retrieved → token* → citations → done.
 *   4. Persist the turn to session memory after the stream closes.
 *
 * Errors mid-stream are surfaced as an `error` SSE event so the client can
 * render a toast without a broken connection. Query rewriting and tool-use
 * land in Phase 6 behind their feature flags.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(QueryRewriterService) private readonly rewriter: QueryRewriterService,
  ) {}

  async handle(body: ChatRequest, reply: FastifyReply): Promise<void> {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: ChatStreamEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let fullAnswer = "";
    try {
      const history = await this.sessions.getWindow(body.sessionId);
      const retrievalQuery = await this.rewriter.rewrite(body.message, history);
      const chunks = await this.retrieval.retrieve({ query: retrievalQuery });

      send({ type: "retrieved", chunks: chunks.map(toRetrievedPayload) });

      if (chunks.length === 0) {
        const apology = "I don't have information about that in the current corpus.";
        send({ type: "token", delta: apology });
        send({ type: "citations", citations: [] });
        send({ type: "done" });
        await this.persistTurn(body.sessionId, body.message, apology);
        return;
      }

      const { textStream, citations } = await this.generation.generateStream({
        userMessage: body.message,
        history,
        retrievedChunks: chunks,
        userName: "there",
        collectionName: this.config.env.WEAVIATE_COLLECTION,
      });

      for await (const delta of textStream) {
        fullAnswer += delta;
        send({ type: "token", delta });
      }

      const block = await citations;
      send({ type: "citations", citations: block.citations });
      send({ type: "done" });

      await this.persistTurn(body.sessionId, body.message, fullAnswer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(`Chat turn failed: ${message}`);
      send({ type: "error", message, recoverable: false });
    } finally {
      reply.raw.end();
    }
  }

  private async persistTurn(sessionId: string, userMessage: string, assistantMessage: string): Promise<void> {
    const now = new Date().toISOString();
    const messages: ChatMessage[] = [
      { role: "user", content: userMessage, createdAt: now },
      { role: "assistant", content: assistantMessage, createdAt: now },
    ];
    await this.sessions.append(sessionId, messages);
  }
}

function toRetrievedPayload(chunk: ScoredChunk): {
  id: string;
  sourceTitle: string;
  sourceType: string;
  excerpt: string;
  score: number;
} {
  return {
    id: chunk.id,
    sourceTitle: chunk.sourceTitle,
    sourceType: chunk.sourceType,
    excerpt: chunk.text.length > 280 ? `${chunk.text.slice(0, 280)}…` : chunk.text,
    score: chunk.score,
  };
}
