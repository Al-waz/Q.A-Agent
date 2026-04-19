/**
 * `pnpm ingest` — full ingestion pipeline end-to-end.
 *
 * Reads cached corpus files from `data/corpus/`, chunks them, embeds each
 * chunk via Jina, and upserts into Weaviate. Shares the exact service
 * implementations used by the runtime API via `createIngestionContext`.
 *
 * Flags: `--force` wipes the collection before re-ingesting.
 */

import "../apps/api/src/env-loader.js";
import { createIngestionContext } from "../apps/api/src/ingestion/bootstrap.js";
import { IngestionService } from "../apps/api/src/ingestion/ingestion.service.js";

async function run(): Promise<void> {
  const force = process.argv.includes("--force");
  const app = await createIngestionContext();

  try {
    const ingestion = app.get(IngestionService);
    const report = await ingestion.run({ force });
    console.log("\n[ingest] report:", report);
  } finally {
    await app.close();
  }
}

run().catch((err: unknown) => {
  console.error("[ingest] failed:", err);
  process.exit(1);
});
