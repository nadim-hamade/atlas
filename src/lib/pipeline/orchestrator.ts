import { planner } from "./planner";
import { reader } from "./reader";
import { scout } from "./scout";
import { verifier } from "./verifier";
import { writer } from "./writer";
import type { EmitFn, PipelineResult, Stage, StageContext } from "./types";

function throwIfAborted(ctx: StageContext): void {
  if (ctx.signal?.aborted) throw new Error("run aborted");
}

/**
 * Wrap a stage with start/done events and stage-scoped error reporting. Raw
 * errors are logged server-side only; clients get a generic message so
 * internals (model names, quotas, upstream failures) never leak.
 */
async function runStage<In, Out>(
  stage: Stage<In, Out>,
  input: In,
  ctx: StageContext,
): Promise<Out> {
  throwIfAborted(ctx);
  ctx.emit({ type: "stage:start", stage: stage.name });
  const startedAt = Date.now();
  try {
    const output = await stage.run(input, ctx);
    ctx.emit({ type: "stage:done", stage: stage.name, durationMs: Date.now() - startedAt });
    return output;
  } catch (err) {
    // An aborted run has no listener anymore — skip both logging noise and emit.
    if (ctx.signal?.aborted) throw err;
    console.error(`[pipeline] ${stage.name} stage failed:`, err);
    ctx.emit({
      type: "pipeline:error",
      stage: stage.name,
      message: `the ${stage.name} stage failed — please try again`,
    });
    throw err;
  }
}

/**
 * Run the pipeline for a question, emitting progress as it goes:
 * planner -> scout -> reader -> writer -> verifier. Throws if a stage fails
 * (the error is emitted first) or the signal aborts.
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

  const { answer } = await runStage(writer, { question, chunks }, ctx);

  const { verifiedAnswer } = await runStage(verifier, { answer, chunks }, ctx);

  emit({ type: "pipeline:done" });
  return { question, subQueries, papers, chunks, answer, verifiedAnswer };
}
