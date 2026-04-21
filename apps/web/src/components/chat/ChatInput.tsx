"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
  streaming: boolean;
}

/**
 * Auto-growing textarea + submit. Enter sends, Shift+Enter inserts a newline
 * — the mental model most users already have from ChatGPT / Claude.
 */
export function ChatInput({ onSend, disabled, streaming }: Props): JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (): void => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="relative flex w-full items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about a mission, astronaut, or spacecraft…"
        rows={1}
        className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        aria-label="Send"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
          disabled || value.trim().length === 0
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </form>
  );
}
