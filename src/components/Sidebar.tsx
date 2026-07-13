"use client";

import { useState } from "react";
import type { Session } from "@/lib/chat/types";
import { cn, formatWhen } from "@/lib/chat/format";
import { CloseIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClose,
}: {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function startRename(s: Session) {
    setConfirmId(null);
    setEditingId(s.id);
    setDraft(s.title);
  }

  function commitRename() {
    if (editingId) onRename(editingId, draft);
    setEditingId(null);
  }

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <div className="font-mono text-[0.95rem] font-medium tracking-[0.35em] text-ink">
            ATLAS
          </div>
          <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-faint">
            cited research
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted transition-colors hover:text-ink md:hidden"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2.5 font-mono text-[0.78rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <PlusIcon size={15} />
          New thread
        </button>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Threads">
        {sessions.length === 0 ? (
          <p className="px-2 py-6 font-serif text-[0.9rem] italic leading-relaxed text-ink-faint">
            No threads yet. Ask a question to begin one.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const active = s.id === activeId;

              if (editingId === s.id) {
                return (
                  <li key={s.id}>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label="Rename thread"
                      className="w-full rounded-md border border-line-strong bg-surface-2 px-3 py-2 font-serif text-[0.92rem] text-ink outline-none"
                    />
                  </li>
                );
              }

              if (confirmId === s.id) {
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2"
                  >
                    <span className="font-mono text-[0.72rem] text-ink-muted">
                      Delete thread?
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded px-2 py-0.5 font-mono text-[0.7rem] text-ink-faint hover:text-ink"
                      >
                        cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(s.id);
                          setConfirmId(null);
                        }}
                        className="rounded px-2 py-0.5 font-mono text-[0.7rem] text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                      >
                        delete
                      </button>
                    </span>
                  </li>
                );
              }

              return (
                <li key={s.id} className="group/row relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "w-full rounded-md py-2 pl-3 pr-16 text-left transition-colors",
                      active
                        ? "bg-surface-2"
                        : "hover:bg-surface-2/60",
                    )}
                  >
                    <span
                      className={cn(
                        "block truncate font-serif text-[0.95rem] leading-snug",
                        active ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      {s.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.64rem] text-ink-faint">
                      {formatWhen(s.updatedAt)} · {s.messages.length}{" "}
                      {s.messages.length === 1 ? "ask" : "asks"}
                    </span>
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-ink"
                      />
                    )}
                  </button>
                  <span className="absolute right-2 top-1.5 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
                    <button
                      type="button"
                      onClick={() => startRename(s)}
                      aria-label={`Rename ${s.title}`}
                      className="grid h-7 w-7 place-items-center rounded text-ink-faint transition-colors hover:bg-surface-1 hover:text-ink"
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(s.id)}
                      aria-label={`Delete ${s.title}`}
                      className="grid h-7 w-7 place-items-center rounded text-ink-faint transition-colors hover:bg-surface-1 hover:text-ink"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
