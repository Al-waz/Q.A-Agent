import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { ChatMessage, ChatRequest, ChatStreamEvent, ScoredChunk } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { SessionService } from "../session/session.service.js";
import { RetrievalService } from "../retrieval/retrieval.service.js";
import { GenerationService } from "../generation/generation.service.js";
import { QueryRewriterService } from "../generation/query-rewriter/query-rewriter.service.js";

/**
 * Orchestrates one chat turn end-to-end. Two paths, chosen by ENABLE_TOOL_USE:
 *   - RAG (default): rewrite → retrieve → stream → cite.
 *   - Agent: streamText with tools (searchDocuments, getDocumentSummary) up
 *     to AGENT_MAX_STEPS rounds; retrieval happens inside tool calls.
 *
 * Both paths emit the same SSE events (retrieved → token* → citations → done)
 * so the client renders identically. Errors mid-stream surface as an `error`
 * event; the turn is persisted to session memory after the stream closes.
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

    try {
      const history = await this.sessions.getWindow(body.sessionId);
      const fullAnswer = this.config.env.ENABLE_TOOL_USE
        ? await this.handleAgent(body, history, send)
        : await this.handleRag(body, history, send);
      await this.persistTurn(body.sessionId, body.message, fullAnswer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(`Chat turn failed: ${message}`);
      send({ type: "error", message, recoverable: false });
    } finally {
      reply.raw.end();
    }
  }

  /**
   * Classic RAG path (ENABLE_TOOL_USE=false). Pre-retrieve, stream, cite.
   */
  private async handleRag(
    body: ChatRequest,
    history: ChatMessage[],
    send: (event: ChatStreamEvent) => void,
  ): Promise<string> {
    const retrievalQuery = await this.rewriter.rewrite(body.message, history);
    const chunks = await this.retrieval.retrieve({ query: retrievalQuery });

    send({ type: "retrieved", chunks: chunks.map(toRetrievedPayload) });

    if (chunks.length === 0) {
      const apology = "I don't have information about that in the current corpus.";
      send({ type: "token", delta: apology });
      send({ type: "citations", citations: [] });
      send({ type: "done" });
      return apology;
    }

    const { textStream, citations } = await this.generation.generateStream({
      userMessage: body.message,
      history,
      retrievedChunks: chunks,
      userName: "there",
      collectionName: this.config.env.WEAVIATE_COLLECTION,
    });

    let fullAnswer = "";
    for await (const delta of textStream) {
      fullAnswer += delta;
      send({ type: "token", delta });
    }

    const block = await citations;
    send({ type: "citations", citations: block.citations });
    send({ type: "done" });
    return fullAnswer;
  }

  /**
   * Agent path (ENABLE_TOOL_USE=true). No pre-retrieval — the agent drives
   * search via tools. Retrieved chunks are emitted AFTER the stream drains so
   * the UI still gets them for the debug drawer, just later than in RAG mode.
   */
  private async handleAgent(
    body: ChatRequest,
    history: ChatMessage[],
    send: (event: ChatStreamEvent) => void,
  ): Promise<string> {
    const { textStream, citations, collectedChunks } = await this.generation.generateAgentStream({
      userMessage: body.message,
      history,
      userName: "there",
      collectionName: this.config.env.WEAVIATE_COLLECTION,
    });

    let fullAnswer = "";
    for await (const delta of textStream) {
      fullAnswer += delta;
      send({ type: "token", delta });
    }

    const chunks = await collectedChunks;
    send({ type: "retrieved", chunks: chunks.map(toRetrievedPayload) });
    const block = await citations;
    send({ type: "citations", citations: block.citations });
    send({ type: "done" });
    return fullAnswer;
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
