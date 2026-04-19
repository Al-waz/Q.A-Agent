import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import weaviate, {
  Filters,
  type WeaviateClient as WeaviateSdkClient,
  type Collection,
  type FilterValue,
} from "weaviate-client";
import { ConfigService } from "../../common/config/config.service.js";
import type { IVectorStore, SearchOptions, UpsertInput } from "../interfaces/vector-store.interface.js";
import type { ChunkMetadata, ScoredChunk, SourceType } from "@qa/schemas";

/**
 * Weaviate adapter for ingestion + retrieval.
 *
 *  - Lazy-connects on first use; closes on NestJS shutdown hook.
 *  - Collection schema lives in `collection.config.ts` — this file only speaks
 *    to the SDK. Vectors are `selfProvided` because we supply Jina embeddings
 *    ourselves (the Weaviate `text2vec-*` modules are off — see docker-compose).
 *  - Hybrid search (`alpha` option) is supported natively by the SDK; when
 *    `alpha` is undefined we fall back to pure vector search via `nearVector`.
 */

type ChunkProps = {
  sourceTitle: string;
  sourceType: SourceType;
  chunkIndex: number;
  // Weaviate's text type can't be natively null, so we store an empty string
  // for chunks from the article preamble and map "" ↔ null at the boundary.
  section: string;
  text: string;
};

@Injectable()
export class WeaviateClient implements IVectorStore, OnModuleDestroy {
  private readonly logger = new Logger(WeaviateClient.name);
  private client?: WeaviateSdkClient;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }

  async ensureCollection(): Promise<void> {
    const client = await this.getClient();
    const name = this.collectionName;

    if (await client.collections.exists(name)) {
      this.logger.log(`Collection ${name} already exists — skipping create`);
      return;
    }

    this.logger.log(`Creating collection ${name}`);
    await client.collections.create({
      name,
      vectorizers: weaviate.configure.vectorizer.selfProvided(),
      properties: [
        { name: "sourceTitle", dataType: "text", indexFilterable: true, indexSearchable: true },
        { name: "sourceType", dataType: "text", indexFilterable: true },
        { name: "chunkIndex", dataType: "int", indexFilterable: true },
        { name: "section", dataType: "text", indexFilterable: true, indexSearchable: true },
        { name: "text", dataType: "text", indexSearchable: true },
      ],
      invertedIndex: weaviate.configure.invertedIndex({ bm25k1: 1.2, bm25b: 0.75 }),
    });
  }

  async upsert(items: UpsertInput[]): Promise<void> {
    if (items.length === 0) return;
    const col = await this.collection();

    const result = await col.data.insertMany(
      items.map((item) => ({
        id: toUuid(item.id),
        properties: {
          sourceTitle: item.sourceTitle,
          sourceType: item.sourceType,
          chunkIndex: item.chunkIndex,
          section: item.section ?? "",
          text: item.text,
        } satisfies ChunkProps,
        vectors: item.vector,
      })),
    );

    if (result.hasErrors) {
      const firstError = Object.values(result.errors)[0];
      throw new Error(`Weaviate insertMany reported errors: ${firstError?.message ?? "unknown"}`);
    }
  }

  async search(query: string, vector: number[], options: SearchOptions): Promise<ScoredChunk[]> {
    const col = await this.collection();
    const filters = this.buildFilter(col, options.filter);

    if (options.alpha !== undefined) {
      const res = await col.query.hybrid(query, {
        vector,
        alpha: options.alpha,
        limit: options.k,
        ...(filters ? { filters } : {}),
        returnMetadata: ["score"],
      });
      return res.objects.map((o) => this.toScoredChunk(o.uuid, o.properties as ChunkProps, o.metadata?.score ?? 0));
    }

    const res = await col.query.nearVector(vector, {
      limit: options.k,
      ...(filters ? { filters } : {}),
      returnMetadata: ["distance"],
    });
    return res.objects.map((o) =>
      this.toScoredChunk(o.uuid, o.properties as ChunkProps, 1 - (o.metadata?.distance ?? 0)),
    );
  }

  async count(): Promise<number> {
    const col = await this.collection();
    const result = await col.aggregate.overAll();
    return result.totalCount ?? 0;
  }

  async reset(): Promise<void> {
    const client = await this.getClient();
    const name = this.collectionName;
    this.logger.warn(`Resetting collection ${name}`);
    if (await client.collections.exists(name)) {
      await client.collections.delete(name);
    }
    await this.ensureCollection();
  }

  private async getClient(): Promise<WeaviateSdkClient> {
    if (this.client) return this.client;
    const { env } = this.config;
    const secure = env.WEAVIATE_SCHEME === "https";

    this.client = await weaviate.connectToCustom({
      httpHost: env.WEAVIATE_HOST,
      httpPort: env.WEAVIATE_PORT,
      httpSecure: secure,
      grpcHost: env.WEAVIATE_HOST,
      grpcPort: env.WEAVIATE_GRPC_PORT,
      grpcSecure: secure,
    });

    const ready = await this.client.isReady();
    if (!ready) throw new Error(`Weaviate at ${env.WEAVIATE_HOST}:${env.WEAVIATE_PORT} is not ready`);
    return this.client;
  }

  private async collection(): Promise<Collection<ChunkProps, string>> {
    const client = await this.getClient();
    return client.collections.get<ChunkProps>(this.collectionName);
  }

  private get collectionName(): string {
    return this.config.env.WEAVIATE_COLLECTION;
  }

  private buildFilter(
    col: Collection<ChunkProps, string>,
    filter?: SearchOptions["filter"],
  ): FilterValue | undefined {
    if (!filter) return undefined;
    const clauses: FilterValue[] = [];
    if (filter.sourceType) clauses.push(col.filter.byProperty("sourceType").equal(filter.sourceType));
    if (filter.sourceTitle) clauses.push(col.filter.byProperty("sourceTitle").equal(filter.sourceTitle));
    if (clauses.length === 0) return undefined;
    if (clauses.length === 1) return clauses[0];
    return Filters.and(...clauses);
  }

  private toScoredChunk(uuid: string, props: ChunkProps, score: number): ScoredChunk {
    const meta: ChunkMetadata = {
      sourceTitle: props.sourceTitle,
      sourceType: props.sourceType,
      chunkIndex: props.chunkIndex,
      section: props.section ? props.section : null,
      text: props.text,
    };
    return { id: uuid, score, ...meta };
  }
}

/**
 * Weaviate requires UUIDs for explicit IDs. Our chunk IDs are stable strings
 * like `apollo-11#7`, so we deterministically hash them into a UUIDv5-shaped
 * value. This keeps re-ingestion idempotent (same slug+index → same UUID)
 * without having to maintain a slug→uuid mapping table.
 */
function toUuid(stableId: string): string {
  // Deterministic v5-style UUID from SHA-1 of the stable id (namespace omitted
  // for simplicity — we only need collision-resistance within our collection).
  const hash = sha1Hex(stableId);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variantChar(hash[16]!)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function sha1Hex(input: string): string {
  // Small synchronous SHA-1 via Node's crypto. Kept inline to avoid top-level
  // await or an additional import surface in a hot path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha1").update(input).digest("hex");
}

function variantChar(c: string): string {
  const n = parseInt(c, 16);
  const variant = (n & 0x3) | 0x8;
  return variant.toString(16);
}
