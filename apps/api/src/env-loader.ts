/**
 * Side-effect import that loads the monorepo-root `.env` into `process.env`
 * before any other module evaluates. Imported first from `main.ts` so the
 * Zod-backed `ConfigService` sees the full environment at construction time.
 *
 * Path resolution walks three levels up from the compiled file:
 *   dev:  apps/api/dist/env-loader.js → ../../../.env = <repo-root>/.env
 *   tsx:  apps/api/src/env-loader.ts  → ../../../.env = <repo-root>/.env
 */
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../../../.env");

loadDotenv({ path: envPath });
