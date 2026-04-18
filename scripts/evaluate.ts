/**
 * Evaluation harness entrypoint: runs every turn in `eval/test-cases.json`
 * through the chat agent, scores each answer with an LLM-as-judge
 * (different model family than the agent's to reduce self-bias), and writes
 * a timestamped run to `eval/results/<iso>.json`.
 *
 * Phase 5 wires the judge + metrics (groundedness, relevance, completeness,
 * citation accuracy). For Phase 1 this placeholder just resolves the script.
 */

async function main(): Promise<void> {
  console.log("[evaluate] not implemented yet — arrives in Phase 5 (evaluation harness).");
  console.log("[evaluate] outputs: eval/results/<iso>.json summarising metrics per test case.");
}

main().catch((err: unknown) => {
  console.error("[evaluate] failed:", err);
  process.exit(1);
});
