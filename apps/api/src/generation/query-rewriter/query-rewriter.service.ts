import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateText } from "ai";
import type { ChatMessage } from "@qa/schemas";
import { ConfigService } from "../../common/config/config.service.js";
import { PromptLoaderService } from "../../prompts/prompt-loader.service.js";
import { LLM_PROVIDER, type ILLMProvider } from "../interfaces/llm-provider.interface.js";

/**
 * Rewrites a user message into a self-contained search query using prior
 * conversation history. Feature-flagged by ENABLE_QUERY_REWRITING.
 *
 * The rewrite targets the *retrieval* query only — the original user message is
 * still what the chat model sees and answers. This separation matters because
 * the retriever wants context-free noun phrases ("which Gemini mission did
 * Michael Collins fly?"), while the generator wants the user's actual words
 * ("which Gemini mission did he fly?") to preserve conversational voice.
 */
@Injectable()
export class QueryRewriterService {
  private readonly logger = new Logger(QueryRewriterService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PromptLoaderService) private readonly prompts: PromptLoaderService,
    @Inject(LLM_PROVIDER) private readonly provider: ILLMProvider,
  ) {}

  /**
   * Returns a standalone query. If history is empty or the flag is disabled,
   * returns the original message unchanged — callers don't need to gate on the
   * flag themselves, the service is the gate.
   */
  async rewrite(message: string, history: ChatMessage[]): Promise<string> {
    if (!this.config.env.ENABLE_QUERY_REWRITING) return message;
    if (history.length === 0) return message;

    const formattedHistory = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = await this.prompts.load("system", "query-rewrite", {
      history: formattedHistory,
      latestMessage: message,
    });

    try {
      const { text } = await generateText({
        model: this.provider.utilityModel(),
        prompt,
      });
      const rewritten = normalizeRewrite(text);
      if (rewritten.length === 0) {
        this.logger.warn("Query rewriter returned empty output, using original message");
        return message;
      }
      if (rewritten !== message) {
        this.logger.log(`Rewrote query: "${truncate(message, 60)}" → "${truncate(rewritten, 60)}"`);
      }
      return rewritten;
    } catch (err) {
      this.logger.warn(`Query rewriter failed, falling back to original: ${(err as Error).message}`);
      return message;
    }
  }
}

/**
 * Strip common artifacts models produce despite "no preamble" instructions:
 * leading/trailing whitespace, surrounding quotes, "Rewritten query:" labels,
 * trailing thinking-mode fragments.
 */
function normalizeRewrite(raw: string): string {
  let out = raw.trim();
  out = out.replace(/^(rewritten query|query|output):\s*/i, "");
  out = out.replace(/^["'`]+|["'`]+$/g, "");
  // Keep only the first line — rewriters sometimes add a trailing explanation.
  const newline = out.indexOf("\n");
  if (newline >= 0) out = out.slice(0, newline);
  return out.trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
