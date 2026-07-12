import { searchArxiv } from "@/lib/arxiv";
import { embedTexts } from "@/lib/gemini";
import type { ScoutInput, ScoutOutput, ScoutPaper, Stage, StageContext } from "./types";
import { cosine } from "./vector";

const RESULTS_PER_SUB_QUERY = 8;
const FINAL_LIMIT = 12;
/** arXiv asks for >= 3s between requests; be a polite citizen. */
const ARXIV_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rank papers by embedding similarity to the original question. If embeddings
 * are unavailable (rate limit, retired model, network), degrade to a coverage
 * score: papers surfaced by more sub-queries rank higher. Honest, never broken.
 */
async function rerank(
  question: string,
  papers: ScoutPaper[],
  subQueryCount: number,
  ctx: StageContext,
): Promise<ScoutPaper[]> {
  if (papers.length === 0) return papers;

  ctx.emit({ type: "stage:progress", stage: "scout", message: "ranking papers by relevance" });

  const docs = papers.map((p) => `${p.title}\n${p.summary}`);
  const [queryEmbedding, docEmbeddings] = await Promise.all([
    embedTexts([question], "RETRIEVAL_QUERY"),
    embedTexts(docs, "RETRIEVAL_DOCUMENT"),
  ]);

  if (!queryEmbedding || !docEmbeddings) {
    ctx.emit({
      type: "stage:progress",
      stage: "scout",
      message: "embeddings unavailable — ranking by sub-query coverage",
    });
    return papers
      .map((p) => ({ ...p, relevance: p.matchedSubQueries.length / Math.max(subQueryCount, 1) }))
      .sort((a, b) => b.relevance - a.relevance);
  }

  const queryVector = queryEmbedding[0];
  return papers
    .map((p, i) => ({ ...p, relevance: cosine(queryVector, docEmbeddings[i]) }))
    .sort((a, b) => b.relevance - a.relevance);
}

export const scout: Stage<ScoutInput, ScoutOutput> = {
  name: "scout",
  async run({ question, subQueries }, ctx) {
    const byId = new Map<string, ScoutPaper>();

    for (let i = 0; i < subQueries.length; i++) {
      const sq = subQueries[i];
      ctx.emit({ type: "stage:progress", stage: "scout", message: `searching: ${sq.text}` });

      const results = await searchArxiv(sq.text, { maxResults: RESULTS_PER_SUB_QUERY });
      for (const paper of results) {
        const existing = byId.get(paper.id);
        if (existing) {
          if (!existing.matchedSubQueries.includes(sq.id)) {
            existing.matchedSubQueries.push(sq.id);
          }
        } else {
          byId.set(paper.id, { ...paper, matchedSubQueries: [sq.id], relevance: 0 });
        }
      }

      if (i < subQueries.length - 1) await sleep(ARXIV_DELAY_MS);
    }

    const deduped = [...byId.values()];
    const ranked = await rerank(question, deduped, subQueries.length, ctx);
    const papers = ranked.slice(0, FINAL_LIMIT);

    ctx.emit({ type: "scout:result", papers });
    return { papers };
  },
};
