import type { ChatMessage } from "@qa/schemas";

export const SESSION_STORE = Symbol("ISessionStore");

export interface ISessionStore {
  getHistory(sessionId: string): Promise<ChatMessage[]>;
  append(sessionId: string, messages: ChatMessage[]): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
