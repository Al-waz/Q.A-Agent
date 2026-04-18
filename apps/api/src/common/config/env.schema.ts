import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // API
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default("0.0.0.0"),

  // OpenRouter / LLM
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  OPENROUTER_MODEL: z.string().default("qwen/qwen3.6-plus:free"),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  JUDGE_MODEL: z.string().default("qwen/qwen3.6-plus-preview:free"),

  // Voyage
  VOYAGE_API_KEY: z.string().min(1, "VOYAGE_API_KEY is required"),
  VOYAGE_EMBEDDING_MODEL: z.string().default("voyage-4"),
  VOYAGE_RERANKER_MODEL: z.string().default("rerank-2.5-lite"),

  // Weaviate
  WEAVIATE_HOST: z.string().default("localhost"),
  WEAVIATE_PORT: z.coerce.number().int().positive().default(8080),
  WEAVIATE_SCHEME: z.enum(["http", "https"]).default("http"),
  WEAVIATE_COLLECTION: z.string().default("DocumentChunk"),

  // Retrieval
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(20),
  RETRIEVAL_FINAL_K: z.coerce.number().int().positive().default(5),
  HYBRID_ALPHA: z.coerce.number().min(0).max(1).default(0.5),

  // Chunking
  CHUNK_SIZE_TOKENS: z.coerce.number().int().positive().default(512),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().int().nonnegative().default(64),

  // Feature flags
  ENABLE_RERANKER: booleanString.default("true"),
  ENABLE_HYBRID_SEARCH: booleanString.default("true"),
  ENABLE_QUERY_REWRITING: booleanString.default("true"),
  ENABLE_TOOL_USE: booleanString.default("false"),
});

export type Env = z.infer<typeof EnvSchema>;
