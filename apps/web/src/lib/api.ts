import type { ChatMessage, Citation } from "@qa/schemas";

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface RetrievedChunk {
  id: string;
  sourceTitle: string;
  sourceType: string;
  excerpt: string;
  score: number;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/sessions", { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /sessions ${res.status}`);
  const body = (await res.json()) as { sessions: SessionSummary[] };
  return body.sessions;
}

export async function loadSession(id: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /sessions/${id} ${res.status}`);
  const body = (await res.json()) as { messages: ChatMessage[] };
  return body.messages;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /sessions/${id} ${res.status}`);
}

export type { Citation, ChatMessage };
