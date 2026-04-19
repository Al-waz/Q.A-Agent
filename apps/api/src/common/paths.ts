import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Absolute path helpers resolved from the compiled/ts-source location — not
 * from `process.cwd()` — so scripts work no matter where they're invoked from.
 *
 *   dev:  apps/api/dist/common/paths.js → ../../../../ = repo root
 *   tsx:  apps/api/src/common/paths.ts  → ../../../../ = repo root
 */
const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT: string = resolve(here, "../../../..");
export const CORPUS_DIR: string = resolve(REPO_ROOT, "data/corpus");
export const EVAL_DIR: string = resolve(REPO_ROOT, "eval");
export const EVAL_RESULTS_DIR: string = resolve(EVAL_DIR, "results");
