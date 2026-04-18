import { Injectable } from "@nestjs/common";
import type { ChatMessage } from "@qa/schemas";
import type { ISessionStore } from "./session-store.interface.js";

/**
 * Process-local in-memory store. Spec explicitly allows this; the interface
 * exists so a Redis/Postgres store could swap in without touching the service
 * layer.
 */
@Injectable()
export class InMemorySessionStore implements ISessionStore {
  private readonly sessions = new Map<string, ChatMessage[]>();

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.sessions.get(sessionId) ?? [];
  }

  async append(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const existing = this.sessions.get(sessionId) ?? [];
    this.sessions.set(sessionId, [...existing, ...messages]);
  }

  async clear(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
