import { Injectable } from "@nestjs/common";
import type { ChatMessage } from "@qa/schemas";
import type { ISessionStore, SessionSummary } from "./session-store.interface.js";

/**
 * Process-local in-memory store. Spec explicitly allows this; the interface
 * exists so a Redis/Postgres store could swap in without touching the service
 * layer. The session title is derived from the first user message the first
 * time it's seen, so the sidebar can show something readable without a
 * separate title column.
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

  async list(): Promise<SessionSummary[]> {
    const summaries: SessionSummary[] = [];
    for (const [id, messages] of this.sessions.entries()) {
      if (messages.length === 0) continue;
      const firstUser = messages.find((m) => m.role === "user");
      const last = messages[messages.length - 1];
      summaries.push({
        id,
        title: truncate(firstUser?.content ?? "New chat", 60),
        updatedAt: last?.createdAt ?? new Date().toISOString(),
        messageCount: messages.length,
      });
    }
    // Newest first — sidebar reads top-down.
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

function truncate(s: string, max: number): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}
