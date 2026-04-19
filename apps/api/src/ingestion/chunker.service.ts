import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ChunkMetadata, SourceType } from "@qa/schemas";
import { ConfigService } from "../common/config/config.service.js";
import { EMBEDDER, type IEmbedder } from "../embeddings/interfaces/embedder.interface.js";

/**
 * Semantic, section-aware chunker.
 *
 * Pipeline:
 *   1. Parse the markdown body into section-aware blocks by walking header
 *      levels (`## Background`, `### Prime crew`, …). Each block carries a
 *      dotted section path ("Personnel > Prime crew") plus the prose that
 *      belongs under it.
 *   2. Split each block into sentences.
 *   3. Embed every sentence (one-time cost at ingest — a few thousand tokens
 *      per article, well inside the Jina free-tier budget).
 *   4. Walk the sentence stream and insert a chunk boundary whenever any of:
 *        - the section path changes                 (hard boundary)
 *        - cosine similarity to the last sentence
 *          drops below SEMANTIC_SIMILARITY_THRESHOLD (soft boundary, only if
 *          the current buffer already clears `minChars`)
 *        - adding the sentence would exceed `maxChars` (hard overflow)
 *   5. Apply a small word-aligned overlap within a section so answers that
 *      straddle a boundary aren't lost.
 *
 * Each emitted chunk carries its section path in metadata. The embedding
 * call that stores the chunk vector prepends "[Title — Section]" to the
 * text, so retrieval benefits from the structural signal even though the
 * stored `text` property stays clean for UI display.
 */

const CHARS_PER_TOKEN = 4;

export interface SourceDocument {
  slug: string;
  title: string;
  category: SourceType;
  body: string;
}

interface SectionBlock {
  section: string | null;
  text: string;
}

interface Sentence {
  section: string | null;
  text: string;
}

@Injectable()
export class ChunkerService {
  private readonly logger = new Logger(ChunkerService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(EMBEDDER) private readonly embedder: IEmbedder,
  ) {}

  async chunk(doc: SourceDocument): Promise<ChunkMetadata[]> {
    const { env } = this.config;
    const maxChars = env.CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
    const minChars = Math.max(256, Math.floor(maxChars * 0.4));
    const overlapChars = env.CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;
    const threshold = env.SEMANTIC_SIMILARITY_THRESHOLD;

    const sentences = collectSentences(parseSections(doc.body));
    if (sentences.length === 0) {
      this.logger.warn(`Chunker produced 0 sentences for "${doc.slug}"`);
      return [];
    }

    const embeddings = await this.embedder.embedDocuments(sentences.map((s) => s.text));
    if (embeddings.length !== sentences.length) {
      throw new Error(
        `Sentence-embedding count mismatch for "${doc.slug}": expected ${sentences.length}, got ${embeddings.length}`,
      );
    }

    const chunks: ChunkMetadata[] = [];
    let buf = { section: sentences[0]!.section, text: "" };
    let lastEmbedding: number[] | null = null;
    let chunkIndex = 0;

    const flush = (nextSection: string | null, forceOverlap: boolean) => {
      if (!buf.text.trim()) return;
      chunks.push({
        sourceTitle: doc.title,
        sourceType: doc.category,
        chunkIndex: chunkIndex++,
        section: buf.section,
        text: buf.text.trim(),
      });
      const tail = forceOverlap ? snapToWord(buf.text.slice(-overlapChars)) : "";
      buf = { section: nextSection, text: tail };
    };

    for (let i = 0; i < sentences.length; i++) {
      const { section, text } = sentences[i]!;
      const emb = embeddings[i]!;
      const sectionBreak = buf.text.length > 0 && section !== buf.section;
      const sim = lastEmbedding ? cosine(lastEmbedding, emb) : 1;
      const semanticBreak = buf.text.length >= minChars && sim < threshold;
      const candidateLen = buf.text.length + text.length + 1;
      const overflow = candidateLen > maxChars && buf.text.length > 0;

      if (sectionBreak) {
        flush(section, false); // no overlap across section boundaries
      } else if (overflow || semanticBreak) {
        flush(section, true);
      }

      buf.section = section;
      buf.text = buf.text ? `${buf.text} ${text}`.trim() : text;
      lastEmbedding = emb;
    }
    flush(null, false);

    this.logger.log(
      `Chunked "${doc.slug}": ${sentences.length} sentences → ${chunks.length} chunks`,
    );
    return chunks;
  }
}

/**
 * Walk the markdown body, tracking an H1-H6 stack so each block records the
 * full section path it lives under (`"Personnel > Prime crew"`). Content
 * before the first header gets `section: null` (the article preamble).
 */
function parseSections(body: string): SectionBlock[] {
  const blocks: SectionBlock[] = [];
  const stack: (string | undefined)[] = [];
  let buffer = "";

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      const path = stack.filter((s): s is string => Boolean(s));
      blocks.push({
        section: path.length > 0 ? path.join(" > ") : null,
        text: trimmed,
      });
    }
    buffer = "";
  };

  for (const line of body.split("\n")) {
    const header = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (header) {
      flush();
      const level = header[1]!.length;
      stack.length = level - 1;
      stack[level - 1] = header[2]!;
    } else {
      buffer += line + "\n";
    }
  }
  flush();
  return blocks;
}

function collectSentences(blocks: SectionBlock[]): Sentence[] {
  const out: Sentence[] = [];
  for (const block of blocks) {
    for (const sent of splitSentences(block.text)) {
      if (sent.trim().length > 0) {
        out.push({ section: block.section, text: sent.trim() });
      }
    }
  }
  return out;
}

/**
 * English-prose sentence splitter. Not perfect (no handling of "Dr." etc.)
 * but a boundary-or-two off doesn't matter because chunks pack many
 * sentences and the semantic-similarity gate absorbs small mis-splits.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function snapToWord(s: string): string {
  const match = s.match(/^\S*\s+/);
  return match ? s.slice(match[0].length) : s;
}
