import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../../common/config/config.service.js";
import type { IReranker } from "../interfaces/reranker.interface.js";
import type { ScoredChunk } from "@qa/schemas";

/**
 * Voyage AI reranker (rerank-2.5-lite by default). 32K context window,
 * instruction-following. Phase 6 implements — feature-flagged by
 * ENABLE_RERANKER so the system degrades gracefully to vector-only retrieval.
 */
@Injectable()
export class VoyageRerankerService implements IReranker {
  private readonly logger = new Logger(VoyageRerankerService.name);

  constructor(private readonly config: ConfigService) {}

  rerank(_query: string, _candidates: ScoredChunk[], _topK: number): Promise<ScoredChunk[]> {
    throw new Error("VoyageRerankerService.rerank not implemented (Phase 6)");
  }
}
