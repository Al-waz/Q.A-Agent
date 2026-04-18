/**
 * Fetches the manned-spaceflight corpus from Wikipedia into `data/corpus/`.
 *
 * Phase 2 will wire this up: iterate `corpus.manifest.ts` → hit Wikipedia REST
 * summary + HTML endpoints → strip navboxes/refs → write `<slug>.md` per page,
 * partitioned by category (missions | astronauts | spacecraft).
 *
 * For Phase 1 this is a placeholder entrypoint so `pnpm fetch-corpus` resolves.
 */

async function main(): Promise<void> {
  console.log("[fetch-corpus] not implemented yet — arrives in Phase 2 (corpus & ingestion).");
  console.log("[fetch-corpus] target: Wikipedia → data/corpus/{missions,astronauts,spacecraft}/*.md");
}

main().catch((err: unknown) => {
  console.error("[fetch-corpus] failed:", err);
  process.exit(1);
});
