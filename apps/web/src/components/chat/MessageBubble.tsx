"use client";

import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Citation } from "@qa/schemas";
import type { ChatTurn } from "@/hooks/useChatStream";
import { CitationPill } from "./CitationPill";
import { ToolCallBadge } from "./ToolCallBadge";

export function MessageBubble({ turn, streaming }: { turn: ChatTurn; streaming: boolean }): JSX.Element {
  const isUser = turn.role === "user";
  const streamingText = streaming && !turn.textDone;
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
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
            isUser
              ? "whitespace-pre-wrap bg-primary text-primary-foreground"
              : "border border-border bg-card text-card-foreground",
          )}
        >
          {turn.content.length === 0 && streaming && !isUser ? (
            <span className="inline-flex gap-1 py-1">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </span>
          ) : isUser ? (
            turn.content
          ) : (
            <AssistantMarkdown
              text={turn.content}
              citations={turn.citations ?? []}
              streamingText={streamingText}
            />
          )}
          {streamingText && !isUser && turn.content.length > 0 ? (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current align-middle" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Markdown renderer for assistant answers. Delegates block layout to
 * react-markdown (+ remark-gfm for tables / task lists / strikethrough) and
 * walks the inline children of every element to swap `[N]` citation markers
 * for clickable pills — or inert placeholders while `streamingText` is true
 * and citations haven't arrived yet.
 *
 * While tokens are still flowing we also strip a dangling trailing `[` or
 * `[12` so the partial marker never flashes as raw text between one streamed
 * chunk and the next. Combined with markdown's natural handling of unclosed
 * `**…` / `_…_` mid-stream, the result feels indistinguishable from a
 * finalized message.
 */
function AssistantMarkdown({
  text,
  citations,
  streamingText,
}: {
  text: string;
  citations: Citation[];
  streamingText: boolean;
}): JSX.Element {
  const effective = streamingText ? text.replace(/\[\d*$/, "") : text;
  const byId = new Map(citations.map((c) => [c.id, c] as const));

  const inline = (children: ReactNode): ReactNode => {
    if (typeof children === "string") return injectCitations(children, byId);
    if (Array.isArray(children)) {
      return children.map((c, i) => <Fragment key={i}>{inline(c)}</Fragment>);
    }
    return children;
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{inline(children)}</p>,
          strong: ({ children }) => <strong className="font-semibold">{inline(children)}</strong>,
          em: ({ children }) => <em className="italic">{inline(children)}</em>,
          code: ({ children }) => (
            <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-md bg-muted/60 p-2 text-xs">{children}</pre>
          ),
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{inline(children)}</li>,
          h1: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold">{inline(children)}</h3>,
          h2: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold">{inline(children)}</h3>,
          h3: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold">{inline(children)}</h4>,
          h4: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold">{inline(children)}</h4>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-primary"
            >
              {inline(children)}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted/40 px-2 py-1 text-left font-semibold">{inline(children)}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{inline(children)}</td>
          ),
        }}
      >
        {effective}
      </ReactMarkdown>
    </div>
  );
}

function injectCitations(text: string, byId: Map<number, Citation>): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  const re = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const id = Number(match[1]);
    const citation = byId.get(id);
    if (citation) {
      parts.push(<CitationPill key={`c-${match.index}-${id}`} citation={citation} />);
    } else {
      parts.push(<PendingCitationPill key={`p-${match.index}-${id}`} id={id} />);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return text;
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
