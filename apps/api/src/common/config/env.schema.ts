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

  // LLM provider (OpenAI-compatible — works with Ollama Cloud, OpenRouter,
  // local Ollama, direct OpenAI, etc. Just point LLM_BASE_URL at the endpoint
  // and supply the matching LLM_API_KEY. Default is Ollama Cloud.
  LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required"),
  LLM_MODEL: z.string().default("qwen3-coder:480b"),
  LLM_BASE_URL: z.string().url().default("https://ollama.com/v1"),
  JUDGE_MODEL: z.string().default("deepseek-v3.1:671b"),

  // Jina (embeddings + reranker share the same free-tier token pool)
  JINA_API_KEY: z.string().min(1, "JINA_API_KEY is required"),
  JINA_EMBEDDING_MODEL: z.string().default("jina-embeddings-v3"),
  JINA_RERANKER_MODEL: z.string().default("jina-reranker-v2-base-multilingual"),

  // Weaviate
  WEAVIATE_HOST: z.string().default("localhost"),
  WEAVIATE_PORT: z.coerce.number().int().positive().default(8080),
  WEAVIATE_GRPC_PORT: z.coerce.number().int().positive().default(50051),
  WEAVIATE_SCHEME: z.enum(["http", "https"]).default("http"),
  WEAVIATE_COLLECTION: z.string().default("DocumentChunk"),

  // Retrieval
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(20),
  RETRIEVAL_FINAL_K: z.coerce.number().int().positive().default(5),
  HYBRID_ALPHA: z.coerce.number().min(0).max(1).default(0.5),

  // Chunking (semantic strategy: sentence-level splits with embedding-similarity
  // boundary detection, section-header prefixing, and Jina native late chunking)
  CHUNK_SIZE_TOKENS: z.coerce.number().int().positive().default(512),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().int().nonnegative().default(64),
  // Cosine-similarity threshold at which the semantic chunker inserts a
  // boundary between adjacent sentences. Lower → more (smaller) chunks.
  // 0.70-0.80 works well for expository prose; 0.75 is a safe default.
  SEMANTIC_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  // When true, the Jina embed call receives `late_chunking: true` so chunk
  // vectors carry full-document context via token-level pooling.
  JINA_LATE_CHUNKING: booleanString.default("true"),

  // Feature flags
  ENABLE_RERANKER: booleanString.default("true"),
  ENABLE_HYBRID_SEARCH: booleanString.default("true"),
  ENABLE_QUERY_REWRITING: booleanString.default("true"),
  ENABLE_TOOL_USE: booleanString.default("false"),

  // Agent (ENABLE_TOOL_USE=true): cap on tool-call rounds per turn to prevent
  // runaway loops on a chatty model. One "step" = one model decision + optional
  // tool call. 4 is comfortably above the typical 1–2 the corpus needs.
  AGENT_MAX_STEPS: z.coerce.number().int().positive().max(10).default(4),
});

export type Env = z.infer<typeof EnvSchema>;
