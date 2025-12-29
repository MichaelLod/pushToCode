/**
 * useSessions hook - Manages multi-session state
 */

import { useCallback, useMemo, useState } from "react";
import { Terminal } from "@xterm/xterm";
import {
  Session,
  SessionStatus,
  SessionOutput,
  CreateSessionOptions,
} from "@/types/session";

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

export function useSessions(options: UseSessionsOptions = {}): UseSessionsReturn {
  const { onSessionCreate, onSessionSelect, onSessionRemove } = options;

  const [sessions, setSessions] = useState<SessionWithTerminal[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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
            setCurrentSessionId(newSessions[newIndex].id);
          } else {
            setCurrentSessionId(null);
          }
        }

        return newSessions;
      });

      setOutputBySession((prev) => {
        const { [sessionId]: _, ...rest } = prev;
        return rest;
      });

      onSessionRemove?.(sessionId);
    },
    [currentSessionId, onSessionRemove]
  );

  const updateSessionStatus = useCallback(
    (sessionId: string, status: SessionStatus) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status, lastActivityAt: new Date() }
            : s
        )
      );
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
      const newOutput: SessionOutput = {
        ...output,
        id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      setOutputBySession((prev) => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] ?? []), newOutput],
      }));

      // Update last activity
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, lastActivityAt: new Date() } : s
        )
      );
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
