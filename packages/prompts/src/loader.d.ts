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
export declare function loadPrompt(category: PromptCategory, name: string): Promise<PromptTemplate>;
/**
 * Interpolates `{{varName}}` placeholders in a template body with values from
 * `vars`. Missing keys throw — catch during service initialization rather than
 * silently emitting half-formed prompts at runtime.
 */
export declare function render(body: string, vars: Record<string, string | number>): string;
export declare function loadAndRender(category: PromptCategory, name: string, vars?: Record<string, string | number>): Promise<string>;
//# sourceMappingURL=loader.d.ts.map