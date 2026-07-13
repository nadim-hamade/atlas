import type { LiveRun } from "@/lib/chat/useAsk";
import type { Message, Session } from "@/lib/chat/types";
import { PipelineRun } from "./PipelineRun";
import { Answer } from "./Answer";

export function Transcript({
  session,
  live,
  onRetry,
}: {
  session: Session;
  live: LiveRun | null;
  onRetry: (message: Message) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8">
      <div className="space-y-12">
        {session.messages.map((m, i) => {
          const run = live && live.messageId === m.id ? live.run : m.run;
          return (
            <article key={m.id} className={i > 0 ? "border-t border-line pt-12" : ""}>
              <p className="font-serif text-[1.4rem] leading-snug text-ink [text-wrap:pretty]">
                {m.question}
              </p>
              <div className="mt-5">
                <PipelineRun run={run} onRetry={() => onRetry(m)} />
                <Answer run={run} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
