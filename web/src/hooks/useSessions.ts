/**
 * useSessions hook - Manages multi-session state with localStorage persistence
 */

import { useCallback, useMemo, useState } from "react";
import { Terminal } from "@xterm/xterm";
import {
  Session,
  SessionStatus,
  SessionOutput,
  CreateSessionOptions,
} from "@/types/session";
import {
  getSessions as getStoredSessions,
  addSession as addStoredSession,
  updateSession as updateStoredSession,
  removeSession as removeStoredSession,
  getCurrentSessionId,
  setCurrentSessionId as storeCurrentSessionId,
} from "@/lib/storage";

export interface SessionWithTerminal extends Session {
  terminal: Terminal | null;
}

export interface UseSessionsOptions {
  onSessionCreate?: (session: Session) => void;
  onSessionSelect?: (session: Session) => void;
  onSessionRemove?: (sessionId: string) => void;
}

export interface UseSessionsReturn {
  sessions: SessionWithTerminal[];
  currentSession: SessionWithTerminal | null;
  currentSessionId: string | null;
  createSession: (options?: CreateSessionOptions) => SessionWithTerminal;
  selectSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: SessionStatus) => void;
  updateSessionTerminal: (sessionId: string, terminal: Terminal | null) => void;
  getSession: (sessionId: string) => SessionWithTerminal | undefined;
  addOutput: (sessionId: string, output: Omit<SessionOutput, "id" | "timestamp">) => void;
  getOutput: (sessionId: string) => SessionOutput[];
  clearOutput: (sessionId: string) => void;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionName(index: number): string {
  return `Terminal ${index + 1}`;
}

// Initialize sessions from localStorage (client-side only)
function getInitialSessions(): SessionWithTerminal[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = getStoredSessions();
    return stored.map((s) => ({ ...s, terminal: null }));
  } catch {
    return [];
  }
}

// Initialize current session ID from localStorage (client-side only)
function getInitialCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return getCurrentSessionId();
  } catch {
    return null;
  }
}

export function useSessions(options: UseSessionsOptions = {}): UseSessionsReturn {
  const { onSessionCreate, onSessionSelect, onSessionRemove } = options;

  // Initialize from localStorage
  const [sessions, setSessions] = useState<SessionWithTerminal[]>(getInitialSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(getInitialCurrentSessionId);
  const [outputBySession, setOutputBySession] = useState<Record<string, SessionOutput[]>>({});

  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId) ?? null;
  }, [sessions, currentSessionId]);

  const createSession = useCallback(
    (createOptions?: CreateSessionOptions): SessionWithTerminal => {
      const now = new Date();
      const newSession: SessionWithTerminal = {
        id: generateSessionId(),
        name: createOptions?.name ?? generateSessionName(sessions.length),
        repoPath: createOptions?.repoPath,
        status: "idle",
        createdAt: now,
        lastActivityAt: now,
        isInteractive: createOptions?.interactive ?? true,
        terminal: null,
      };

      setSessions((prev) => [...prev, newSession]);
      setCurrentSessionId(newSession.id);
      setOutputBySession((prev) => ({ ...prev, [newSession.id]: [] }));

      // Persist to localStorage
      addStoredSession(newSession);
      storeCurrentSessionId(newSession.id);

      onSessionCreate?.(newSession);

      return newSession;
    },
    [sessions.length, onSessionCreate]
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        setCurrentSessionId(sessionId);
        storeCurrentSessionId(sessionId); // Persist to localStorage
        onSessionSelect?.(session);
      }
    },
    [sessions, onSessionSelect]
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.id === sessionId);
        if (index === -1) return prev;

        // Dispose terminal if exists
        const session = prev[index];
        if (session.terminal) {
          session.terminal.dispose();
        }

        const newSessions = prev.filter((s) => s.id !== sessionId);

        // If removing current session, select another
        if (currentSessionId === sessionId) {
          if (newSessions.length > 0) {
            // Select the next session, or the previous if we removed the last one
            const newIndex = Math.min(index, newSessions.length - 1);
            const newCurrentId = newSessions[newIndex].id;
            setCurrentSessionId(newCurrentId);
            storeCurrentSessionId(newCurrentId); // Persist to localStorage
          } else {
            setCurrentSessionId(null);
            storeCurrentSessionId(null); // Persist to localStorage
          }
        }

        return newSessions;
      });

      // Persist removal to localStorage
      removeStoredSession(sessionId);

      setOutputBySession((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [sessionId]: _removed, ...rest } = prev;
        return rest;
      });

      onSessionRemove?.(sessionId);
    },
    [currentSessionId, onSessionRemove]
  );

  const updateSessionStatus = useCallback(
    (sessionId: string, status: SessionStatus) => {
      const now = new Date();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status, lastActivityAt: now }
            : s
        )
      );
      // Persist to localStorage
      updateStoredSession(sessionId, { status, lastActivityAt: now });
    },
    []
  );

  const updateSessionTerminal = useCallback(
    (sessionId: string, terminal: Terminal | null) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, terminal } : s
        )
      );
    },
    []
  );

  const getSession = useCallback(
    (sessionId: string): SessionWithTerminal | undefined => {
      return sessions.find((s) => s.id === sessionId);
    },
    [sessions]
  );

  const addOutput = useCallback(
    (sessionId: string, output: Omit<SessionOutput, "id" | "timestamp">) => {
      const now = new Date();
      const newOutput: SessionOutput = {
        ...output,
        id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: now,
      };

      setOutputBySession((prev) => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] ?? []), newOutput],
      }));

      // Update last activity
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, lastActivityAt: now } : s
        )
      );
      // Persist lastActivityAt to localStorage
      updateStoredSession(sessionId, { lastActivityAt: now });
    },
    []
  );

  const getOutput = useCallback(
    (sessionId: string): SessionOutput[] => {
      return outputBySession[sessionId] ?? [];
    },
    [outputBySession]
  );

  const clearOutput = useCallback((sessionId: string) => {
    setOutputBySession((prev) => ({
      ...prev,
      [sessionId]: [],
    }));
  }, []);

  return {
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    selectSession,
    removeSession,
    updateSessionStatus,
    updateSessionTerminal,
    getSession,
    addOutput,
    getOutput,
    clearOutput,
  };
}
