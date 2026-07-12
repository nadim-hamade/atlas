import type { ArxivPaper } from "@/lib/arxiv";

/** The ordered stages of the pipeline. Reader/writer/verifier land in later work. */
export type StageName = "planner" | "scout" | "reader" | "writer" | "verifier";

/** A focused sub-question the planner derives from the user's question. */
export interface SubQuery {
  id: string;
  text: string;
  rationale: string;
}

/** An arXiv paper carried through the pipeline with retrieval metadata. */
export interface ScoutPaper extends ArxivPaper {
  /** ids of the sub-queries whose search results surfaced this paper */
  matchedSubQueries: string[];
  /** 0..1 relevance to the original question; higher ranks first */
  relevance: number;
}

export interface PlannerInput {
  question: string;
}

export interface PlannerOutput {
  subQueries: SubQuery[];
}

export interface ScoutInput {
  question: string;
  subQueries: SubQuery[];
}

export interface ScoutOutput {
  papers: ScoutPaper[];
}

/** A citation-sized slice of a paper's abstract — the unit a claim will cite. */
export interface Chunk {
  /** stable id pointing at this exact chunk, e.g. "2503.16581v1#c2" */
  id: string;
  paperId: string;
  paperTitle: string;
  /** position of the chunk within its paper's abstract */
  index: number;
  text: string;
  /** 0..1 relevance to the question; higher first. 0 when embeddings are unavailable. */
  relevance: number;
}

export interface ReaderInput {
  question: string;
  papers: ScoutPaper[];
}

export interface ReaderOutput {
  chunks: Chunk[];
}

/** One statement in the answer, tied to the chunk(s) that support it. */
export interface Claim {
  id: string;
  text: string;
  /** chunk ids (from the reader) that support this claim; empty = uncited/ungrounded */
  citations: string[];
}

/** The survey-style answer: an ordered list of individually cited claims. */
export interface Answer {
  claims: Claim[];
}

export interface WriterInput {
  question: string;
  chunks: Chunk[];
}

export interface WriterOutput {
  answer: Answer;
}

/**
 * Progress events emitted as the pipeline runs. The shape maps directly onto
 * SSE messages once the streaming route exists, so the UI can watch each stage.
 */
export type PipelineEvent =
  | { type: "pipeline:start"; question: string }
  | { type: "stage:start"; stage: StageName }
  | { type: "stage:progress"; stage: StageName; message: string }
  | { type: "stage:done"; stage: StageName; durationMs: number }
  | { type: "planner:result"; subQueries: SubQuery[] }
  | { type: "scout:result"; papers: ScoutPaper[] }
  | { type: "reader:result"; chunks: Chunk[] }
  | { type: "writer:result"; answer: Answer }
  | { type: "pipeline:done" }
  | { type: "pipeline:error"; stage: StageName | null; message: string };

export type EmitFn = (event: PipelineEvent) => void;

/** Shared context handed to every stage. */
export interface StageContext {
  question: string;
  emit: EmitFn;
  signal?: AbortSignal;
}

/** A pipeline stage: pure typed input to typed output, plus progress reporting. */
export interface Stage<In, Out> {
  name: StageName;
  run(input: In, ctx: StageContext): Promise<Out>;
}

/** The final result of a run, growing as later stages are added. */
export interface PipelineResult {
  question: string;
  subQueries: SubQuery[];
  papers: ScoutPaper[];
  chunks: Chunk[];
  answer: Answer;
}
