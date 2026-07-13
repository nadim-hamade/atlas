import type {
  Answer,
  Chunk,
  ScoutPaper,
  StageName,
  SubQuery,
  VerifiedAnswer,
} from "@/lib/pipeline/types";

/** Lifecycle of a single question's pipeline run, from the client's view. */
export type RunStatus = "streaming" | "done" | "error" | "aborted";

export type StageStatus = "pending" | "active" | "done" | "error";

/** How a run ended when it failed — drives which recovery message we show. */
export type ErrorKind =
  | "ratelimit"
  | "busy"
  | "validation"
  | "pipeline"
  | "network";

export interface StageState {
  name: StageName;
  status: StageStatus;
  /** latest progress line from the stage */
  message?: string;
  /** wall-clock ms once the stage is done */
  durationMs?: number;
}

/**
 * Everything the UI knows about one run. While streaming this lives in memory
 * and updates per event; once terminal it is snapshotted onto the message and
 * persisted, so reloads render the result without re-running the pipeline.
 */
export interface RunState {
  status: RunStatus;
  stages: StageState[];
  subQueries: SubQuery[];
  papers: ScoutPaper[];
  chunks: Chunk[];
  /** the writer's raw answer; kept as a fallback when the verifier didn't run */
  answer: Answer | null;
  /** the verified answer — the thing we show when present */
  verifiedAnswer: VerifiedAnswer | null;
  error?: string;
  errorKind?: ErrorKind;
  retryAfterS?: number;
}

/** One turn: a question and the run it produced. */
export interface Message {
  id: string;
  question: string;
  createdAt: number;
  run: RunState;
}

/** A conversation thread, persisted locally. */
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}
