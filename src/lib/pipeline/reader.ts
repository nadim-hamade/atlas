import { embedTexts } from "@/lib/gemini";
import type { Chunk, ReaderInput, ReaderOutput, ScoutPaper, Stage } from "./types";
import { cosine } from "./vector";

/** Target chunk size in characters; abstracts are short, so keep chunks tight. */
const TARGET_CHARS = 400;

/** Split prose into sentences. Good enough for abstracts; over-splitting is harmless. */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** Greedily pack sentences into ~TARGET_CHARS chunks, respecting sentence boundaries. */
function chunkAbstract(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of splitSentences(clean)) {
    if (current && current.length + 1 + sentence.length > TARGET_CHARS) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [clean];
}

function toChunks(paper: ScoutPaper): Chunk[] {
  return chunkAbstract(paper.summary).map((text, index) => ({
    id: `${paper.id}#c${index}`,
    paperId: paper.id,
    paperTitle: paper.title,
    index,
    text,
    relevance: 0,
  }));
}

export const reader: Stage<ReaderInput, ReaderOutput> = {
  name: "reader",
  async run({ question, papers }, ctx) {
    ctx.emit({ type: "stage:progress", stage: "reader", message: "chunking abstracts" });

    const chunks = papers.flatMap(toChunks);
    if (chunks.length === 0) {
      ctx.emit({ type: "reader:result", chunks });
      return { chunks };
    }

    ctx.emit({ type: "stage:progress", stage: "reader", message: `embedding ${chunks.length} chunks` });
    const [queryEmbedding, chunkEmbeddings] = await Promise.all([
      embedTexts([question], "RETRIEVAL_QUERY"),
      embedTexts(chunks.map((c) => c.text), "RETRIEVAL_DOCUMENT"),
    ]);

    let ranked: Chunk[];
    if (!queryEmbedding || !chunkEmbeddings) {
      // Embeddings unavailable: keep scout's paper ordering (papers are already ranked).
      ctx.emit({
        type: "stage:progress",
        stage: "reader",
        message: "embeddings unavailable — keeping retrieval order",
      });
      ranked = chunks;
    } else {
      const queryVector = queryEmbedding[0];
      ranked = chunks
        .map((c, i) => ({ ...c, relevance: cosine(queryVector, chunkEmbeddings[i]) }))
        .sort((a, b) => b.relevance - a.relevance);
    }

    ctx.emit({ type: "reader:result", chunks: ranked });
    return { chunks: ranked };
  },
};
