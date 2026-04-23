# Q&A Agent — RAG with Streaming Citations & Evaluation

Document Q&A agent built on a corpus of manned spaceflight articles. Retrieves relevant chunks, streams an answer with inline citations, maintains conversation memory, and ships with an evaluation harness scoring relevance, groundedness, and citation accuracy.

> **Tappz AI Engineer take-home** — full architecture rationale and evaluation analysis below.

---

## Quickstart

```bash
# 1. Clone and install
pnpm install

# 2. Environment
cp .env.example .env
# Fill in LLM_API_KEY (Ollama Cloud) and JINA_API_KEY.

# 3. Start Weaviate
pnpm docker:up

# 4. Fetch the corpus from Wikipedia into data/corpus/ (one-time, ~1 min)
pnpm fetch-corpus

# 5. Ingest the corpus (first run only; ~11 min — semantic chunking + late chunking)
pnpm ingest

# 6. Run API + web in parallel
pnpm dev
# API  → http://localhost:3001
# Web  → http://localhost:3000

# 7. Run the evaluation harness
pnpm evaluate
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | NestJS + Fastify | Spec-required. Module system maps cleanly to rubric axes. |
| LLM SDK | Vercel AI SDK | Spec-required. `streamText` + `generateObject` + `tool()`. |
| Language | TypeScript (strict) | Spec-required. End-to-end type safety via shared Zod schemas. |
| LLM (chat) | `gemma4:31b-cloud` via Ollama Cloud | Google's latest open model, 256K context, MMLU-Pro 85.2, fast on hosted inference. OpenAI-compatible endpoint — swap via a single env var. |
| LLM (judge) | `deepseek-v3.2:cloud` via Ollama Cloud | Deliberately a different family than the chat model to reduce self-bias in LLM-as-judge scoring. Strong structured-output reliability. |
| Embedding | jina-embeddings-v4 | 2048-dim (Matryoshka-truncatable), 8K context, asymmetric `retrieval.passage` / `retrieval.query` task conditioning, native `late_chunking`. |
| Reranker | jina-reranker-v2-base-multilingual | Cross-encoder with 1K doc context — reorders top-20 → top-5 using full query↔chunk attention instead of pooled similarity. |
| Vector DB | Weaviate (self-hosted Docker) | Schema-first data model, native hybrid search, free forever when self-hosted. |
| Frontend | Next.js + `@ai-sdk/react` useChat + shadcn/ui | Spec's bonus; citation popovers + retrieved-chunk debug drawer. |

Full justification for each choice in [docs/architecture.md](docs/architecture.md) _(tracked in Phase 7)_.

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

Combined, chunks respect topic boundaries the way a human would, and the `[Title — Section]` prefix + late-chunking pass give the vector two orthogonal sources of cross-chunk context. The ingest cost is real (~11 min for 50 articles → 2389 chunks on the free tier) but it is a one-time pass; retrieval-time quality is the axis we optimize for.

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
├── data/corpus/             Source markdown (committed)
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

12 cases across 5 categories, each picked to stress a different axis of the pipeline rather than exercise judge-model memorization:

- **Factual** (4) — single-fact lookups (commander names, dates, Mercury-era recall).
- **Multi-document** (3) — answers that require joining evidence across two articles (e.g. Armstrong bio × Gemini 8 mission).
- **Out-of-scope** (2) — questions outside the corpus (SpaceX CEO, quantum entanglement). Correct behavior is a clean refusal, not a plausible-sounding answer from the model's prior.
- **Ambiguous** (1) — "what was the first mission?" The correct behavior is to surface the ambiguity or cover multiple interpretations.
- **Follow-up** (2) — second turn uses a pronoun (`he`, `which orbiter`) that only resolves given the prior turn. Exercises session memory.

### Models

- **Chat model:** `gemma4:31b-cloud` — answers questions with inline `[N]` citations.
- **Judge model:** `deepseek-v3.2:cloud` — scores relevance + groundedness against the same retrieved context the chat model saw. Intentionally a different family to reduce self-bias.

### Benchmarks

## Evaluation Results

Four runs were executed to measure the independent impact of tool use and query rewriting. Hybrid search and reranking were enabled across all runs.

**Overall results:**

| Run | Tools | Query Rewriting | Mean R | Mean G | Mean C |
|---|---|---|---|---|---|
| 1 | ✅ | ✅ | 4.86 | 4.50 | 0.93 |
| 2 | ❌ | ✅ | 4.93 | 4.71 | 0.95 |
| 3 | ❌ | ❌ | 4.93 | 5.00 | 0.91 |
| 4 | ✅ | ❌ | 4.93 | 4.79 | 0.95 |

**By category:**

| Category | n | R (T+QR) | G (T+QR) | C (T+QR) | R (−T+QR) | G (−T+QR) | C (−T+QR) | R (−T−QR) | G (−T−QR) | C (−T−QR) | R (T−QR) | G (T−QR) | C (T−QR) |
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

Raw per-turn results and judge reasoning traces in [eval/results/](eval/results/).

---

## Status

_Phase 5 (Evaluation harness) complete. See implementation plan in repo history._
