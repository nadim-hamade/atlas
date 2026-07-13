"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deriveTitle } from "./run";
import type { Message, RunState, Session } from "./types";

const SESSIONS_KEY = "atlas.sessions.v1";
const ACTIVE_KEY = "atlas.active.v1";

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** A run left mid-stream by a reload can't resume — mark it aborted on load. */
function normalizeMessage(m: Message): Message {
  if (m.run?.status === "streaming") {
    const run: RunState = {
      ...m.run,
      status: "aborted",
      stages: m.run.stages.map((s) =>
        s.status === "active" ? { ...s, status: "error" } : s,
      ),
    };
    return { ...m, run };
  }
  return m;
}

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Session[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({ ...s, messages: (s.messages ?? []).map(normalizeMessage) }));
  } catch {
    return [];
  }
}

export interface SessionsApi {
  sessions: Session[];
  activeId: string | null;
  activeSession: Session | null;
  hydrated: boolean;
  createSession: () => string;
  selectSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  appendMessage: (sessionId: string, message: Message) => void;
  updateMessageRun: (sessionId: string, messageId: string, run: RunState) => void;
}

/** localStorage-backed multi-session store. Client-only; hydrates after mount. */
export function useSessions(): SessionsApi {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    const savedActive = localStorage.getItem(ACTIVE_KEY);
    setActiveId(
      savedActive && loaded.some((s) => s.id === savedActive)
        ? savedActive
        : loaded[0]?.id ?? null,
    );
    setHydrated(true);
  }, []);

  // Persist only after hydration so we never clobber storage with the empty
  // initial state on first render.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // storage full or blocked — nothing actionable
    }
  }, [sessions, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [activeId, hydrated]);

  const createSession = useCallback((): string => {
    const id = uid();
    const now = Date.now();
    const session: Session = {
      id,
      title: "New thread",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setSessions((prev) => [session, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  const selectSession = useCallback((id: string) => setActiveId(id), []);

  const renameSession = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: clean } : s)),
    );
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }, []);

  const appendMessage = useCallback((sessionId: string, message: Message) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? deriveTitle(message.question) : s.title,
          updatedAt: message.createdAt,
          messages: [...s.messages, message],
        };
      }),
    );
  }, []);

  const updateMessageRun = useCallback(
    (sessionId: string, messageId: string, run: RunState) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            updatedAt: Date.now(),
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, run } : m,
            ),
          };
        }),
      );
    },
    [],
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  return {
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
  };
}
