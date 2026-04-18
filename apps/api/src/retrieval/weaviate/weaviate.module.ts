import { Module } from "@nestjs/common";
import { VECTOR_STORE } from "../interfaces/vector-store.interface.js";
import { WeaviateClient } from "./weaviate.client.js";

@Module({
  providers: [
    WeaviateClient,
    {
      provide: VECTOR_STORE,
      useExisting: WeaviateClient,
    },
  ],
  exports: [VECTOR_STORE, WeaviateClient],
})
export class WeaviateModule {}
