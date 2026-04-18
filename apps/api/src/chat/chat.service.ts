import { Injectable, Logger } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { ChatRequest } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { SessionService } from "../session/session.service.js";
import { RetrievalService } from "../retrieval/retrieval.service.js";
import { GenerationService } from "../generation/generation.service.js";
import { QueryRewriterService } from "../generation/query-rewriter/query-rewriter.service.js";

/**
 * Orchestrates a single chat turn:
 *   1. Load session history (sliding window).
 *   2. (Bonus) Rewrite query with history for a standalone retrieval query.
 *   3. Retrieve top-K via hybrid search + optional rerank.
 *   4. Build prompt and stream generation.
 *   5. Emit SSE events on FastifyReply.raw: retrieved → token* → citations → done.
 *   6. Persist the turn to session memory.
 *
 * Phase 3 implements steps 3–5 (vector retrieval, generation, citations).
 * Phase 4 layers on session + prompts polish + mid-stream error handling.
 * Phase 6 turns on query rewriting, reranking, hybrid search, tool use.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly retrieval: RetrievalService,
    private readonly generation: GenerationService,
    private readonly queryRewriter: QueryRewriterService,
  ) {}

  handle(_body: ChatRequest, _reply: FastifyReply): Promise<void> {
    throw new Error("ChatService.handle not implemented (Phase 3)");
  }
}
