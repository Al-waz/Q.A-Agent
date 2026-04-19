/**
 * `pnpm fetch-corpus` — populates `data/corpus/` from Wikipedia.
 *
 * Re-uses the WikiFetcherService wired inside IngestionModule so the exact
 * same code runs in scripts and at runtime. Bootstrapping goes through
 * `apps/api/src/ingestion/bootstrap.ts` so all bare imports resolve via
 * apps/api's node_modules — see that file's docblock for the pnpm rationale.
 *
 * Flags: `--force` re-fetches articles even if cached files already exist.
 */

import "../apps/api/src/env-loader.js";
import { createIngestionContext } from "../apps/api/src/ingestion/bootstrap.js";
import { WikiFetcherService } from "../apps/api/src/ingestion/wiki-fetcher.service.js";

async function run(): Promise<void> {
  const force = process.argv.includes("--force");
  const app = await createIngestionContext();

  try {
    const fetcher = app.get(WikiFetcherService);
    await fetcher.fetchAll({ force });
  } finally {
    await app.close();
  }
}

run().catch((err: unknown) => {
  console.error("[fetch-corpus] failed:", err);
  process.exit(1);
});
