import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Reads a prompt file from disk and returns its raw body. Prompts live under
 * packages/prompts/src/<category>/<name>.md and are treated as data — never
 * inlined in service code. Templates are interpolated via `render()`.
 */
export async function loadPrompt(category, name) {
    const path = join(__dirname, category, `${name}.md`);
    const body = await readFile(path, "utf-8");
    return { category, name, body };
}
/**
 * Interpolates `{{varName}}` placeholders in a template body with values from
 * `vars`. Missing keys throw — catch during service initialization rather than
 * silently emitting half-formed prompts at runtime.
 */
export function render(body, vars) {
    return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key) => {
        if (!(key in vars)) {
            throw new Error(`Prompt variable "${key}" was not provided during interpolation.`);
        }
        return String(vars[key]);
    });
}
export async function loadAndRender(category, name, vars = {}) {
    const tpl = await loadPrompt(category, name);
    return render(tpl.body, vars);
}
//# sourceMappingURL=loader.js.map