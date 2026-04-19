/**
 * `pnpm evaluate` — run every case in `eval/test-cases.json` through the
 * chat agent, score each answer with an LLM-as-judge (different model family
 * than the chat model to reduce self-bias), and write a timestamped report
 * to `eval/results/<iso>.json`.
 *
 * Metrics (per turn):
 *   - relevance       (1–5, LLM-as-judge)
 *   - groundedness    (1–5, LLM-as-judge)
 *   - citationAccuracy (0.0–1.0, deterministic — marker resolution + excerpt
 *                       substring match against retrieved chunks)
 *
 * Run with `--case <id>` to evaluate a single test case while iterating.
 */

import "../apps/api/src/env-loader.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  EvalRunSchema,
  TestCaseSchema,
  type ChatMessage,
  type EvalRun,
  type TestCase,
  type TestCaseCategory,
  type TestCaseResult,
  type TurnResult,
} from "@qa/schemas";
import { createEvaluationContext } from "../apps/api/src/evaluation/bootstrap.js";
import { EvaluationService } from "../apps/api/src/evaluation/evaluation.service.js";
import { ConfigService } from "../apps/api/src/common/config/config.service.js";
import { EVAL_DIR, EVAL_RESULTS_DIR } from "../apps/api/src/common/paths.js";

interface LoadedSuite {
  testCases: TestCase[];
}

async function loadTestCases(caseFilter?: string): Promise<LoadedSuite> {
  const path = resolve(EVAL_DIR, "test-cases.json");
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as { testCases: unknown[] };
  const testCases = parsed.testCases.map((t) => TestCaseSchema.parse(t));
  const filtered = caseFilter ? testCases.filter((t) => t.id === caseFilter) : testCases;
  if (filtered.length === 0) {
    throw new Error(caseFilter ? `No test case matching --case ${caseFilter}` : "test-cases.json is empty");
  }
  return { testCases: filtered };
}

function parseFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function run(): Promise<void> {
  const caseFilter = parseFlag("case");
  const { testCases } = await loadTestCases(caseFilter);
  console.log(`[evaluate] loaded ${testCases.length} test case(s)${caseFilter ? ` (filtered → ${caseFilter})` : ""}`);

  const app = await createEvaluationContext();
  const startedAt = new Date().toISOString();

  try {
    const evalService = app.get(EvaluationService);
    const config = app.get(ConfigService);

    const results: TestCaseResult[] = [];
    for (const testCase of testCases) {
      console.log(`\n── ${testCase.id} (${testCase.category}) ──`);
      const turnResults: TurnResult[] = [];
      const history: ChatMessage[] = [];

      for (let i = 0; i < testCase.turns.length; i++) {
        const turn = testCase.turns[i]!;
        process.stdout.write(`  turn ${i + 1}: "${truncate(turn.question, 60)}" … `);

        const execution = await evalService.runTurn(turn.question, history);
        const [judge, citationAccuracy] = await Promise.all([
          evalService.judgeTurn(turn, execution),
          Promise.resolve(
            evalService.citationAccuracy(execution.answer, execution.citations, execution.retrievedChunks),
          ),
        ]);

        turnResults.push({
          turnIndex: i,
          question: turn.question,
          answer: execution.answer,
          citations: execution.citations,
          relevance: judge.relevance,
          groundedness: judge.groundedness,
          citationAccuracy,
          latencyMs: execution.latencyMs,
        });

        console.log(
          `R=${judge.relevance.score} G=${judge.groundedness.score} C=${citationAccuracy.score.toFixed(2)} (${execution.latencyMs}ms)`,
        );

        // Thread conversation memory for follow-up turns within a case.
        history.push({ role: "user", content: turn.question });
        history.push({ role: "assistant", content: execution.answer });
      }

      results.push({ testCase, turns: turnResults });
    }

    const finishedAt = new Date().toISOString();
    const report: EvalRun = {
      runId: startedAt.replace(/[:.]/g, "-"),
      startedAt,
      finishedAt,
      config: {
        model: config.env.LLM_MODEL,
        judgeModel: config.env.JUDGE_MODEL,
        embeddingModel: config.env.JINA_EMBEDDING_MODEL,
        rerankerEnabled: config.env.ENABLE_RERANKER,
        hybridEnabled: config.env.ENABLE_HYBRID_SEARCH,
        queryRewritingEnabled: config.env.ENABLE_QUERY_REWRITING,
      },
      results,
      summary: summarize(results),
    };

    EvalRunSchema.parse(report);

    await mkdir(EVAL_RESULTS_DIR, { recursive: true });
    const outPath = resolve(EVAL_RESULTS_DIR, `${report.runId}.json`);
    await writeFile(outPath, JSON.stringify(report, null, 2), "utf-8");

    printSummary(report);
    console.log(`\n[evaluate] wrote ${outPath}`);
  } finally {
    await app.close();
  }
}

interface CategorySample {
  relevance: number;
  groundedness: number;
  citation: number;
}

function summarize(results: TestCaseResult[]): EvalRun["summary"] {
  const flat = results.flatMap((r) => r.turns);
  const mean = (xs: number[]): number =>
    xs.length === 0 ? 0 : Number((xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3));

  const toSample = (t: TurnResult): CategorySample => ({
    relevance: t.relevance.score,
    groundedness: t.groundedness.score,
    citation: t.citationAccuracy.score,
  });

  const byCategory = {} as EvalRun["summary"]["byCategory"];
  for (const result of results) {
    const cat = result.testCase.category;
    const catTurns = result.turns;
    const existing = byCategory[cat];
    const combined: CategorySample[] = existing
      ? [
          // Rebuild mean from new sum: old mean * old count + new values
          ...(Array(existing.count).fill({
            relevance: existing.meanRelevance,
            groundedness: existing.meanGroundedness,
            citation: existing.meanCitationAccuracy,
          }) as CategorySample[]),
          ...catTurns.map(toSample),
        ]
      : catTurns.map(toSample);
    byCategory[cat] = {
      count: combined.length,
      meanRelevance: mean(combined.map((x: CategorySample) => x.relevance)),
      meanGroundedness: mean(combined.map((x: CategorySample) => x.groundedness)),
      meanCitationAccuracy: mean(combined.map((x: CategorySample) => x.citation)),
    };
  }

  return {
    meanRelevance: mean(flat.map((t) => t.relevance.score)),
    meanGroundedness: mean(flat.map((t) => t.groundedness.score)),
    meanCitationAccuracy: mean(flat.map((t) => t.citationAccuracy.score)),
    byCategory,
  };
}

function printSummary(report: EvalRun): void {
  console.log("\n════════════════ SUMMARY ════════════════");
  console.log(`Chat model:     ${report.config.model}`);
  console.log(`Judge model:    ${report.config.judgeModel}`);
  console.log(`Reranker:       ${report.config.rerankerEnabled ? "on" : "off"}`);
  console.log(`Hybrid search:  ${report.config.hybridEnabled ? "on" : "off"}`);
  console.log("────────────────────────────────────────");
  console.log(`Mean relevance:         ${report.summary.meanRelevance.toFixed(2)} / 5`);
  console.log(`Mean groundedness:      ${report.summary.meanGroundedness.toFixed(2)} / 5`);
  console.log(`Mean citation accuracy: ${report.summary.meanCitationAccuracy.toFixed(2)} / 1`);
  console.log("────────────────────────────────────────");
  console.log("By category:");
  for (const [cat, m] of Object.entries(report.summary.byCategory) as Array<[TestCaseCategory, {
    count: number;
    meanRelevance: number;
    meanGroundedness: number;
    meanCitationAccuracy: number;
  }]>) {
    console.log(
      `  ${cat.padEnd(14)} n=${m.count}  R=${m.meanRelevance.toFixed(2)}  G=${m.meanGroundedness.toFixed(2)}  C=${m.meanCitationAccuracy.toFixed(2)}`,
    );
  }
  console.log("═════════════════════════════════════════");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

run().catch((err: unknown) => {
  console.error("[evaluate] failed:", err);
  process.exit(1);
});
