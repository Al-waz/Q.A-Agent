import { Inject, Injectable, Logger } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import type { ScoredChunk } from "@qa/schemas";
import { RetrievalService } from "../retrieval/retrieval.service.js";

/**
 * `getDocumentSummary` — returns the top-relevant chunks for a specific named
 * source (e.g. "Apollo 11"). Useful when the agent decides the user's question
 * is broad and it wants to read more of one document instead of issuing another
 * narrow search. Same `collectedChunks` contract as SearchDocumentsTool so
 * citations line up across both tools.
 *
 * Phase 6. Feature-flagged by ENABLE_TOOL_USE.
 */
@Injectable()
export class GetDocumentSummaryTool {
  private readonly logger = new Logger(GetDocumentSummaryTool.name);

  constructor(
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
  ) {}

  build(collectedChunks: ScoredChunk[]) {
    return tool({
      description:
        "Fetch the most relevant chunks from ONE named source document. Returns up to 10 chunks (id, sourceTitle, section, text) filtered to the given sourceTitle. Use when a broad overview of a single article is more useful than a narrow keyword search, or when the user names a specific mission/person/spacecraft.",
      parameters: z.object({
        sourceTitle: z
          .string()
          .describe("Exact source title as it appears in the corpus (e.g. 'Apollo 11', 'Neil Armstrong', 'Space Shuttle')."),
      }),
      execute: async ({ sourceTitle }) => {
        const chunks = await this.retrieval.retrieve({
          query: sourceTitle,
          finalK: 10,
          filter: { sourceTitle },
        });
        this.logger.log(`getDocumentSummary(sourceTitle="${sourceTitle}") → ${chunks.length} chunks`);
        if (chunks.length === 0) {
          return {
            found: false,
            message: `No document titled "${sourceTitle}" in the corpus. Try searchDocuments with a keyword query instead.`,
          };
        }
        return {
          found: true,
          chunks: chunks.map((c) => formatForAgent(c, collectedChunks)),
        };
      },
    });
  }
}

function formatForAgent(chunk: ScoredChunk, collectedChunks: ScoredChunk[]) {
  const existing = collectedChunks.findIndex((c) => c.id === chunk.id);
  const index = existing >= 0 ? existing : collectedChunks.push(chunk) - 1;
  return {
    id: index + 1,
    sourceTitle: chunk.sourceTitle,
    section: chunk.section,
    text: chunk.text,
  };
}
