"use client";

import { useCallback, useRef, useState } from "react";
import { initialRun, reduceEvent } from "./run";
import { AskError, streamAsk } from "./stream";
import type { RunState } from "./types";

export interface LiveRun {
  messageId: string;
  run: RunState;
}

/**
 * Drives one in-flight run. Events fold into a live RunState (rendered as it
 * streams); when the run settles, `onSettle` persists the final snapshot and
 * the live view clears in the same batch — no placeholder flash.
 */
export function useAsk() {
  const [live, setLive] = useState<LiveRun | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const ask = useCallback(
    async (
      messageId: string,
      question: string,
      onSettle: (run: RunState) => void,
    ): Promise<RunState> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      let run = initialRun();
      const commit = (next: RunState) => {
        run = next;
        setLive({ messageId, run });
      };
      commit(run);

      try {
        await streamAsk(question, controller.signal, (event) => {
          commit(reduceEvent(run, event));
        });
        if (run.status === "streaming") commit({ ...run, status: "done" });
      } catch (err) {
        if (controller.signal.aborted) {
          run = {
            ...run,
            status: "aborted",
            stages: run.stages.map((s) =>
              s.status === "active" ? { ...s, status: "error" } : s,
            ),
          };
        } else if (err instanceof AskError) {
          run = {
            ...run,
            status: "error",
            errorKind: err.kind,
            error: err.message,
            retryAfterS: err.retryAfterS,
          };
        } else {
          run = {
            ...run,
            status: "error",
            errorKind: "network",
            error: "Lost connection to the server.",
          };
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        // Persist then clear the live view in one synchronous batch.
        onSettle(run);
        setLive(null);
      }
      return run;
    },
    [],
  );

  return { live, ask, stop, streaming: live?.run.status === "streaming" };
}
