"use client";

/**
 * Chat shell. Phase 6 wires this to the NestJS /chat stream using
 * `@ai-sdk/react`'s `useChat` hook with the AI SDK Data Stream Protocol,
 * renders markdown + citation popovers, and persists sessionId in
 * localStorage.
 *
 * For Phase 1 this is a placeholder so `pnpm dev` produces a working page.
 */
export function Chat(): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium">Chat UI wiring arrives in Phase 6.</p>
        <p className="text-xs text-muted-foreground">
          Backend <code>POST /chat</code> comes online in Phase 3; this component will consume its stream via{" "}
          <code>useChat</code>.
        </p>
      </div>
    </div>
  );
}
