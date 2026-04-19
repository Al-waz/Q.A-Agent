import { Inject, Injectable, Logger } from "@nestjs/common";
import { CORPUS, type CorpusEntry } from "./corpus.manifest.js";
import { ChunkerService } from "./chunker.service.js";
import { WikiFetcherService } from "./wiki-fetcher.service.js";
import { ConfigService } from "../common/config/config.service.js";
import { EMBEDDER, type IEmbedder } from "../embeddings/interfaces/embedder.interface.js";
import { VECTOR_STORE, type IVectorStore, type UpsertInput } from "../retrieval/interfaces/vector-store.interface.js";
import type { ChunkMetadata } from "@qa/schemas";

/**
 * Top-level ingestion orchestrator. For each article:
 *   1. Read the cached corpus file from disk.
 *   2. Semantically chunk it (sentence-level embedding + similarity-based
 *      boundaries + section-aware packing).
 *   3. Build each chunk's embedding input by prepending `[Title — Section]`
 *      — retrieval signal the stored chunk text doesn't carry.
 *   4. Embed the article's chunks in sub-batches that fit Jina's 8K context,
 *      with `late_chunking: true` so vectors benefit from token-level pooling
 *      across the concatenated context.
 *   5. Upsert everything into Weaviate in bounded batches.
 *
 * Late chunking is always done per-article so cross-article context doesn't
 * bleed into an article's chunk vectors.
 */

export interface IngestionOptions {
  /** If true, wipe the Weaviate collection before ingesting. */
  force?: boolean;
  /** Weaviate upsert batch size — keeps memory bounded on large corpora. */
  upsertBatchSize?: number;
}

export interface IngestionReport {
  articles: number;
  chunks: number;
  durationMs: number;
  embeddingDim: number | null;
}

const DEFAULT_UPSERT_BATCH = 64;
const CHARS_PER_TOKEN = 4;
// Leave ~2K tokens of headroom under Jina's 8K window for prefix overhead and
// tokenizer variance. Chunks that exceed this budget fall into smaller sub-batches.
const LATE_CHUNK_TOKEN_BUDGET = 6000;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(WikiFetcherService) private readonly fetcher: WikiFetcherService,
    @Inject(ChunkerService) private readonly chunker: ChunkerService,
    @Inject(EMBEDDER) private readonly embedder: IEmbedder,
    @Inject(VECTOR_STORE) private readonly vectorStore: IVectorStore,
  ) {}

  async run(options: IngestionOptions = {}): Promise<IngestionReport> {
    const start = Date.now();
    const upsertBatchSize = options.upsertBatchSize ?? DEFAULT_UPSERT_BATCH;

    this.logger.log(options.force ? "Resetting collection…" : "Ensuring collection exists…");
    if (options.force) {
      await this.vectorStore.reset();
    } else {
      await this.vectorStore.ensureCollection();
    }

    const ready: UpsertInput[] = [];
    let missing = 0;
    let embeddingDim: number | null = null;

    for (const entry of CORPUS) {
      const article = await this.fetcher.readOne(entry);
      if (!article) {
        missing += 1;
        continue;
      }

      const chunks = await this.chunker.chunk({
        slug: entry.slug,
        title: entry.title,
        category: entry.category,
        body: article.body,
      });
      if (chunks.length === 0) continue;

      const vectors = await this.embedArticleChunks(entry, chunks);
      embeddingDim ??= vectors[0]?.length ?? null;

      chunks.forEach((chunk, i) => {
        ready.push({
          id: stableChunkId(entry, chunk.chunkIndex),
          sourceTitle: chunk.sourceTitle,
          sourceType: chunk.sourceType,
          chunkIndex: chunk.chunkIndex,
          section: chunk.section,
          text: chunk.text,
          vector: vectors[i]!,
        });
      });
    }

    if (missing > 0) {
      this.logger.warn(
        `${missing}/${CORPUS.length} articles missing on disk — run \`pnpm fetch-corpus\` to populate them.`,
      );
    }

    if (ready.length === 0) {
      this.logger.warn("No chunks produced — did you run `pnpm fetch-corpus` first?");
      return { articles: 0, chunks: 0, durationMs: Date.now() - start, embeddingDim };
    }

    for (let i = 0; i < ready.length; i += upsertBatchSize) {
      const batch = ready.slice(i, i + upsertBatchSize);
      await this.vectorStore.upsert(batch);
      this.logger.log(`Upserted batch ${i}..${i + batch.length - 1} (${batch.length} chunks)`);
    }

    const total = await this.vectorStore.count();
    const duration = Date.now() - start;
    const articles = new Set(ready.map((c) => c.sourceTitle)).size;
    this.logger.log(
      `Done. articles=${articles} chunks=${ready.length} collection_total=${total} duration=${duration}ms`,
    );

    this.logSamples(ready);

    return { articles, chunks: ready.length, durationMs: duration, embeddingDim };
  }

  /**
   * Show a few sample chunks at the end so a reviewer can eyeball chunk quality
   * without opening Weaviate — covers section propagation, word-aligned
   * boundaries, and the shape of the stored payload.
   */
  private logSamples(chunks: UpsertInput[]): void {
    if (chunks.length === 0) return;
    const picks = [0, Math.floor(chunks.length / 2), chunks.length - 1]
      .filter((idx, i, arr) => arr.indexOf(idx) === i);
    this.logger.log(`── Sample chunks (${picks.length} of ${chunks.length}) ──`);
    for (const idx of picks) {
      const c = chunks[idx]!;
      const head = c.text.length > 220 ? `${c.text.slice(0, 220)}…` : c.text;
      this.logger.log(
        `[${idx}] ${c.sourceTitle} > ${c.section ?? "(preamble)"} #${c.chunkIndex} dim=${c.vector.length}\n    ${head}`,
      );
    }
  }

  /**
   * Embed one article's chunks, honouring the late-chunking flag. Chunks are
   * grouped into sub-batches whose estimated tokens fit under the Jina context
   * window so `late_chunking: true` gets a full batch of coherent context.
   */
  private async embedArticleChunks(entry: CorpusEntry, chunks: ChunkMetadata[]): Promise<number[][]> {
    const { env } = this.config;
    const inputs = chunks.map((c) => embeddingInput(entry.title, c));
    const useLate = env.JINA_LATE_CHUNKING;

    if (!useLate) {
      return this.embedder.embedDocuments(inputs);
    }

    const vectors: number[][] = [];
    let batch: string[] = [];
    let batchTokens = 0;
    for (const input of inputs) {
      const tokens = Math.ceil(input.length / CHARS_PER_TOKEN);
      if (batch.length > 0 && batchTokens + tokens > LATE_CHUNK_TOKEN_BUDGET) {
        const sub = await this.embedder.embedDocuments(batch, { lateChunking: true });
        vectors.push(...sub);
        batch = [];
        batchTokens = 0;
      }
      batch.push(input);
      batchTokens += tokens;
    }
    if (batch.length > 0) {
      const sub = await this.embedder.embedDocuments(batch, { lateChunking: true });
      vectors.push(...sub);
    }
    return vectors;
  }
}

/**
 * Build the string we actually send to the embedder. The structural prefix
 * ("Apollo 11 — Personnel > Prime crew") gives the embedding a cheap but
 * reliable dose of asymmetric context; the chunk body stays clean for UI
 * display via the separate `section` + `text` properties in Weaviate.
 */
function embeddingInput(title: string, chunk: ChunkMetadata): string {
  const header = chunk.section ? `${title} — ${chunk.section}` : title;
  return `[${header}]\n\n${chunk.text}`;
}

/** `apollo-11#7` — stable across runs so re-ingestion is idempotent. */
function stableChunkId(entry: CorpusEntry, chunkIndex: number): string {
  return `${entry.slug}#${chunkIndex}`;
}
