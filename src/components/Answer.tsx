import type { RunState } from "@/lib/chat/types";
import type { Verdict } from "@/lib/pipeline/types";
import { citedSources, displayClaims } from "@/lib/chat/run";
import { baseArxiv } from "@/lib/chat/format";
import { Claim } from "./Claim";
import { ExternalLinkIcon } from "./icons";

function tally(claims: { verdict: Verdict }[]): string {
  const counts = { supported: 0, partial: 0, unsupported: 0 };
  for (const c of claims) counts[c.verdict]++;
  return (["supported", "partial", "unsupported"] as Verdict[])
    .filter((v) => counts[v] > 0)
    .map((v) => `${counts[v]} ${v}`)
    .join(" · ");
}

export function Answer({ run }: { run: RunState }) {
  const claims = displayClaims(run);
  if (!claims || claims.length === 0) return null;
  const sources = citedSources(run);

  return (
    <section className="mt-6" aria-label="Answer">
      <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink-muted">
          Answer
        </h3>
        <span className="font-mono text-[0.7rem] text-ink-faint">
          {claims.length} {claims.length === 1 ? "claim" : "claims"} · {tally(claims)}
        </span>
      </header>

      <div className="space-y-6">
        {claims.map((claim, i) => (
          <Claim key={claim.id} claim={claim} run={run} index={i} />
        ))}
      </div>

      {sources.length > 0 && (
        <div className="mt-8 border-t border-line pt-4">
          <h4 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink-muted">
            Sources
          </h4>
          <ul className="space-y-2">
            {sources.map((p) => (
              <li key={p.id}>
                <a
                  href={p.absUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-baseline gap-3 text-ink-muted transition-colors hover:text-ink"
                >
                  <span className="shrink-0 font-mono text-[0.72rem] text-ink-faint transition-colors group-hover:text-ink-muted">
                    arXiv:{baseArxiv(p.id)}
                  </span>
                  <span className="font-serif text-[0.95rem] leading-snug [text-wrap:pretty]">
                    {p.title}
                  </span>
                  <span className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLinkIcon size={12} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
