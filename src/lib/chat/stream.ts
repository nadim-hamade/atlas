import type { PipelineEvent } from "@/lib/pipeline/types";
import type { ErrorKind } from "./types";

/** A failed run, carrying enough to show the right recovery message. */
export class AskError extends Error {
  kind: ErrorKind;
  retryAfterS?: number;
  constructor(kind: ErrorKind, message: string, retryAfterS?: number) {
    super(message);
    this.name = "AskError";
    this.kind = kind;
    this.retryAfterS = retryAfterS;
  }
}

/**
 * Open the SSE stream over fetch (not EventSource) so we can read the status
 * code and body on 400/429 — EventSource hides those and auto-reconnects,
 * which would silently re-run the whole pipeline. Each `data:` frame is a
 * PipelineEvent handed to `onEvent`. Aborting `signal` cancels the fetch, which
 * the route treats as a client disconnect and stops the pipeline server-side.
 */
export async function streamAsk(
  question: string,
  signal: AbortSignal,
  onEvent: (event: PipelineEvent) => void,
): Promise<void> {
  const res = await fetch(`/api/ask?q=${encodeURIComponent(question)}`, {
    signal,
    headers: { accept: "text/event-stream" },
  });

  if (!res.ok) {
    let message = "Something went wrong on the server.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body; keep the default message
    }
    const retryAfter = Number(res.headers.get("retry-after")) || undefined;
    if (res.status === 400) throw new AskError("validation", message);
    if (res.status === 429) {
      const kind: ErrorKind = /busy/i.test(message) ? "busy" : "ratelimit";
      throw new AskError(kind, message, retryAfter);
    }
    throw new AskError("network", message);
  }

  if (!res.body) throw new AskError("network", "The server sent no stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload) as PipelineEvent);
        } catch {
          // ignore a malformed frame rather than killing the stream
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
