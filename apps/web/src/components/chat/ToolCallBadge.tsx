import { Loader2, Search, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/hooks/useChatStream";

/**
 * Inline badge showing a single agent tool call. Pulses while the tool is
 * running and swaps to a check mark + its returned row count on completion.
 * Kept intentionally small — one line, no panel, since multiple may stack.
 */
export function ToolCallBadge({ call }: { call: ToolCall }): JSX.Element {
  const Icon = call.name === "searchDocuments" ? Search : call.name === "getDocumentSummary" ? BookOpen : Search;
  const running = call.status === "running";
  const summary = summarizeArgs(call.name, call.args);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        running
          ? "border-primary/40 bg-primary/5 text-foreground animate-pulse"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono">{call.name}</span>
      {summary ? <span className="truncate opacity-80">{summary}</span> : null}
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin opacity-70" />
      ) : (
        <Check className="h-3 w-3 text-emerald-500/80" />
      )}
    </div>
  );
}

function summarizeArgs(name: string, args: unknown): string {
  if (args == null || typeof args !== "object") return "";
  const obj = args as Record<string, unknown>;
  if (name === "searchDocuments" && typeof obj.query === "string") {
    const extra = typeof obj.sourceType === "string" ? ` · ${obj.sourceType}` : "";
    return `“${truncate(obj.query, 48)}”${extra}`;
  }
  if (name === "getDocumentSummary" && typeof obj.sourceTitle === "string") {
    return `“${truncate(obj.sourceTitle, 48)}”`;
  }
  return "";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
