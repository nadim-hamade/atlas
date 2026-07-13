import type { ScoutPaper } from "@/lib/pipeline/types";
import { baseArxiv } from "@/lib/chat/format";
import { ExternalLinkIcon } from "./icons";

/** A monospace source marker linking to the arXiv abstract, title on hover. */
export function CitationChip({ paper }: { paper: ScoutPaper }) {
  return (
    <a
      href={paper.absUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open arXiv paper on arxiv.org: ${paper.title}`}
      className="group/chip relative inline-flex items-center gap-1 rounded-[3px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.72rem] leading-none text-ink-muted align-baseline transition-colors duration-150 hover:border-line-strong hover:text-ink focus-visible:text-ink"
    >
      arXiv:{baseArxiv(paper.id)}
      <ExternalLinkIcon size={11} />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-[var(--z-tooltip)] w-max max-w-[min(22rem,80vw)] origin-bottom-left scale-95 rounded-md border border-line-strong bg-surface-1 px-3 py-2 font-serif text-[0.85rem] leading-snug text-ink-body opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.9)] transition-all duration-150 group-hover/chip:scale-100 group-hover/chip:opacity-100 group-focus-visible/chip:scale-100 group-focus-visible/chip:opacity-100"
      >
        {paper.title}
      </span>
    </a>
  );
}
