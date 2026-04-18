import { Module } from "@nestjs/common";
import { EMBEDDER } from "./interfaces/embedder.interface.js";
import { VoyageEmbedder } from "./voyage.embedder.js";

@Module({
  providers: [
    VoyageEmbedder,
    {
      provide: EMBEDDER,
      useExisting: VoyageEmbedder,
    },
  ],
  exports: [EMBEDDER, VoyageEmbedder],
})
export class EmbeddingsModule {}
