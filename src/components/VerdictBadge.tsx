import type { Verdict } from "@/lib/pipeline/types";
import { cn } from "@/lib/chat/format";

/** Filled / half / hollow disc — verdict by shape, never by color. */
function VerdictGlyph({ verdict, size = 13 }: { verdict: Verdict; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {verdict === "supported" && <circle cx="8" cy="8" r="5" fill="currentColor" />}
      {verdict === "partial" && (
        <>
          <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 3.6 A4.4 4.4 0 0 1 8 12.4 Z" fill="currentColor" />
        </>
      )}
      {verdict === "unsupported" && (
        <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      )}
    </svg>
  );
}

const TONE: Record<Verdict, string> = {
  supported: "text-ink",
  partial: "text-ink-body",
  unsupported: "text-ink-faint",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.08em]",
        TONE[verdict],
      )}
    >
      <VerdictGlyph verdict={verdict} />
      {verdict}
    </span>
  );
}
