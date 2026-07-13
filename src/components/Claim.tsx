"use client";

import { useMemo, useState } from "react";
import type { VerifiedClaim } from "@/lib/pipeline/types";
import type { RunState } from "@/lib/chat/types";
import { resolveCitations } from "@/lib/chat/run";
import { baseArxiv, cn } from "@/lib/chat/format";
import { CitationChip } from "./CitationChip";
import { VerdictBadge } from "./VerdictBadge";
import { ChevronIcon } from "./icons";

const TEXT_TONE: Record<VerifiedClaim["verdict"], string> = {
  supported: "text-ink",
  partial: "text-ink-body",
  unsupported:
    "text-ink-faint underline decoration-dotted decoration-ink-faint underline-offset-[5px]",
};

export function Claim({
  claim,
  run,
  index,
}: {
  claim: VerifiedClaim;
  run: RunState;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  const evidence = useMemo(
    () => resolveCitations(run, claim.citations),
    [run, claim.citations],
  );

  // One chip per distinct paper the claim leans on.
  const papers = useMemo(() => {
    const seen = new Set<string>();
    return evidence
      .filter((e) => e.paper && !seen.has(e.paper.id) && seen.add(e.paper.id))
      .map((e) => e.paper!);
  }, [evidence]);

  const showNote = claim.verdict !== "supported" && claim.note;

  return (
    <div className="rise-in" style={{ animationDelay: `${index * 45}ms` }}>
      <p
        className={cn(
          "font-serif text-[1.15rem] leading-[1.6] [text-wrap:pretty]",
          TEXT_TONE[claim.verdict],
        )}
      >
        {claim.text}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <VerdictBadge verdict={claim.verdict} />
        {papers.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5">
            {papers.map((p) => (
              <CitationChip key={p.id} paper={p} />
            ))}
          </span>
        )}
        {evidence.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint transition-colors hover:text-ink-muted"
          >
            evidence
            <span
              className={cn(
                "transition-transform duration-200",
                open && "rotate-180",
              )}
            >
              <ChevronIcon size={13} />
            </span>
          </button>
        )}
      </div>

      {showNote && (
        <p className="mt-1.5 font-mono text-[0.75rem] leading-relaxed text-ink-muted">
          {claim.note}
        </p>
      )}

      {open && evidence.length > 0 && (
        <div className="fade-in mt-3 space-y-3 border-l border-line pl-4">
          {evidence.map(({ chunk, paper }) => (
            <figure key={chunk.id} className="space-y-1">
              <figcaption className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[0.7rem] text-ink-faint">
                  arXiv:{baseArxiv(chunk.paperId)}
                </span>
                <span className="font-serif text-[0.9rem] italic text-ink-muted">
                  {paper?.title ?? chunk.paperTitle}
                </span>
              </figcaption>
              <blockquote className="font-serif text-[0.95rem] leading-relaxed text-ink-body">
                “{chunk.text}”
              </blockquote>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
