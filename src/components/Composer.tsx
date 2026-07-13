"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/chat/format";
import { ArrowUpIcon, StopIcon } from "./icons";

const MAX = 200;
const MIN = 2;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  streaming: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to a ceiling, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSend = trimmed.length >= MIN && trimmed.length <= MAX && !streaming;
  const nearLimit = value.length > MAX - 40;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-1 px-4 py-3 transition-colors duration-200 focus-within:border-line-strong">
      <div className="flex items-end gap-3">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX}
          autoFocus={autoFocus}
          aria-label="Research question"
          placeholder="Ask a research question…"
          className="max-h-[200px] flex-1 resize-none bg-transparent font-serif text-[1.075rem] leading-relaxed text-ink outline-none placeholder:font-mono placeholder:text-[0.9rem] placeholder:text-ink-faint"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop the run"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:border-ink"
          >
            <StopIcon size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canSend && onSubmit()}
            disabled={!canSend}
            aria-label="Send"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all duration-200",
              canSend
                ? "bg-ink text-bg hover:opacity-90 active:scale-95"
                : "cursor-not-allowed border border-line text-ink-faint",
            )}
          >
            <ArrowUpIcon size={16} />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-mono text-[0.68rem] text-ink-faint">
          Enter to send · Shift+Enter for a new line
        </span>
        {nearLimit && (
          <span
            className={cn(
              "font-mono text-[0.68rem]",
              value.length >= MAX ? "text-ink-muted" : "text-ink-faint",
            )}
          >
            {value.length}/{MAX}
          </span>
        )}
      </div>
    </div>
  );
}
