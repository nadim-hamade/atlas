"use client";

import { useEffect, useRef, useState } from "react";
import { useSessions, uid } from "@/lib/chat/useSessions";
import { useAsk } from "@/lib/chat/useAsk";
import { initialRun } from "@/lib/chat/run";
import type { Message } from "@/lib/chat/types";
import { Sidebar } from "./Sidebar";
import { Composer } from "./Composer";
import { Transcript } from "./Transcript";
import { IntroHero } from "./IntroHero";
import { MenuIcon } from "./icons";

const EXAMPLES = [
  "How does KV-cache compression affect LLM inference latency?",
  "What are current approaches to reducing hallucination in RAG systems?",
  "Recent methods for extending transformer context length?",
];

export function ChatApp() {
  const {
    sessions,
    activeId,
    activeSession,
    hydrated,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    appendMessage,
    updateMessageRun,
  } = useSessions();
  const { live, ask, stop, streaming } = useAsk();

  const [value, setValue] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Follow the stream if the reader is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [live, activeSession?.messages.length]);

  async function submit(text: string) {
    const q = text.trim();
    if (q.length < 2 || q.length > 200 || streaming) return;

    const sid = !activeId || !activeSession ? createSession() : activeId;

    const messageId = uid();
    const message: Message = {
      id: messageId,
      question: q,
      createdAt: Date.now(),
      run: initialRun(),
    };
    appendMessage(sid, message);
    setValue("");
    setDrawerOpen(false);

    await ask(messageId, q, (finalRun) =>
      updateMessageRun(sid, messageId, finalRun),
    );
  }

  async function retry(message: Message) {
    if (streaming || !activeId) return;
    const sid = activeId;
    await ask(message.id, message.question, (finalRun) =>
      updateMessageRun(sid, message.id, finalRun),
    );
  }

  // SSR + first client render match on this blank canvas; content mounts after
  // localStorage hydration, so the intro animation plays exactly once.
  if (!hydrated) return <div className="h-dvh bg-bg" aria-hidden />;

  const showIntro =
    !streaming && (!activeSession || activeSession.messages.length === 0);

  const sidebarProps = {
    sessions,
    activeId,
    onSelect: (id: string) => {
      selectSession(id);
      setDrawerOpen(false);
    },
    onNew: () => {
      createSession();
      setDrawerOpen(false);
    },
    onRename: renameSession,
    onDelete: deleteSession,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-ink-body">
      <aside className="hidden w-[268px] shrink-0 border-r border-line md:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {drawerOpen && (
        <div className="md:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-[var(--z-drawer-backdrop)] bg-black/70"
          />
          <aside className="fixed inset-y-0 left-0 z-[var(--z-drawer)] w-[280px] border-r border-line-strong">
            <Sidebar {...sidebarProps} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:text-ink"
          >
            <MenuIcon size={20} />
          </button>
          <span className="font-mono text-[0.85rem] tracking-[0.3em] text-ink">
            ATLAS
          </span>
        </div>

        {showIntro ? (
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-5">
            <div className="w-full max-w-[640px] py-16">
              <IntroHero />
              <div className="mt-10">
                <Composer
                  value={value}
                  onChange={setValue}
                  onSubmit={() => submit(value)}
                  onStop={stop}
                  streaming={streaming}
                  autoFocus
                />
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      onClick={() => submit(ex)}
                      className="rounded-full border border-line px-3 py-1.5 text-left font-serif text-[0.85rem] italic text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {activeSession && (
                <Transcript session={activeSession} live={live} onRetry={retry} />
              )}
            </div>
            <div
              ref={composerRef}
              className="border-t border-line bg-bg px-5 py-4 sm:px-8"
            >
              <div className="mx-auto max-w-[720px]">
                <Composer
                  value={value}
                  onChange={setValue}
                  onSubmit={() => submit(value)}
                  onStop={stop}
                  streaming={streaming}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
