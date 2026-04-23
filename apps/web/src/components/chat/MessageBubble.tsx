"use client";

import { cn } from "@/lib/utils";
import type { Citation } from "@qa/schemas";
import type { ChatTurn } from "@/hooks/useChatStream";
import { CitationPill } from "./CitationPill";
import { ToolCallBadge } from "./ToolCallBadge";

export function MessageBubble({ turn, streaming }: { turn: ChatTurn; streaming: boolean }): JSX.Element {
  const isUser = turn.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser ? "items-end" : "items-start")}>
        {!isUser && turn.toolCalls && turn.toolCalls.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {turn.toolCalls.map((tc) => (
              <ToolCallBadge key={tc.id} call={tc} />
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-card-foreground",
          )}
        >
          {turn.content.length === 0 && streaming && !isUser ? (
            <span className="inline-flex gap-1 py-1">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </span>
          ) : (
            renderWithCitations(turn.content, turn.citations ?? [], streaming && !turn.textDone)
          )}
          {streaming && !isUser && turn.content.length > 0 && !turn.textDone ? (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current align-middle" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Walk the answer text and swap each `[n]` marker for a pill. If citation
 * data is already attached to the turn, render a clickable CitationPill;
 * otherwise render a visually-identical placeholder. This avoids the flash
 * of raw `[n]` text during the gap between tokens finishing and the
 * citations event arriving.
 *
 * When `streamingText` is true (tokens still flowing), we also strip any
 * trailing incomplete `[` or `[123` at the very end of the text so the
 * partial marker doesn't show as raw characters before the closing `]`
 * token arrives and swaps it for a pill.
 */
function renderWithCitations(
  text: string,
  citations: Citation[],
  streamingText: boolean,
): React.ReactNode[] {
  const effective = streamingText ? text.replace(/\[\d*$/, "") : text;
  const byId = new Map(citations.map((c) => [c.id, c] as const));
  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(effective)) !== null) {
    if (match.index > last) parts.push(effective.slice(last, match.index));
    const id = Number(match[1]);
    const citation = byId.get(id);
    if (citation) {
      parts.push(<CitationPill key={`c-${match.index}`} citation={citation} />);
    } else {
      parts.push(<PendingCitationPill key={`p-${match.index}`} id={id} />);
    }
    last = match.index + match[0].length;
  }
  if (last < effective.length) parts.push(effective.slice(last));
  return parts;
}

function PendingCitationPill({ id }: { id: number }): JSX.Element {
  return (
    <span
      aria-label={`Citation ${id} (loading)`}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/5 px-1.5 text-[11px] font-semibold text-primary/70"
    >
      {id}
    </span>
  );
}

function Dot({ delay }: { delay: number }): JSX.Element {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
      style={{ animation: `qa-blink 1.2s ${delay}ms infinite ease-in-out` }}
    />
  );
}
