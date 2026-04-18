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
# Fill in OPENROUTER_API_KEY and VOYAGE_API_KEY (both free, no credit card).

# 3. Start Weaviate
pnpm docker:up

# 4. Ingest the corpus (first run only; ~2 min)
pnpm ingest

# 5. Run API + web in parallel
pnpm dev
# API  → http://localhost:3001
# Web  → http://localhost:3000

# 6. Run the evaluation harness
pnpm evaluate
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | NestJS + Fastify | Spec-required. Module system maps cleanly to rubric axes. |
| LLM SDK | Vercel AI SDK | Spec-required. `streamText` + `generateObject` + `tool()`. |
| Language | TypeScript (strict) | Spec-required. End-to-end type safety via shared Zod schemas. |
| LLM | Qwen 3.6 Plus via OpenRouter (free) | Frontier open-weight, 1M context, native tool calling, $0. |
| Embedding | voyage-4 | SOTA retrieval (~10% better than OpenAI v3-large), 200M free tokens. |
| Reranker | rerank-2.5-lite | 32K context, instruction-following, same free tier. |
| Vector DB | Weaviate (self-hosted Docker) | Schema-first data model, native hybrid search, free forever when self-hosted. |
| Frontend | Next.js + `@ai-sdk/react` useChat + shadcn/ui | Spec's bonus; citation popovers + retrieved-chunk debug drawer. |

Full justification for each choice in [docs/architecture.md](docs/architecture.md) _(tracked in Phase 7)_.

---

## Corpus

~50 Wikipedia articles on manned spaceflight split across three `sourceType` values:
- `mission` (~25) — Mercury, Gemini, Apollo, Shuttle, ISS expeditions, SpaceX Crew
- `astronaut` (~15) — notable flyers across eras
- `spacecraft` (~10) — CSM, LM, Shuttle, Soyuz, Crew Dragon

Chosen specifically to protect eval groundedness: less-memorized by judge LLMs than F1/countries/movies, forcing the system to actually retrieve to answer correctly.

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

## Status

_Currently in Phase 1 (Foundation). See implementation plan in repo history._
