"use client";

import * as Popover from "@radix-ui/react-popover";
import type { Citation } from "@qa/schemas";

/**
 * Clickable `[n]` marker. Popover surfaces the cited excerpt + its source
 * title so readers can verify a claim without leaving the stream.
 */
export function CitationPill({ citation }: { citation: Citation }): JSX.Element {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-primary/40 bg-primary/10 px-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Citation ${citation.id}: ${citation.sourceTitle}`}
        >
          {citation.id}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md outline-none"
          sideOffset={6}
        >
          <div className="mb-1 font-semibold">{citation.sourceTitle}</div>
          <p className="text-muted-foreground leading-relaxed">{citation.excerpt}</p>
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
