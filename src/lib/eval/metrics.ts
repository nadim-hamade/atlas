import type { Verdict } from "@/lib/pipeline/types";

/**
 * Evaluation primitives for the harness: gold-set format and the metrics
 * reported on the eval page. All functions are pure so they can be tested
 * without touching the pipeline or any API.
 */

/** One curated example: a question plus the arXiv ids known to be relevant. */
export interface GoldExample {
  id: string;
  question: string;
  /** arXiv ids (without version suffix) a good retrieval should surface */
  relevantPaperIds: string[];
}

/** Strip an arXiv version suffix ("2503.16581v2" -> "2503.16581"). */
export function baseArxivId(id: string): string {
  return id.replace(/v\d+$/, "");
}

/** Fraction of the top-k retrieved papers that are relevant. */
export function precisionAtK(retrievedIds: string[], relevantIds: string[], k: number): number {
  if (k <= 0) return 0;
  const relevant = new Set(relevantIds.map(baseArxivId));
  const topK = retrievedIds.slice(0, k).map(baseArxivId);
  if (topK.length === 0) return 0;
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / topK.length;
}

/** Fraction of the relevant papers that appear anywhere in the retrieval. */
export function recall(retrievedIds: string[], relevantIds: string[]): number {
  const relevant = new Set(relevantIds.map(baseArxivId));
  if (relevant.size === 0) return 0;
  const retrieved = new Set(retrievedIds.map(baseArxivId));
  let hits = 0;
  for (const id of relevant) if (retrieved.has(id)) hits += 1;
  return hits / relevant.size;
}

/** Verdict counts for a set of verified claims. */
export interface SupportBreakdown {
  total: number;
  supported: number;
  partial: number;
  unsupported: number;
  /** supported / total; 0 when there are no claims */
  supportRate: number;
}

export function supportBreakdown(verdicts: Verdict[]): SupportBreakdown {
  const counts = { supported: 0, partial: 0, unsupported: 0 };
  for (const v of verdicts) counts[v] += 1;
  const total = verdicts.length;
  return {
    total,
    ...counts,
    supportRate: total === 0 ? 0 : counts.supported / total,
  };
}
