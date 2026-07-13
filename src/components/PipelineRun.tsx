"use client";

import { useEffect, useState } from "react";
import type { StageName } from "@/lib/pipeline/types";
import type { RunState, StageState } from "@/lib/chat/types";
import { STAGE_LABEL } from "@/lib/chat/run";
import { cn, formatMs } from "@/lib/chat/format";
import { ChevronIcon } from "./icons";

function errorMessage(run: RunState): string {
  if (run.status === "aborted") return "Run stopped.";
  switch (run.errorKind) {
    case "ratelimit":
      return run.error ?? "Rate limit reached. Give it a minute.";
    case "busy":
      return run.error ?? "The server is busy right now. Try again shortly.";
    case "validation":
      return run.error ?? "That question was rejected.";
    case "network":
      return run.error ?? "Lost connection to the server.";
    default:
      return run.error ?? "The pipeline hit an error.";
  }
}

/** A hollow / filled dot on the timeline rail — status by fill, not color. */
function StageDot({ status }: { status: StageState["status"] }) {
  if (status === "done" || status === "active") {
    return <span className="block h-[9px] w-[9px] rounded-full bg-ink" />;
  }
  if (status === "error") {
    return (
      <span className="flex h-[11px] w-[11px] items-center justify-center rounded-full border border-line-strong font-mono text-[8px] text-ink-muted">
        ×
      </span>
    );
  }
  return <span className="block h-[9px] w-[9px] rounded-full border border-line-strong" />;
}

function StageInline({ name, run }: { name: StageName; run: RunState }) {
  if (name === "planner" && run.subQueries.length > 0) {
    return (
      <ol className="mt-2 space-y-1">
        {run.subQueries.map((q, i) => (
          <li key={q.id} className="flex gap-2 font-serif text-[0.92rem] text-ink-body">
            <span className="font-mono text-[0.72rem] text-ink-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="[text-wrap:pretty]">{q.text}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (name === "scout" && run.papers.length > 0) {
    return (
      <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-2">
        {run.papers.map((p) => (
          <div key={p.id} className="flex gap-2 leading-snug">
            <span className="shrink-0 font-mono text-[0.68rem] text-ink-faint">
              {p.id.replace(/v\d+$/, "")}
            </span>
            <span className="font-serif text-[0.85rem] text-ink-muted [text-wrap:pretty]">
              {p.title}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (name === "reader" && run.chunks.length > 0) {
    const papers = new Set(run.chunks.map((c) => c.paperId)).size;
    return (
      <p className="mt-2 font-mono text-[0.72rem] text-ink-faint">
        {run.chunks.length} chunks across {papers} papers
      </p>
    );
  }

  return null;
}

export function PipelineRun({
  run,
  onRetry,
}: {
  run: RunState;
  onRetry?: () => void;
}) {
  const streaming = run.status === "streaming";
  const failed = run.status === "error" || run.status === "aborted";
  const done = run.status === "done";

  const [expanded, setExpanded] = useState(streaming || failed);
  useEffect(() => {
    setExpanded(run.status !== "done");
  }, [run.status]);

  const totalMs = run.stages.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const activeStage = run.stages.find((s) => s.status === "active");

  return (
    <section aria-label="Research pipeline" className="mt-1">
      {/* Header: a live status while running, a compact toggleable summary once done. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-2 text-left"
      >
        <span
          aria-live="polite"
          className={cn(
            "font-mono text-[0.7rem] uppercase tracking-[0.14em]",
            streaming ? "text-ink" : "text-ink-muted",
          )}
        >
          {streaming ? (
            <span className="caret">
              {activeStage ? STAGE_LABEL[activeStage.name] : "Starting"}
            </span>
          ) : done ? (
            "Pipeline"
          ) : (
            "Pipeline halted"
          )}
        </span>
        {done && (
          <span className="font-mono text-[0.7rem] text-ink-faint">
            {run.papers.length} papers · {run.chunks.length} chunks
            {totalMs > 0 ? ` · ${formatMs(totalMs)}` : ""}
          </span>
        )}
        <span
          className={cn(
            "ml-auto text-ink-faint transition-transform duration-200",
            expanded && "rotate-180",
          )}
        >
          <ChevronIcon size={14} />
        </span>
      </button>

      {expanded && (
        <ol className="relative mt-4 space-y-4">
          <span
            aria-hidden
            className="absolute left-[5px] top-1 bottom-1 w-px bg-line"
          />
          {run.stages.map((stage) => {
            const isActive = stage.status === "active";
            const isDone = stage.status === "done";
            const isPending = stage.status === "pending";
            return (
              <li key={stage.name} className="relative pl-7">
                <span className="absolute left-0 top-[3px] flex h-[11px] w-[11px] items-center justify-center bg-bg">
                  <StageDot status={stage.status} />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "font-mono text-[0.72rem] uppercase tracking-[0.1em]",
                      isActive && "text-ink",
                      isDone && "text-ink-muted",
                      isPending && "text-ink-faint",
                      stage.status === "error" && "text-ink-muted",
                    )}
                  >
                    {stage.name}
                  </span>
                  {isDone && stage.durationMs != null && (
                    <span className="font-mono text-[0.7rem] text-ink-faint">
                      {formatMs(stage.durationMs)}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "font-serif text-[0.92rem] leading-snug",
                    isActive ? "text-ink-body" : "text-ink-faint",
                    isActive && "caret",
                  )}
                >
                  {stage.message ?? STAGE_LABEL[stage.name]}
                </div>
                <StageInline name={stage.name} run={run} />
              </li>
            );
          })}
        </ol>
      )}

      {failed && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <p className="font-mono text-[0.78rem] text-ink-muted">
            {errorMessage(run)}
            {run.retryAfterS ? ` (retry in ~${run.retryAfterS}s)` : ""}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-line-strong px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.06em] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </section>
  );
}
