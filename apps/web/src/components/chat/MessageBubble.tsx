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
            renderWithCitations(turn.content, turn.citations ?? [])
          )}
          {streaming && !isUser && turn.content.length > 0 ? (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current align-middle" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Walk the answer text and swap each `[n]` marker for a CitationPill when
 * the citations block has a matching id. Unmatched markers render as plain
 * text — safer than hiding them if the structured extractor missed one.
 */
function renderWithCitations(text: string, citations: Citation[]): React.ReactNode[] {
  if (citations.length === 0) return [text];
  const byId = new Map(citations.map((c) => [c.id, c] as const));
  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const citation = byId.get(Number(match[1]));
    if (citation) {
      parts.push(<CitationPill key={`c-${match.index}`} citation={citation} />);
    } else {
      parts.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Dot({ delay }: { delay: number }): JSX.Element {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
      style={{ animation: `qa-blink 1.2s ${delay}ms infinite ease-in-out` }}
    />
  );
}
