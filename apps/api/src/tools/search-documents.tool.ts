import { Inject, Injectable, Logger } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import type { ScoredChunk } from "@qa/schemas";
import { RetrievalService } from "../retrieval/retrieval.service.js";

/**
 * `searchDocuments` — exposes hybrid retrieval as a tool the agent can call
 * when it judges that it needs more context. Enables genuinely agentic
 * multi-step behavior (search → synthesize → search again → answer).
 *
 * Phase 6. Feature-flagged by ENABLE_TOOL_USE.
 *
 * `build()` takes a `collectedChunks` array owned by the caller (one per chat
 * turn); every chunk returned by this tool is appended so GenerationService
 * can reuse them for citation extraction after the agent finishes.
 */
@Injectable()
export class SearchDocumentsTool {
  private readonly logger = new Logger(SearchDocumentsTool.name);

  constructor(
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
  ) {}

  build(collectedChunks: ScoredChunk[]) {
    return tool({
      description:
        "Search the manned-spaceflight document corpus for passages relevant to a specific query. Returns up to `limit` chunks each with a numeric `id` (use this id when you cite), source title, section, and text. Call this when the user's question needs context you haven't been given yet, or when earlier results were insufficient and you want to refine the search.",
      parameters: z.object({
        query: z.string().describe("A self-contained search query — resolve pronouns and avoid relying on prior conversation."),
        limit: z.number().int().min(1).max(10).default(5).describe("How many chunks to return."),
        sourceType: z
          .enum(["mission", "astronaut", "spacecraft"])
          .optional()
          .describe("Narrow the search to one document type when you know the answer lives there."),
      }),
      execute: async ({ query, limit, sourceType }) => {
        const chunks = await this.retrieval.retrieve({
          query,
          finalK: limit,
          ...(sourceType ? { filter: { sourceType } } : {}),
        });
        this.logger.log(
          `searchDocuments(query="${truncate(query, 60)}", limit=${limit}${sourceType ? `, sourceType=${sourceType}` : ""}) → ${chunks.length} chunks`,
        );
        return chunks.map((c) => formatForAgent(c, collectedChunks));
      },
    });
  }
}

/** Cap per-chunk text in tool results so multi-turn agent context doesn't
 * blow past the model's context window. The full text is kept in
 * `collectedChunks` for citation excerpts; the agent itself only needs
 * enough to extract the answer. */
const MAX_CHUNK_CHARS_FOR_AGENT = 600;

/**
 * Shape returned to the model. We assign a stable numeric id from the shared
 * `collectedChunks` list so the same chunk always gets the same id across
 * multiple tool calls — that id is what the model uses in `[N]` markers.
 */
function formatForAgent(chunk: ScoredChunk, collectedChunks: ScoredChunk[]) {
  const existing = collectedChunks.findIndex((c) => c.id === chunk.id);
  const index = existing >= 0 ? existing : collectedChunks.push(chunk) - 1;
  return {
    id: index + 1,
    sourceTitle: chunk.sourceTitle,
    section: chunk.section,
    text:
      chunk.text.length > MAX_CHUNK_CHARS_FOR_AGENT
        ? `${chunk.text.slice(0, MAX_CHUNK_CHARS_FOR_AGENT)}…`
        : chunk.text,
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
