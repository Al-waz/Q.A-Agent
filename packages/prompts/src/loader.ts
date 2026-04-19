import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve prompts against the package's `src/` directory so the loader works
 * regardless of how the consumer runs (tsc-built `dist/loader.js`, or `tsx`
 * directly from `src/loader.ts`). `tsc` does not copy `.md` assets into dist,
 * and we don't want a separate build step just for that — reading from src
 * keeps the prompts package "source is canonical" and avoids drift.
 */
const PROMPTS_DIR = basename(__dirname) === "dist" ? join(__dirname, "..", "src") : __dirname;

export type PromptCategory = "system" | "fewshots" | "guardrails";

export interface PromptTemplate {
  category: PromptCategory;
  name: string;
  body: string;
}

/**
 * Reads a prompt file from disk and returns its raw body. Prompts live under
 * packages/prompts/src/<category>/<name>.md and are treated as data — never
 * inlined in service code. Templates are interpolated via `render()`.
 */
export async function loadPrompt(category: PromptCategory, name: string): Promise<PromptTemplate> {
  const path = join(PROMPTS_DIR, category, `${name}.md`);
  const body = await readFile(path, "utf-8");
  return { category, name, body };
}

/**
 * Interpolates `{{varName}}` placeholders in a template body with values from
 * `vars`. Missing keys throw — catch during service initialization rather than
 * silently emitting half-formed prompts at runtime.
 */
export function render(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Prompt variable "${key}" was not provided during interpolation.`);
    }
    return String(vars[key]);
  });
}

export async function loadAndRender(
  category: PromptCategory,
  name: string,
  vars: Record<string, string | number> = {},
): Promise<string> {
  const tpl = await loadPrompt(category, name);
  return render(tpl.body, vars);
}
