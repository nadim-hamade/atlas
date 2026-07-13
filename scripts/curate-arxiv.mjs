// Curation helper for the evaluation gold set.
//
// For each seed question it runs a real arXiv search and prints the candidate
// papers (id + title). Relevant ids for the gold set are then hand-picked from
// this output — ids are never invented. Run from the project root:
//
//   node scripts/curate-arxiv.mjs
//
// Be polite to the arXiv API: one request every few seconds, small result sets.

import { XMLParser } from "fast-xml-parser";

const ARXIV_API = "https://export.arxiv.org/api/query";
const DELAY_MS = 3200;
const MAX_RESULTS = 12;

// Each seed pairs the gold question with the search terms used to gather
// candidates. Edit freely while curating.
const SEEDS = [
  { id: "kv-cache-latency", query: "KV cache compression LLM inference latency" },
  { id: "rag-hallucination", query: "reducing hallucination retrieval augmented generation" },
  { id: "long-context", query: "extending context length transformer long context" },
  { id: "speculative-decoding", query: "speculative decoding accelerate LLM inference" },
  { id: "peft-lora", query: "parameter efficient fine-tuning large language model LoRA" },
  { id: "rlhf-alignment", query: "reinforcement learning human feedback align language model" },
  { id: "mixture-of-experts", query: "mixture of experts scaling language model" },
  { id: "quantization-memory", query: "quantization large language model memory footprint" },
  { id: "prompt-injection", query: "prompt injection attack defense large language model" },
  { id: "chain-of-thought", query: "chain of thought prompting reasoning language model" },
];

const parser = new XMLParser({ ignoreAttributes: false });

function collapse(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function baseArxivId(id) {
  return id.replace(/v\d+$/, "");
}

async function search(query) {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(MAX_RESULTS),
    sortBy: "relevance",
  });
  const res = await fetch(`${ARXIV_API}?${params}`);
  if (!res.ok) throw new Error(`arxiv responded ${res.status}`);
  const doc = parser.parse(await res.text());
  return asArray(doc?.feed?.entry).map((entry) => {
    const absUrl = entry.id ?? "";
    const rawId = absUrl.split("/abs/")[1] ?? absUrl;
    return { id: baseArxivId(rawId), title: collapse(entry.title) };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i];
    try {
      const papers = await search(seed.query);
      console.log(`\n### ${seed.id}  —  "${seed.query}"`);
      for (const p of papers) {
        console.log(`  ${p.id.padEnd(12)}  ${p.title}`);
      }
    } catch (err) {
      console.log(`\n### ${seed.id}  —  ERROR: ${err.message}`);
    }
    if (i < SEEDS.length - 1) await sleep(DELAY_MS);
  }
}

main();
