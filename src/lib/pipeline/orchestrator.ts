import { planner } from "./planner";
import { reader } from "./reader";
import { scout } from "./scout";
import type { EmitFn, PipelineResult, Stage, StageContext } from "./types";

/** Wrap a stage with start/done events and stage-scoped error reporting. */
async function runStage<In, Out>(
  stage: Stage<In, Out>,
  input: In,
  ctx: StageContext,
): Promise<Out> {
  ctx.emit({ type: "stage:start", stage: stage.name });
  const startedAt = Date.now();
  try {
    const output = await stage.run(input, ctx);
    ctx.emit({ type: "stage:done", stage: stage.name, durationMs: Date.now() - startedAt });
    return output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.emit({ type: "pipeline:error", stage: stage.name, message });
    throw err;
  }
}

/**
 * Run the pipeline for a question, emitting progress as it goes. Currently
 * wires planner -> scout -> reader; writer and verifier append to this chain as
 * they are built. Throws if a stage fails (the error is emitted first).
 */
export async function runPipeline(
  question: string,
  emit: EmitFn,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const ctx: StageContext = { question, emit, signal };

  emit({ type: "pipeline:start", question });

  const { subQueries } = await runStage(planner, { question }, ctx);
  emit({ type: "planner:result", subQueries });

  const { papers } = await runStage(scout, { question, subQueries }, ctx);

  const { chunks } = await runStage(reader, { question, papers }, ctx);

  emit({ type: "pipeline:done" });
  return { question, subQueries, papers, chunks };
}
