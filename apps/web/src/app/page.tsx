"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { Chat } from "@/components/chat/Chat";
import { SessionSidebar } from "@/components/sidebar/SessionSidebar";

const STORAGE_KEY = "qa-agent:activeSessionId";
const SIDEBAR_KEY = "qa-agent:sidebarOpen";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export default function Home(): JSX.Element {
  const [sessionId, setSessionId] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [replayExisting, setReplayExisting] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Hydrate from localStorage on mount so a refresh lands back on the same chat.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const id = stored ?? generateSessionId();
    setSessionId(id);
    setReplayExisting(Boolean(stored));
    if (!stored && typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
    const storedSidebar = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_KEY) : null;
    if (storedSidebar !== null) setSidebarOpen(storedSidebar === "1");
  }, []);

  const persistSidebar = (open: boolean): void => {
    setSidebarOpen(open);
    if (typeof window !== "undefined") window.localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
  };

  const handleSelect = useCallback((id: string, replay: boolean) => {
    setSessionId(id);
    setReplayExisting(replay);
    setResetKey((k) => k + 1);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const handleNew = useCallback(() => {
    const id = generateSessionId();
    setSessionId(id);
    setReplayExisting(false);
    setResetKey((k) => k + 1);
    setSidebarRefresh((k) => k + 1);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const handleFirstMessageSent = useCallback(() => {
    // New session now has a persisted title on the server — refresh the sidebar.
    setSidebarRefresh((k) => k + 1);
  }, []);

  if (!sessionId) return <div className="h-screen bg-background" />;

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen ? (
        <SessionSidebar
          activeId={sessionId}
          onSelect={handleSelect}
          onNew={handleNew}
          onClose={() => persistSidebar(false)}
          refreshKey={sidebarRefresh}
        />
      ) : null}
      <section className="relative flex min-w-0 flex-1 flex-col">
        {!sidebarOpen ? (
          <button
            type="button"
            onClick={() => persistSidebar(true)}
            aria-label="Open sidebar"
            className="absolute left-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : null}
        <Chat
          sessionId={sessionId}
          resetKey={resetKey}
          replayExisting={replayExisting}
          onFirstMessageSent={handleFirstMessageSent}
        />
      </section>
    </main>
  );
}
