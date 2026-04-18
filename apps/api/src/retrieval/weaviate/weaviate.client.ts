import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../../common/config/config.service.js";
import type { IVectorStore, SearchOptions, UpsertInput } from "../interfaces/vector-store.interface.js";
import type { ScoredChunk } from "@qa/schemas";

/**
 * Weaviate adapter implementing IVectorStore.
 * Phase 2: ensureCollection, upsert, count, reset.
 * Phase 3: vector search.
 * Phase 6: hybrid search via `alpha` option.
 */
@Injectable()
export class WeaviateClient implements IVectorStore {
  private readonly logger = new Logger(WeaviateClient.name);

  constructor(private readonly config: ConfigService) {}

  ensureCollection(): Promise<void> {
    throw new Error("WeaviateClient.ensureCollection not implemented (Phase 2)");
  }

  upsert(_items: UpsertInput[]): Promise<void> {
    throw new Error("WeaviateClient.upsert not implemented (Phase 2)");
  }

  search(_query: string, _vector: number[], _options: SearchOptions): Promise<ScoredChunk[]> {
    throw new Error("WeaviateClient.search not implemented (Phase 3)");
  }

  count(): Promise<number> {
    throw new Error("WeaviateClient.count not implemented (Phase 2)");
  }

  reset(): Promise<void> {
    throw new Error("WeaviateClient.reset not implemented (Phase 2)");
  }
}
