import { Module } from "@nestjs/common";
import { EMBEDDER } from "./interfaces/embedder.interface.js";
import { JinaEmbedder } from "./jina.embedder.js";

@Module({
  providers: [
    JinaEmbedder,
    {
      provide: EMBEDDER,
      useExisting: JinaEmbedder,
    },
  ],
  exports: [EMBEDDER, JinaEmbedder],
})
export class EmbeddingsModule {}
