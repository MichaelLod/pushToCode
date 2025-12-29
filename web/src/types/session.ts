/**
 * Session types for pushToCode
 */

export type SessionStatus = "idle" | "running" | "completed" | "error" | "disconnected";

export interface Session {
  id: string;
  name: string;
  repoPath?: string;
  repoName?: string;
  status: SessionStatus;
  createdAt: Date;
  lastActivityAt: Date;
  isInteractive: boolean;
}

export interface SessionOutput {
  id: string;
  sessionId: string;
  type: "stdout" | "stderr" | "system" | "command";
  content: string;
  timestamp: Date;
}

export interface SessionCommand {
  id: string;
  sessionId: string;
  command: string;
  status: "pending" | "running" | "completed" | "error";
  startedAt?: Date;
  completedAt?: Date;
  exitCode?: number;
}

export interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  outputBySession: Record<string, SessionOutput[]>;
  commandHistory: Record<string, SessionCommand[]>;
}

// Repository types
export interface Repository {
  id: string;
  name: string;
  path: string;
  url?: string;
  lastUsed?: Date;
  createdAt: Date;
}

// Settings types
export interface AppSettings {
  apiKey: string;
  serverUrl: string;
  theme: "dark" | "light" | "system";
  fontSize: number;
  fontFamily: string;
  scrollbackLines: number;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  serverUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",
  theme: "dark",
  fontSize: 14,
  fontFamily: "Geist Mono, monospace",
  scrollbackLines: 10000,
  soundEnabled: true,
  hapticEnabled: true,
};

// Session creation options
export interface CreateSessionOptions {
  name?: string;
  repoPath?: string;
  interactive?: boolean;
}

// Session manager interface
export interface SessionManager {
  getSessions(): Session[];
  getCurrentSession(): Session | null;
  createSession(options?: CreateSessionOptions): Session;
  selectSession(sessionId: string): void;
  removeSession(sessionId: string): void;
  updateSessionStatus(sessionId: string, status: SessionStatus): void;
  addOutput(sessionId: string, output: Omit<SessionOutput, "id" | "timestamp">): void;
  getOutput(sessionId: string): SessionOutput[];
  clearOutput(sessionId: string): void;
}
