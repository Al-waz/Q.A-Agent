import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../common/config/config.service.js";
import type { EmbedDocumentsOptions, IEmbedder } from "./interfaces/embedder.interface.js";

/**
 * Jina AI embedder. Direct REST calls over fetch — the first-party SDK is
 * optional and just wraps the same endpoint.
 *
 *  - `jina-embeddings-v3` returns 1024-dim vectors by default (matryoshka —
 *    can truncate to 512 / 256 dims if we want smaller stored vectors later).
 *  - Free tier (no card required): 1M tokens / month, ~500 RPM — ample headroom
 *    for the ~50-article corpus and evaluation runs.
 *  - `task` is set to "retrieval.passage" for ingestion and "retrieval.query"
 *    at retrieval time. Jina conditions the embedding model on this hint,
 *    which measurably improves asymmetric retrieval quality.
 */

const JINA_ENDPOINT = "https://api.jina.ai/v1/embeddings";
const BATCH_SIZE = 64;
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 500;

// Jina free tier ceiling is 100K tokens/min — leave headroom so concurrent
// retries don't push us over. A 10s soft window feels snappy yet still gates
// bursty pipelines like ingestion (6 back-to-back batches of ~23K tokens
// each would otherwise trip the server-side limiter).
const TPM_BUDGET = 90_000;
const TPM_WINDOW_MS = 60_000;
// Rough tokens-per-char for English prose. We only use this to *pre-reserve*
// before a request; actual usage from the response replaces the estimate.
const TOKENS_PER_CHAR_ESTIMATE = 0.3;

type JinaTask = "retrieval.passage" | "retrieval.query";

interface JinaEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number; prompt_tokens?: number };
}

@Injectable()
export class JinaEmbedder implements IEmbedder {
  private readonly logger = new Logger(JinaEmbedder.name);
  private readonly usageWindow: Array<{ ts: number; tokens: number }> = [];

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async embedQuery(text: string): Promise<number[]> {
    const [vec] = await this.callJina([text], "retrieval.query");
    if (!vec) throw new Error("Jina returned no embedding for query");
    return vec;
  }

  async embedDocuments(texts: string[], options: EmbedDocumentsOptions = {}): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Late chunking mode: the whole `texts` array has to travel in a single
    // API call so the provider can concatenate + pool across the full context.
    // The caller is responsible for keeping the concat under the model's 8K
    // window; we just honour the contract here.
    if (options.lateChunking) {
      const { vectors, tokens } = await this.callJinaWithUsage(texts, "retrieval.passage", {
        lateChunking: true,
      });
      this.logger.log(`Embedded ${texts.length} chunks via late-chunking (${tokens} tokens)`);
      return vectors;
    }

    const out: number[][] = new Array(texts.length);
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const { vectors, tokens } = await this.callJinaWithUsage(batch, "retrieval.passage");
      vectors.forEach((vec, j) => {
        out[i + j] = vec;
      });
      totalTokens += tokens;
      this.logger.log(`Embedded batch ${i}..${i + batch.length - 1} (${tokens} tokens)`);
    }

    this.logger.log(`Embedded ${texts.length} chunks, total ${totalTokens} tokens`);
    return out;
  }

  private async callJina(input: string[], task: JinaTask): Promise<number[][]> {
    const { vectors } = await this.callJinaWithUsage(input, task);
    return vectors;
  }

  /** Gate the next call so our rolling 60-second token usage stays below the
   *  TPM budget. Uses a heuristic up-front reservation; the response's real
   *  `usage.total_tokens` replaces it. */
  private async reserveBudget(estimatedTokens: number): Promise<void> {
    while (true) {
      const now = Date.now();
      while (this.usageWindow.length > 0 && this.usageWindow[0]!.ts < now - TPM_WINDOW_MS) {
        this.usageWindow.shift();
      }
      const used = this.usageWindow.reduce((s, e) => s + e.tokens, 0);
      if (used + estimatedTokens <= TPM_BUDGET) return;
      const oldest = this.usageWindow[0]!.ts;
      const waitMs = Math.max(250, oldest + TPM_WINDOW_MS - now + 100);
      this.logger.log(
        `Jina TPM gate: ${used}+${estimatedTokens} > ${TPM_BUDGET}, sleeping ${waitMs}ms`,
      );
      await sleep(waitMs);
    }
  }

  private recordUsage(tokens: number): void {
    this.usageWindow.push({ ts: Date.now(), tokens });
  }

  private async callJinaWithUsage(
    input: string[],
    task: JinaTask,
    options: { lateChunking?: boolean } = {},
  ): Promise<{ vectors: number[][]; tokens: number }> {
    const estimated = Math.ceil(
      input.reduce((s, t) => s + t.length, 0) * TOKENS_PER_CHAR_ESTIMATE,
    );
    await this.reserveBudget(estimated);

    const body: Record<string, unknown> = {
      input,
      model: this.config.env.JINA_EMBEDDING_MODEL,
      task,
    };
    if (options.lateChunking) body.late_chunking = true;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(JINA_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.env.JINA_API_KEY}`,
          },
          body: JSON.stringify(body),
        });

        if (res.status === 429 || res.status >= 500) {
          const errBody = await res.text();
          throw new RetryableError(`Jina HTTP ${res.status}: ${errBody.slice(0, 300)}`);
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Jina HTTP ${res.status}: ${text.slice(0, 300)}`);
        }

        const data = (await res.json()) as JinaEmbeddingResponse;
        const vectors = data.data
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
        this.recordUsage(data.usage.total_tokens);
        return { vectors, tokens: data.usage.total_tokens };
      } catch (err) {
        lastError = err as Error;
        if (!(err instanceof RetryableError) || attempt === MAX_RETRIES) {
          throw err;
        }
        const delay = BACKOFF_BASE_MS * 2 ** attempt;
        this.logger.warn(`Jina retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms (${err.message})`);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error("Jina request failed");
  }
}

class RetryableError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
