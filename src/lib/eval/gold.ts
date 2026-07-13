import type { GoldExample } from "./metrics";
import goldData from "./gold.json";

/**
 * The evaluation gold set: research questions paired with arXiv ids that a good
 * retrieval should surface. Data lives in `gold.json` (single source of truth,
 * also read by the harness in `scripts/run-eval.mjs`); each `titles` entry is a
 * human-readable label for the id beside it and is ignored here.
 *
 * Every id was taken from a real arXiv search (`scripts/curate-arxiv.mjs`) and
 * hand-checked for relevance — none are invented. Ids omit the version suffix;
 * `baseArxivId` normalizes retrieved ids before comparison. This is a small,
 * high-precision starting set: a paper is listed only when clearly on-topic, so
 * recall is measured against a strict bar. It grows over time.
 */
export const GOLD: GoldExample[] = goldData.map(({ id, question, relevantPaperIds }) => ({
  id,
  question,
  relevantPaperIds,
}));
