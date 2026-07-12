import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { PipelineEvent } from "@/lib/pipeline/types";
import { clientIp, rateLimit, tryAcquireRun } from "@/lib/ratelimit";

// The pipeline runs several live model + arXiv calls, so this must never be cached.
export const dynamic = "force-dynamic";
// Platform ceiling; our own PIPELINE_DEADLINE_MS ends runs well before this.
export const maxDuration = 300;

/** A full pipeline run is expensive (LLM + embedding + arXiv calls), so keep limits tight. */
const RUNS_PER_WINDOW = 4;
const WINDOW_MS = 10 * 60_000;
const MAX_CONCURRENT_RUNS = 2;
/** Hard cap on a single run; normal runs finish in ~30-60s. */
const PIPELINE_DEADLINE_MS = 120_000;

const encoder = new TextEncoder();

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const question = searchParams.get("q")?.trim() ?? "";

  if (question.length < 2 || question.length > 200) {
    return jsonResponse(400, { error: "q must be between 2 and 200 characters" });
  }

  const ip = clientIp(request);
  const limit = rateLimit(`ask:${ip}`, RUNS_PER_WINDOW, WINDOW_MS);
  if (!limit.ok) {
    return jsonResponse(
      429,
      { error: "rate limit exceeded — try again later" },
      { "retry-after": String(limit.retryAfterS) },
    );
  }

  const release = tryAcquireRun(MAX_CONCURRENT_RUNS);
  if (!release) {
    return jsonResponse(
      429,
      { error: "server is busy — try again in a minute" },
      { "retry-after": "60" },
    );
  }

  // One abort signal covers client disconnect, stream cancellation, and the deadline.
  const aborter = new AbortController();
  const deadline = setTimeout(() => aborter.abort(), PIPELINE_DEADLINE_MS);
  if (request.signal.aborted) aborter.abort();
  else request.signal.addEventListener("abort", () => aborter.abort(), { once: true });

  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PipelineEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream already torn down (client gone) — stop the pipeline too.
          closed = true;
          aborter.abort();
        }
      };

      try {
        await runPipeline(question, emit, aborter.signal);
      } catch {
        // Aborted, or the orchestrator already emitted a sanitized pipeline:error.
      } finally {
        clearTimeout(deadline);
        release();
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed by the runtime
          }
        }
      }
    },
    cancel() {
      closed = true;
      aborter.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering so events arrive as they are produced.
      "x-accel-buffering": "no",
    },
  });
}
