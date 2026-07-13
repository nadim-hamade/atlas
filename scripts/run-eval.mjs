// Evaluation harness.
//
// Runs gold-set questions through the real /api/ask pipeline (the production
// interface, so this measures what the app actually does), then reports
// retrieval quality (precision@k, recall of the scout stage against the gold
// ids) and answer quality (verifier support rate). Results are written to JSON
// and printed as a table.
//
//   node scripts/run-eval.mjs --base http://localhost:3002 --limit 2 --out eval-results.json
//
// Notes:
//   * A full run costs Gemini quota (one full pipeline per question) and hits
//     the API rate limit (4 runs / 10 min / IP), so it waits out 429s. Keep
//     --limit small unless you mean to run the whole set.
//   * The metric helpers below mirror src/lib/eval/metrics.ts.

import { readFileSync, writeFileSync } from "node:fs";

const GOLD = JSON.parse(
  readFileSync(new URL("../src/lib/eval/gold.json", import.meta.url), "utf8"),
);

// ---- args ---------------------------------------------------------------
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const BASE = arg("base", process.env.ATLAS_BASE ?? "http://localhost:3002");
const LIMIT = Number(arg("limit", String(GOLD.length)));
const OUT = arg("out", "eval-results.json");
const KS = [5, 10];

// ---- metric helpers (mirror src/lib/eval/metrics.ts) --------------------
const baseArxivId = (id) => id.replace(/v\d+$/, "");

function precisionAtK(retrieved, relevant, k) {
  if (k <= 0) return 0;
  const rel = new Set(relevant.map(baseArxivId));
  const topK = retrieved.slice(0, k).map(baseArxivId);
  if (topK.length === 0) return 0;
  return topK.filter((id) => rel.has(id)).length / topK.length;
}

function recall(retrieved, relevant) {
  const rel = new Set(relevant.map(baseArxivId));
  if (rel.size === 0) return 0;
  const got = new Set(retrieved.map(baseArxivId));
  let hits = 0;
  for (const id of rel) if (got.has(id)) hits += 1;
  return hits / rel.size;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n) => Math.round(n * 1000) / 1000;

// ---- one pipeline run over SSE ------------------------------------------
async function runOne(question) {
  const url = `${BASE}/api/ask?q=${encodeURIComponent(question)}`;
  const res = await fetch(url, { headers: { accept: "text/event-stream" } });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    const retryAfter = Number(res.headers.get("retry-after")) || 0;
    return { error: message, status: res.status, retryAfter };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let retrievedIds = [];
  let verdicts = [];
  let pipelineError = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i;
    while ((i = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (event.type === "scout:result") {
        retrievedIds = event.papers.map((p) => p.id);
      } else if (event.type === "verifier:result") {
        verdicts = event.verifiedAnswer.claims.map((c) => c.verdict);
      } else if (event.type === "pipeline:error") {
        pipelineError = event.message;
      }
    }
  }

  return { retrievedIds, verdicts, pipelineError };
}

// ---- main ---------------------------------------------------------------
async function main() {
  const questions = GOLD.slice(0, LIMIT);
  console.log(`Evaluating ${questions.length}/${GOLD.length} questions against ${BASE}\n`);

  const perQuestion = [];

  for (let q = 0; q < questions.length; q++) {
    const gold = questions[q];
    process.stdout.write(`[${q + 1}/${questions.length}] ${gold.id} … `);

    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await runOne(gold.question);
      if (result.status === 429) {
        const wait = Math.min((result.retryAfter || 60) + 2, 900);
        console.log(`rate-limited, waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      break;
    }

    if (result.error) {
      console.log(`error: ${result.error}`);
      perQuestion.push({ id: gold.id, question: gold.question, error: result.error });
      continue;
    }

    const counts = { supported: 0, partial: 0, unsupported: 0 };
    for (const v of result.verdicts) counts[v] = (counts[v] ?? 0) + 1;
    const claims = result.verdicts.length;

    const row = {
      id: gold.id,
      question: gold.question,
      relevant: gold.relevantPaperIds.length,
      retrieved: result.retrievedIds.length,
      precisionAt5: round(precisionAtK(result.retrievedIds, gold.relevantPaperIds, 5)),
      precisionAt10: round(precisionAtK(result.retrievedIds, gold.relevantPaperIds, 10)),
      recall: round(recall(result.retrievedIds, gold.relevantPaperIds)),
      claims,
      ...counts,
      supportRate: claims ? round(counts.supported / claims) : 0,
      pipelineError: result.pipelineError ?? undefined,
    };
    perQuestion.push(row);
    console.log(
      `p@5=${row.precisionAt5} recall=${row.recall} support=${row.supportRate} (${claims} claims)`,
    );
  }

  const scored = perQuestion.filter((r) => !r.error);
  const mean = (key) =>
    scored.length ? round(scored.reduce((s, r) => s + (r[key] ?? 0), 0) / scored.length) : 0;
  const totalClaims = scored.reduce((s, r) => s + (r.claims ?? 0), 0);
  const totalSupported = scored.reduce((s, r) => s + (r.supported ?? 0), 0);

  const aggregate = {
    questions: scored.length,
    skipped: perQuestion.length - scored.length,
    meanPrecisionAt5: mean("precisionAt5"),
    meanPrecisionAt10: mean("precisionAt10"),
    meanRecall: mean("recall"),
    totalClaims,
    supportRate: totalClaims ? round(totalSupported / totalClaims) : 0,
  };

  const report = { generatedAt: new Date().toISOString(), base: BASE, ks: KS, aggregate, perQuestion };
  writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log(`\n${"question".padEnd(22)} p@5    p@10   recall support`);
  for (const r of perQuestion) {
    if (r.error) {
      console.log(`${r.id.padEnd(22)} (${r.error})`);
      continue;
    }
    console.log(
      `${r.id.padEnd(22)} ${String(r.precisionAt5).padEnd(6)} ${String(r.precisionAt10).padEnd(6)} ${String(r.recall).padEnd(6)} ${r.supportRate}`,
    );
  }
  console.log(
    `\nMEAN over ${aggregate.questions}: p@5=${aggregate.meanPrecisionAt5} p@10=${aggregate.meanPrecisionAt10} recall=${aggregate.meanRecall} support=${aggregate.supportRate}`,
  );
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
