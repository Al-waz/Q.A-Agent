import type { LanguageModelV1 } from "ai";

export const LLM_PROVIDER = Symbol("ILLMProvider");

/**
 * Abstracts the concrete LLM provider (OpenRouter, Ollama, direct Anthropic,
 * etc.). The rest of the codebase consumes a `LanguageModelV1` from the AI SDK
 * and never depends on the provider directly — swapping providers is a one-line
 * DI change.
 */
export interface ILLMProvider {
  /** The primary chat/generation model (e.g. Qwen 3.6 Plus). */
  chatModel(): LanguageModelV1;

  /** Model for the agent (tool-use) path. Distinct from `chatModel` so the
   * agent can use a larger-context model that fits system prompt + tool
   * schemas + tool results without overflowing the provider's cap. */
  agentModel(): LanguageModelV1;

  /** The judge model used by the evaluation harness. Intentionally separate
   * (and ideally a different family) to reduce self-evaluation bias. */
  judgeModel(): LanguageModelV1;

  /** A small, fast model for utility calls (query rewriting). */
  utilityModel(): LanguageModelV1;
}
