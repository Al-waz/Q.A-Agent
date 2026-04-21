"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteSession, listSessions, type SessionSummary } from "@/lib/api";

interface Props {
  activeId: string;
  onSelect: (id: string, replay: boolean) => void;
  onNew: () => void;
  onClose: () => void;
  /** Bumped by the parent every time a turn is persisted so the list refreshes. */
  refreshKey: number;
}

export function SessionSidebar({ activeId, onSelect, onNew, onClose, refreshKey }: Props): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const handleDelete = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    try {
      await deleteSession(id);
    } catch {
      /* sidebar will just not shrink; user can retry */
    }
    if (id === activeId) onNew();
    else await refresh();
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/20 text-primary">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          Q&amp;A Agent
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse sidebar"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="mx-3 mb-3 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-accent"
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>
      <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Conversations
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <p className="px-2 py-6 text-xs text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-6 text-xs text-muted-foreground">No chats yet. Ask something to start.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id, true)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition hover:bg-accent",
                    s.id === activeId ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="flex-1 truncate">{s.title}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => void handleDelete(s.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleDelete(s.id, e as unknown as React.MouseEvent);
                      }
                    }}
                    aria-label={`Delete chat: ${s.title}`}
                    className="hidden rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive group-hover:inline-flex"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        Sessions are in-memory; restarting the API clears them.
      </div>
    </aside>
  );
}
