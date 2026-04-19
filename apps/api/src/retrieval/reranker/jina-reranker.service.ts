import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../../common/config/config.service.js";
import type { IReranker } from "../interfaces/reranker.interface.js";
import type { ScoredChunk } from "@qa/schemas";

/**
 * Jina AI reranker (jina-reranker-v2-base-multilingual by default). Free tier
 * shares the 1M-tokens/month pool with the embedder. Phase 6 implements —
 * feature-flagged by ENABLE_RERANKER so the system degrades gracefully to
 * vector-only retrieval when disabled.
 */
@Injectable()
export class JinaRerankerService implements IReranker {
  private readonly logger = new Logger(JinaRerankerService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  rerank(_query: string, _candidates: ScoredChunk[], _topK: number): Promise<ScoredChunk[]> {
    throw new Error("JinaRerankerService.rerank not implemented (Phase 6)");
  }
}
