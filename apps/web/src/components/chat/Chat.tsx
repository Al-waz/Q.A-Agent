"use client";

import { useEffect, useRef } from "react";
import { Rocket } from "lucide-react";
import { useChatStream } from "@/hooks/useChatStream";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";

interface Props {
  sessionId: string;
  /** Bumped by the sidebar when the user switches sessions or starts a new chat. */
  resetKey: number;
  replayExisting: boolean;
  onFirstMessageSent: () => void;
}

export function Chat({ sessionId, resetKey, replayExisting, onFirstMessageSent }: Props): JSX.Element {
  const { messages, isStreaming, error, send, resetForSession } = useChatStream(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef(messages.length === 0);

  // Session switches are driven from the sidebar via resetKey so the hook can
  // abort an in-flight stream before loading new history.
  useEffect(() => {
    void resetForSession(sessionId, replayExisting);
  }, [sessionId, resetKey, replayExisting, resetForSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = async (text: string): Promise<void> => {
    const wasEmpty = emptyRef.current && messages.length === 0;
    await send(text);
    if (wasEmpty) onFirstMessageSent();
    emptyRef.current = false;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 ? <EmptyState /> : null}
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              turn={m}
              streaming={isStreaming && i === messages.length - 1 && m.role === "assistant"}
            />
          ))}
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSend={(m) => void handleSend(m)} disabled={isStreaming} streaming={isStreaming} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Grounded in a manned-spaceflight Wikipedia corpus. Citations open the source excerpt.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
        <Rocket className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-foreground">Ask about manned spaceflight</h2>
      <p className="text-sm">
        Missions (Apollo 11, STS-107), astronauts (Collins, Armstrong), spacecraft (CSM, Soyuz). Answers cite the
        sources they come from.
      </p>
    </div>
  );
}
