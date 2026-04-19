import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../../common/config/config.service.js";
import type { IReranker } from "../interfaces/reranker.interface.js";
import type { ScoredChunk } from "@qa/schemas";

/**
 * Jina AI reranker (jina-reranker-v2-base-multilingual by default). A
 * cross-encoder that scores each (query, chunk) pair jointly instead of
 * comparing pooled embeddings — that's what makes it better than the
 * bi-encoder stage at ranking the final top-K. We feed it the vector-store's
 * top-20 candidates and keep top-5.
 *
 * Pool shares the same Jina API key as the embedder; usage is small (~10K
 * tokens per query at topK=20) so we don't need the embedder's TPM throttle.
 */

const JINA_RERANK_ENDPOINT = "https://api.jina.ai/v1/rerank";
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 400;

interface JinaRerankResponse {
  results: Array<{ index: number; relevance_score: number }>;
  usage?: { total_tokens: number };
}

@Injectable()
export class JinaRerankerService implements IReranker {
  private readonly logger = new Logger(JinaRerankerService.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async rerank(query: string, candidates: ScoredChunk[], topK: number): Promise<ScoredChunk[]> {
    if (candidates.length === 0) return [];
    if (candidates.length <= topK && candidates.length === 1) return candidates;

    const body = {
      model: this.config.env.JINA_RERANKER_MODEL,
      query,
      documents: candidates.map((c) => c.text),
      top_n: Math.min(topK, candidates.length),
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(JINA_RERANK_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.env.JINA_API_KEY}`,
          },
          body: JSON.stringify(body),
        });

        if (res.status === 429 || res.status >= 500) {
          throw new RetryableError(`Jina rerank HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
        if (!res.ok) {
          throw new Error(`Jina rerank HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }

        const data = (await res.json()) as JinaRerankResponse;
        return data.results.map((r) => {
          const source = candidates[r.index]!;
          return { ...source, score: r.relevance_score };
        });
      } catch (err) {
        lastError = err as Error;
        if (!(err instanceof RetryableError) || attempt === MAX_RETRIES) throw err;
        const delay = BACKOFF_BASE_MS * 2 ** attempt;
        this.logger.warn(`Jina rerank retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms (${err.message})`);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error("Jina rerank failed");
  }
}

class RetryableError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
