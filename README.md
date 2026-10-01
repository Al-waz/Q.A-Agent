# Q&A Agent — RAG with Streaming Citations & Evaluation

Document Q&A agent built on a corpus of manned spaceflight articles. Retrieves relevant chunks, streams an answer with inline citations, maintains conversation memory, and ships with an evaluation harness scoring relevance, groundedness, and citation accuracy.

---

## Prerequisites

- **Node.js ≥ 20.11** — `node --version` to check.
- **pnpm ≥ 9** — `npm install -g pnpm` if you don't have it. This repo is a pnpm workspace; `npm` / `yarn` won't resolve the cross-package links.
- **Docker + Docker Compose** — for the Weaviate vector DB (single `docker-compose.yml` at the repo root).
- **Two free API keys**:
  - **Ollama Cloud** — `LLM_API_KEY` for chat, agent, and judge models. Sign up at [ollama.com](https://ollama.com) (free tier covers everything used here).
  - **Jina AI** — `JINA_API_KEY` for embeddings + reranker. Sign up at [jina.ai](https://jina.ai) (free tier with 1M tokens is enough for a full ingest + all benchmarks).

## Quickstart

Commands are listed one per line so they run on any shell — Git Bash, macOS/Linux, PowerShell 5.1, PowerShell 7+, cmd.

```bash
# 1. Clone & install (commands on separate lines — Windows PowerShell 5.1 doesn't support && chaining)
git clone https://github.com/Al-waz/Q.A-Agent.git qa-agent
cd qa-agent
pnpm install

# 2. Environment
cp .env.example .env    # Windows PowerShell: copy .env.example .env
# Fill in LLM_API_KEY (Ollama Cloud) and JINA_API_KEY — everything else has sensible defaults.

# 3. Start Weaviate (Docker Compose)
pnpm docker:up

# 4. Fetch the corpus from Wikipedia into data/corpus/ (one-time, ~1 min)
pnpm fetch-corpus

# 5. Ingest the corpus into Weaviate (first run only; ~11–13 min — semantic chunking + late chunking over ~50 articles)
pnpm ingest

# 6. Run API + web in parallel
pnpm dev
# API  → http://localhost:3001
# Web  → http://localhost:3000   (chat UI with streaming + citations + tool badges)

# 7. Run the evaluation harness (scores every test case end-to-end)
pnpm evaluate
# → results written to eval/results/<iso>.json
```

**Tearing down** when finished: `pnpm docker:down` stops Weaviate; `pnpm docker:reset` also deletes the vector data.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | NestJS + Fastify | Module system maps cleanly to the pipeline stages (retrieval, generation, evaluation). |
| LLM SDK | Vercel AI SDK | Type-safe streaming and tool calling: `streamText` + `generateObject` + `tool()`. |
| Language | TypeScript (strict) | End-to-end type safety via shared Zod schemas. |
| LLM (eval / benchmark) | `gemma4:31b-cloud` via Ollama Cloud | Google's latest open model, 256K documented context, native tool-calling support. Used by the evaluation harness — this is what the committed benchmark JSONs are measuring. Configurable via `LLM_MODEL`. |
| LLM (UI chat) | `gemini-3-flash-preview:cloud` via Ollama Cloud | 1M context. Used by the interactive chat endpoint for both the RAG and agent paths, regardless of `ENABLE_TOOL_USE`. Configurable via `AGENT_MODEL`. See [Model choices](#model-choices) below for the why. |
| LLM (judge) | `qwen3.5:397b-cloud` via Ollama Cloud | Different family from the chat model to reduce self-bias. Low hallucination rate on factual tasks and reliable structured-output. |
| Embedding | jina-embeddings-v4 | 2048-dim (Matryoshka-truncatable), 8K context, asymmetric `retrieval.passage` / `retrieval.query` task conditioning, native `late_chunking`. |
| Reranker | jina-reranker-v2-base-multilingual | Cross-encoder with 1K doc context — reorders top-20 → top-5 using full query↔chunk attention instead of pooled similarity. |
| Vector DB | Weaviate (self-hosted Docker) | Schema-first data model, native hybrid search, free forever when self-hosted. |
| Frontend | Next.js 15 + Tailwind + shadcn/ui + custom SSE consumer hook | Custom `useChatStream` hook over the SSE protocol (rather than `@ai-sdk/react`'s `useChat`) because our event schema carries extra event types (`tool-call-start`, `retrieved`, `citations`) that don't map cleanly onto the AI SDK's Data Stream Protocol. |

---

## Model choices

### Benchmark model — `gemma4:31b-cloud` (`LLM_MODEL`)

Three reasons gemma4 was picked for the eval. First, native tool-calling support — required for the agentic `searchDocuments` and `getDocumentSummary` tools. Second, a 256K documented context window, large enough on paper to handle multiple retrieved chunks plus conversation history in a single pass. Third, available as an Ollama Cloud model, so no local GPU is required and the OpenAI-compatible endpoint makes it swappable with a single env var. The committed benchmark JSONs in [eval/results/](eval/results/) are all measured on this model.

### UI chat model — `gemini-3-flash-preview:cloud` (`AGENT_MODEL`)

Two production constraints surfaced during interactive testing that the eval harness didn't expose:

1. **Context cap on long sessions.** Ollama Cloud's serving layer caps gemma4's *effective* context at roughly 2K tokens regardless of the model's documented 256K. The eval harness never trips this — its longest case is two turns and the per-request payload stays small — but long-running interactive chat does, because every round-trip carries the full system prompt, accumulated history, retrieved context (or tool schemas + tool results in agent mode).
2. **Silent empty responses.** Under certain prompts gemma4 returns a zero-token response without raising an error. The eval harness processes cases sequentially and rarely hits the specific timing / payload combination that triggers it; interactive UI usage exposes it quickly and breaks the chat without giving the user anything actionable.

`gemini-3-flash-preview:cloud` (1M context) handles both loads comfortably, so the interactive chat endpoint uses it for **both** the RAG and agent paths regardless of `ENABLE_TOOL_USE`. This keeps the UI reliable without invalidating the benchmark — the eval harness still calls `LLM_MODEL` (gemma4) directly, and the JSONs in `eval/results/` remain reproducible.

### Judge model — `qwen3.5:397b-cloud`

A deliberate choice was made to use a different model family for judging than for generation, to reduce self-bias in LLM-as-judge scoring. Qwen3.5 is Alibaba's family (vs Google's Gemma), so the judge has no incentive to favor the chat model's outputs. Qwen3.5 was specifically chosen over alternatives like DeepSeek because it has a low hallucination rate on factual tasks — critical for a groundedness judge that needs to say "this claim is not supported" rather than fabricate a justification for a score. It also has strong instruction following, which ensures the 1–5 scoring rubric is applied consistently across all turns.

---

## Corpus

~50 Wikipedia articles on manned spaceflight split across three `sourceType` values:
- `mission` (~25) — Mercury, Gemini, Apollo, Shuttle, ISS expeditions, SpaceX Crew
- `astronaut` (~15) — notable flyers across eras
- `spacecraft` (~10) — CSM, LM, Shuttle, Soyuz, Crew Dragon

Chosen specifically to protect eval groundedness: less-memorized by judge LLMs than F1/countries/movies, forcing the system to actually retrieve to answer correctly. The domain is also ideal for RAG stress-testing — articles are long (10K–40K tokens), densely cross-referenced (Apollo 11 ↔ CSM ↔ Armstrong), and structured into clear H2/H3 sections (`Mission summary`, `Crew`, `Legacy > Experiment results`) that a section-aware chunker can exploit.

---

## Embedding & Chunking Strategy

### Why Jina v4

Three properties of `jina-embeddings-v4` map directly onto the corpus above:

1. **Asymmetric task conditioning.** The model takes a `task` hint (`retrieval.passage` at ingest, `retrieval.query` at query time). Queries and passages live in different distributions — `"Who commanded Apollo 11?"` vs. a 400-word biography paragraph — and conditioning closes that gap without having to fine-tune.
2. **Native late chunking.** The `late_chunking: true` flag tells Jina to run its encoder over the *concatenated* article, then pool per-chunk vectors from the shared attention context. Pronouns like "he" or "the module" in a later chunk inherit grounding from earlier chunks in the same article, which a naive "embed each chunk independently" pipeline loses.
3. **8K context + 2048-dim Matryoshka vectors.** The 8K window is what makes per-article late chunking viable (every article fits in 1–2 sub-batches). Matryoshka Representation Learning means the 2048-dim vector can be truncated to 512 / 256 dims post-hoc without retraining — useful if we later trade recall for index size.

### Why semantic chunking (not fixed-window or recursive)

Fixed-window and recursive character splitters are cheap but boundary-blind: they cut mid-paragraph when a topic is still developing, and they merge unrelated topics when a section is short. For Wikipedia articles where a single `==` section can shift topic cleanly (`Launch` → `Trans-lunar injection` → `Lunar descent`), the chunker has to respect two signals:

- **Structural breaks** — section headers (`H2`/`H3`) are hard boundaries. Chunks never span a section change, and each chunk carries its section path (`Legacy > Experiment results`) as metadata so retrieval can surface it, and as a prefix on the embedded text (`[Apollo 11 — Legacy > Experiment results]\n\n…`) so the vector inherits that context cheaply.
- **Semantic breaks** — within a section, sentence-level embeddings are computed and a new chunk starts when cosine similarity drops below `SEMANTIC_SIMILARITY_THRESHOLD` (0.75) *and* the current buffer is already large enough to stand alone. That prevents the chunker from cutting a paragraph in half just because one sentence is stylistically different.

Combined, chunks respect topic boundaries the way a human would, and the `[Title — Section]` prefix + late-chunking pass give the vector two orthogonal sources of cross-chunk context. The ingest cost is real (~11–13 min for 50 articles → 2389 chunks on the free tier) but it is a one-time pass; retrieval-time quality is the axis we optimize for.

---

## Repository Layout

```
qa-agent/
├── apps/
│   ├── api/                 NestJS + Fastify backend
│   └── web/                 Next.js chat UI
├── packages/
│   ├── schemas/             Zod schemas shared by api, web, evaluate
│   └── prompts/             Prompt templates + loader (system, few-shots, guardrails)
├── data/corpus/             Source markdown (gitignored; populated by `pnpm fetch-corpus`)
├── scripts/                 fetch-corpus, ingest, evaluate
├── eval/                    Test cases + results JSON
├── docker-compose.yml       Weaviate
└── ...
```

---

## Evaluation Harness

`pnpm evaluate` runs every case in [eval/test-cases.json](eval/test-cases.json) end-to-end through the same retrieval + generation stack the chat endpoint uses, and writes a timestamped report to `eval/results/<iso>.json`.

### Metrics

| Metric | Range | How |
|---|---|---|
| Relevance | 1–5 | LLM-as-judge with an anchored rubric. Does the answer address the question? |
| Groundedness | 1–5 | LLM-as-judge. Is every claim supported by the retrieved context? |
| Citation accuracy | 0.0–1.0 | Deterministic — mean of three boolean checks: (1) answer contains `[N]` markers, (2) every marker resolves to a retrieved chunk, (3) every cited excerpt is a substring of its chunk. No LLM variance. |

### Test cases

12 cases (14 scored turns, since each of the two follow-up cases has two turns) across 5 categories, each picked to stress a different axis of the pipeline rather than exercise judge-model memorization:

- **Factual** (4) — single-fact lookups (commander names, dates, Mercury-era recall).
- **Multi-document** (3) — answers that require joining evidence across two articles (e.g. Armstrong bio × Gemini 8 mission).
- **Out-of-scope** (2) — questions outside the corpus (SpaceX CEO, quantum entanglement). Correct behavior is a clean refusal, not a plausible-sounding answer from the model's prior.
- **Ambiguous** (1) — "what was the first mission?" The correct behavior is to surface the ambiguity or cover multiple interpretations.
- **Follow-up** (2) — second turn uses a pronoun (`he`, `which orbiter`) that only resolves given the prior turn. Exercises session memory.

### Models

- **Chat model:** `gemma4:31b-cloud` — answers questions with inline `[N]` citations.
- **Judge model:** `qwen3.5:397b-cloud` — scores relevance + groundedness against the same retrieved context the chat model saw. Intentionally a different family to reduce self-bias. Initial runs used DeepSeek but its structured-output reliability degraded on rerun (malformed JSON, occasional out-of-range scores), so it was swapped for Qwen3.5.

### Benchmarks

Four runs were executed to measure the independent impact of tool use and query rewriting. Hybrid search and reranking were enabled across all runs.

**Overall results:**

| Run | Tools | Query Rewriting | Mean R | Mean G | Mean C |
|---|---|---|---|---|---|
| 1 | ✅ | ✅ | 4.86 | 4.50 | 0.93 |
| 2 | ❌ | ✅ | 4.93 | 4.71 | 0.95 |
| 3 | ❌ | ❌ | 4.93 | 5.00 | 0.91 |
| 4 | ✅ | ❌ | 4.93 | 4.79 | 0.95 |

**By category:**

| Category | n (turns) | R (T+QR) | G (T+QR) | C (T+QR) | R (−T+QR) | G (−T+QR) | C (−T+QR) | R (−T−QR) | G (−T−QR) | C (−T−QR) | R (T−QR) | G (T−QR) | C (T−QR) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Factual | 4 | 4.75 | 5.00 | 1.00 | 5.00 | 5.00 | 1.00 | 5.00 | 5.00 | 1.00 | 5.00 | 5.00 | 1.00 |
| Multi-document | 3 | 4.67 | 5.00 | 1.00 | 4.67 | 5.00 | 1.00 | 4.67 | 5.00 | 1.00 | 4.67 | 5.00 | 1.00 |
| Out-of-scope | 2 | 5.00 | 3.50 | 0.67 | 5.00 | 3.00 | 0.67 | 5.00 | 5.00 | 0.67 | 5.00 | 3.50 | 0.67 |
| Ambiguous | 1 | 5.00 | 5.00 | 1.00 | 5.00 | 5.00 | 1.00 | 5.00 | 5.00 | 1.00 | 5.00 | 5.00 | 1.00 |
| Follow-up | 4 | 5.00 | 4.00 | 0.92 | 5.00 | 5.00 | 1.00 | 5.00 | 5.00 | 0.83 | 5.00 | 5.00 | 1.00 |
| **Overall** | **14** | **4.86** | **4.50** | **0.93** | **4.93** | **4.71** | **0.95** | **4.93** | **5.00** | **0.91** | **4.93** | **4.79** | **0.95** |

### Analysis

Across all four runs the scores remain within a narrow band (≤0.50 on groundedness, ≤0.09 on citation accuracy), which demonstrates that the pipeline is stable and consistent regardless of configuration. The retrieval core — hybrid search and reranking — is doing the heavy lifting in every case.

The most interesting finding is that **tools and query rewriting are partially redundant for follow-up turns**. Run 4 (tools, no query rewriting) achieved G=5.00 on follow-up because the agent rewrote the ambiguous query naturally through its tool call ("Which orbiter flew its final flight?" → "which space shuttle orbiter flew the final flight of the program"), matching the result of explicit query rewriting in Run 2.

The only consistent weak spot across all runs is **out-of-scope refusal**: the agent found Elon Musk mentioned in the ISS article and answered instead of refusing. This is a prompt guardrail issue, not a retrieval issue, and is a known area for improvement.

### Recommendation

Run 3 (`ENABLE_TOOL_USE=false`, `ENABLE_QUERY_REWRITING=false`) tied or beat every other configuration on every metric. The takeaway: for this corpus the deterministic RAG path with hybrid search + reranking is already strong enough that adding the agent loop on top is pure overhead — extra LLM round-trips, more tokens, longer latency, identical answers. **The recommended production default is `ENABLE_TOOL_USE=false`**; the agent path is kept in code and remains available behind a single env flag, in case a larger or more cross-document corpus would benefit from agentic decomposition.

Raw per-turn results and judge reasoning traces in [eval/results/](eval/results/).
