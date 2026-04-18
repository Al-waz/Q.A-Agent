import { Module } from "@nestjs/common";
import { RetrievalModule } from "../retrieval/retrieval.module.js";
import { SearchDocumentsTool } from "./search-documents.tool.js";
import { GetDocumentSummaryTool } from "./get-document-summary.tool.js";

@Module({
  imports: [RetrievalModule],
  providers: [SearchDocumentsTool, GetDocumentSummaryTool],
  exports: [SearchDocumentsTool, GetDocumentSummaryTool],
})
export class ToolsModule {}
