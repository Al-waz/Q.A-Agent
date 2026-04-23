"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatStreamEvent, Citation } from "@qa/schemas";
import { loadSession, type RetrievedChunk } from "@/lib/api";

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  status: "running" | "done";
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Assistant only — populated progressively as tool-call events arrive. */
  toolCalls?: ToolCall[];
  /** Assistant only — attached after the `citations` SSE event. */
  citations?: Citation[];
  /** Assistant only — attached after the `retrieved` SSE event. */
  retrieved?: RetrievedChunk[];
  /**
   * Assistant only — flipped true by the `text-end` SSE event. Lets the UI
   * drop the typing cursor as soon as tokens stop, without waiting for the
   * (sometimes slow) citation extraction to finish.
   */
  textDone?: boolean;
}

export interface UseChatStream {
  messages: ChatTurn[];
  isStreaming: boolean;
  error: string | null;
  send: (message: string) => Promise<void>;
  resetForSession: (sessionId: string, replay: boolean) => Promise<void>;
}

/**
 * Consumes the NestJS `/chat` SSE stream and materializes a lightweight
 * message log for the UI. The backend's event protocol is a discriminated
 * union (`ChatStreamEvent`) — we decode line-by-line and fold events into the
 * in-progress assistant turn.
 *
 * Why a custom hook instead of `useChat`: the AI SDK's Data Stream Protocol
 * expects its own wire format. Ours carries extra events (retrieved,
 * tool-call-*, citations) that don't map cleanly onto its message parts, so a
 * direct fetch + line parser is simpler and gives us full typing.
 */
export function useChatStream(sessionId: string): UseChatStream {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // When sessionId changes (user clicks a sidebar entry) we either clear the
  // log (new chat) or replay the stored history from the API.
  const resetForSession = useCallback(async (sid: string, replay: boolean) => {
    abortRef.current?.abort();
    setError(null);
    setIsStreaming(false);
    if (!replay) {
      setMessages([]);
      return;
    }
    try {
      const history = await loadSession(sid);
      setMessages(
        history.map((m, i) => ({
          id: `${sid}-${i}`,
          role: m.role === "system" ? "assistant" : m.role,
          content: m.content,
        })),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const send = useCallback(
    async (message: string): Promise<void> => {
      if (!message.trim() || isStreaming) return;
      setError(null);
      setIsStreaming(true);

      const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: "user", content: message };
      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
        toolCalls: [],
      };
      setMessages((prev) => [...prev, userTurn, assistantTurn]);

      const assistantId = assistantTurn.id;
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const update = (fn: (turn: ChatTurn) => ChatTurn): void => {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sessionId }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`POST /chat ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames are separated by blank lines — process each complete
          // one, keep any partial tail in the buffer for the next read.
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            const payload = dataLine.slice(6);
            let event: ChatStreamEvent;
            try {
              event = JSON.parse(payload) as ChatStreamEvent;
            } catch {
              continue;
            }
            applyEvent(event, update);
            if (event.type === "done" || event.type === "error") break;
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId, isStreaming],
  );

  // Abort any in-flight stream on unmount to avoid setState on a dead tree.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { messages, isStreaming, error, send, resetForSession };
}

function applyEvent(event: ChatStreamEvent, update: (fn: (t: ChatTurn) => ChatTurn) => void): void {
  switch (event.type) {
    case "token":
      update((t) => ({ ...t, content: t.content + event.delta }));
      return;
    case "tool-call-start":
      update((t) => ({
        ...t,
        toolCalls: [...(t.toolCalls ?? []), { id: event.id, name: event.name, args: event.args, status: "running" }],
      }));
      return;
    case "tool-call-end":
      update((t) => ({
        ...t,
        toolCalls: (t.toolCalls ?? []).map((tc) => (tc.id === event.id ? { ...tc, status: "done" } : tc)),
      }));
      return;
    case "text-end":
      update((t) => ({ ...t, textDone: true }));
      return;
    case "retrieved":
      update((t) => ({ ...t, retrieved: event.chunks }));
      return;
    case "citations":
      update((t) => ({ ...t, citations: event.citations }));
      return;
    case "error":
      update((t) => ({ ...t, content: t.content || `⚠️ ${event.message}` }));
      return;
    case "done":
      return;
  }
}
