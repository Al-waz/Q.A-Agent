/**
 * Ingestion entrypoint: reads `data/corpus/**` → chunks (512 tok / 64 overlap) →
 * embeds via Voyage (`voyage-4`) → upserts into Weaviate `DocumentChunk`.
 *
 * Phase 2 wires this to the real chunker / embedder / vector store. The
 * `--force` flag will call `vectorStore.reset()` before reinsertion.
 *
 * For Phase 1 this is a placeholder so `pnpm ingest` resolves.
 */

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  console.log(`[ingest] not implemented yet — arrives in Phase 2 (force=${force}).`);
  console.log("[ingest] pipeline: corpus → chunker → Voyage embedder → Weaviate upsert.");
}

main().catch((err: unknown) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});
