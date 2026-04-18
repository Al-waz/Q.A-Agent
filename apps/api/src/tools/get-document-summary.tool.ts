import { Injectable } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import { RetrievalService } from "../retrieval/retrieval.service.js";

/**
 * `getDocumentSummary` — returns a compact summary of all chunks for a named
 * source (e.g. full "Apollo 11" article). Useful when the agent decides the
 * user's question is broad and worth reading an entire document on.
 *
 * Phase 6. Feature-flagged by ENABLE_TOOL_USE.
 */
@Injectable()
export class GetDocumentSummaryTool {
  constructor(private readonly retrieval: RetrievalService) {}

  build() {
    return tool({
      description:
        "Retrieve all chunks for a specific source document by its title (e.g. 'Apollo 11', 'Neil Armstrong', 'Space Shuttle'). Use when a broad overview is more useful than a narrow search.",
      parameters: z.object({
        sourceTitle: z.string().describe("Exact source title as it appears in the corpus."),
      }),
      execute: async (_input) => {
        throw new Error("GetDocumentSummaryTool.execute not implemented (Phase 6)");
      },
    });
  }
}
