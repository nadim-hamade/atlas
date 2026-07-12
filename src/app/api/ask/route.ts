import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { PipelineEvent } from "@/lib/pipeline/types";

// The pipeline runs several live model + arXiv calls, so this must never be cached.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();

function sseChunk(event: PipelineEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const question = searchParams.get("q")?.trim() ?? "";

  if (question.length < 2 || question.length > 200) {
    return new Response(
      JSON.stringify({ error: "q must be between 2 and 200 characters" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PipelineEvent) => controller.enqueue(sseChunk(event));
      try {
        await runPipeline(question, emit, request.signal);
      } catch {
        // The orchestrator has already emitted a pipeline:error event; nothing to add.
      } finally {
        controller.close();
      }
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
