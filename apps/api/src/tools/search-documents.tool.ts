import { Injectable } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import { RetrievalService } from "../retrieval/retrieval.service.js";
import { ConfigService } from "../common/config/config.service.js";

/**
 * `searchDocuments` — exposes hybrid retrieval as a tool the agent can call
 * when it judges that it needs more context. Enables genuinely agentic
 * multi-step behavior (search → synthesize → search again → answer).
 *
 * Phase 6. Feature-flagged by ENABLE_TOOL_USE.
 */
@Injectable()
export class SearchDocumentsTool {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly config: ConfigService,
  ) {}

  build() {
    return tool({
      description:
        "Search the manned-spaceflight document corpus for passages relevant to a specific query. Returns up to `limit` chunks with their source title and text. Use when the user's question needs context you haven't been given yet.",
      parameters: z.object({
        query: z.string().describe("The search query — a self-contained question or phrase."),
        limit: z.number().int().min(1).max(10).default(5),
        sourceType: z.enum(["mission", "astronaut", "spacecraft"]).optional(),
      }),
      execute: async (_input) => {
        throw new Error("SearchDocumentsTool.execute not implemented (Phase 6)");
      },
    });
  }
}
