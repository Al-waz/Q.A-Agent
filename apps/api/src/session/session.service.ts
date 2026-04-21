import { Inject, Injectable } from "@nestjs/common";
import type { ChatMessage } from "@qa/schemas";
import { SESSION_STORE, type ISessionStore, type SessionSummary } from "./stores/session-store.interface.js";

/**
 * Session/conversation-memory service.
 *
 * Policy: sliding window of the most recent `WINDOW_SIZE` messages returned to
 * the generation layer. Older messages are retained in the store (for
 * debugging) but not passed to the LLM. Tuning knob lives here so it can move
 * to env config cheaply in the future.
 *
 * Phase 4 wires this into the chat flow.
 */
@Injectable()
export class SessionService {
  private static readonly WINDOW_SIZE = 10;

  constructor(@Inject(SESSION_STORE) private readonly store: ISessionStore) {}

  async getWindow(sessionId: string): Promise<ChatMessage[]> {
    const history = await this.store.getHistory(sessionId);
    return history.slice(-SessionService.WINDOW_SIZE);
  }

  async append(sessionId: string, messages: ChatMessage[]): Promise<void> {
    return this.store.append(sessionId, messages);
  }

  async clear(sessionId: string): Promise<void> {
    return this.store.clear(sessionId);
  }

  async getFullHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.store.getHistory(sessionId);
  }

  async list(): Promise<SessionSummary[]> {
    return this.store.list();
  }
}
