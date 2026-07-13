import type {
  Chunk,
  PipelineEvent,
  ScoutPaper,
  StageName,
  VerifiedClaim,
} from "@/lib/pipeline/types";
import type { RunState, StageState } from "./types";

/** The pipeline's fixed order — the timeline the UI renders top to bottom. */
export const STAGE_ORDER: StageName[] = [
  "planner",
  "scout",
  "reader",
  "writer",
  "verifier",
];

/** Human-facing one-liners for what each stage does. */
export const STAGE_LABEL: Record<StageName, string> = {
  planner: "Planning sub-questions",
  scout: "Retrieving arXiv papers",
  reader: "Reading & chunking abstracts",
  writer: "Drafting a cited answer",
  verifier: "Auditing every citation",
};

export function initialRun(): RunState {
  return {
    status: "streaming",
    stages: STAGE_ORDER.map((name) => ({ name, status: "pending" })),
    subQueries: [],
    papers: [],
    chunks: [],
    answer: null,
    verifiedAnswer: null,
  };
}

function patchStage(
  stages: StageState[],
  name: StageName,
  patch: Partial<StageState>,
): StageState[] {
  return stages.map((s) => (s.name === name ? { ...s, ...patch } : s));
}

/** Fold one pipeline event into run state. Pure — returns a new object. */
export function reduceEvent(run: RunState, event: PipelineEvent): RunState {
  switch (event.type) {
    case "pipeline:start":
      return { ...initialRun(), status: "streaming" };
    case "stage:start":
      return { ...run, stages: patchStage(run.stages, event.stage, { status: "active" }) };
    case "stage:progress":
      return {
        ...run,
        stages: patchStage(run.stages, event.stage, { message: event.message }),
      };
    case "stage:done":
      return {
        ...run,
        stages: patchStage(run.stages, event.stage, {
          status: "done",
          durationMs: event.durationMs,
        }),
      };
    case "planner:result":
      return { ...run, subQueries: event.subQueries };
    case "scout:result":
      return { ...run, papers: event.papers };
    case "reader:result":
      return { ...run, chunks: event.chunks };
    case "writer:result":
      return { ...run, answer: event.answer };
    case "verifier:result":
      return { ...run, verifiedAnswer: event.verifiedAnswer };
    case "pipeline:done":
      return { ...run, status: "done" };
    case "pipeline:error":
      return {
        ...run,
        status: "error",
        errorKind: "pipeline",
        error: event.message,
        stages: event.stage
          ? patchStage(run.stages, event.stage, { status: "error" })
          : run.stages,
      };
    default:
      return run;
  }
}

/** A short session title from the first question. */
export function deriveTitle(question: string): string {
  const trimmed = question.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 48) return trimmed;
  return trimmed.slice(0, 47).trimEnd() + "…";
}

/** Lookup maps for resolving a claim's chunk-id citations back to sources. */
export function chunkIndex(run: RunState): Map<string, Chunk> {
  return new Map(run.chunks.map((c) => [c.id, c]));
}

export function paperIndex(run: RunState): Map<string, ScoutPaper> {
  return new Map(run.papers.map((p) => [p.id, p]));
}

export interface ResolvedCitation {
  chunk: Chunk;
  paper?: ScoutPaper;
}

/** Resolve the chunk ids a claim cites into chunk + owning paper. */
export function resolveCitations(
  run: RunState,
  citations: string[],
): ResolvedCitation[] {
  const chunks = chunkIndex(run);
  const papers = paperIndex(run);
  const seen = new Set<string>();
  const out: ResolvedCitation[] = [];
  for (const id of citations) {
    if (seen.has(id)) continue;
    seen.add(id);
    const chunk = chunks.get(id);
    if (!chunk) continue;
    out.push({ chunk, paper: papers.get(chunk.paperId) });
  }
  return out;
}

/**
 * The claims to render. Prefer the verifier's audited claims; fall back to the
 * writer's raw claims (no verdict) if a run ended before verification.
 */
export function displayClaims(run: RunState): VerifiedClaim[] | null {
  if (run.verifiedAnswer) return run.verifiedAnswer.claims;
  if (run.answer) {
    return run.answer.claims.map((c) => ({
      ...c,
      verdict: "partial" as const,
      note: "shown before verification completed",
    }));
  }
  return null;
}

/** The distinct papers actually cited across the answer, in first-seen order. */
export function citedSources(run: RunState): ScoutPaper[] {
  const claims = displayClaims(run);
  if (!claims) return [];
  const chunks = chunkIndex(run);
  const papers = paperIndex(run);
  const seen = new Set<string>();
  const out: ScoutPaper[] = [];
  for (const claim of claims) {
    for (const cid of claim.citations) {
      const chunk = chunks.get(cid);
      if (!chunk) continue;
      const paper = papers.get(chunk.paperId);
      if (!paper || seen.has(paper.id)) continue;
      seen.add(paper.id);
      out.push(paper);
    }
  }
  return out;
}
