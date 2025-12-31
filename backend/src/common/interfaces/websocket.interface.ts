export type OutputType = 'text' | 'code_block' | 'thinking' | 'file_change';
export type SessionStatus = 'idle' | 'running' | 'stopped';

// Terminal buffer snapshot for server-side rendering
export interface TerminalBufferData {
  lines: string[];
  cursorX: number;
  cursorY: number;
  cols: number;
  rows: number;
  ansiContent?: string;  // Full ANSI-formatted content with colors preserved
}

// Client -> Server Messages
export interface InitSessionMessage {
  type: 'init_session';
  sessionId: string;
  projectId: string;
}

export interface ExecuteMessage {
  type: 'execute';
  sessionId: string;
  prompt: string;
  projectPath: string;
}

export interface StopMessage {
  type: 'stop';
  sessionId: string;
}

export interface ResumeSessionMessage {
  type: 'resume_session';
  sessionId: string;
  projectPath: string;
}

export interface DestroySessionMessage {
  type: 'destroy_session';
  sessionId: string;
}

export type ClientMessage = InitSessionMessage | ExecuteMessage | StopMessage | ResumeSessionMessage | DestroySessionMessage;

// Server -> Client Messages
export interface SessionReadyMessage {
  type: 'session_ready';
  sessionId: string;
}

export interface StatusMessage {
  type: 'status';
  sessionId: string;
  status: SessionStatus;
}

export interface OutputMessage {
  type: 'output';
  sessionId: string;
  content: string;
  outputType: OutputType;
  isFinal: boolean;
}

export interface ErrorMessage {
  type: 'error';
  sessionId: string;
  code: string;
  message: string;
}

export interface AuthRequiredMessage {
  type: 'auth_required';
  sessionId: string;
  authUrl: string;
  message: string;
}

// New: Terminal buffer sync message (server-side rendered terminal state)
export interface TerminalBufferMessage {
  type: 'terminal_buffer';
  sessionId: string;
  buffer: TerminalBufferData;
}

// Session resume/destroy response messages
export interface SessionResumedMessage {
  type: 'session_resumed';
  sessionId: string;
  buffer: TerminalBufferData;
  isRunning: boolean;  // Whether PTY is still running
}

export interface SessionNotFoundMessage {
  type: 'session_not_found';
  sessionId: string;
}

export interface SessionDestroyedMessage {
  type: 'session_destroyed';
  sessionId: string;
}

export type ServerMessage =
  | SessionReadyMessage
  | StatusMessage
  | OutputMessage
  | ErrorMessage
  | AuthRequiredMessage
  | TerminalBufferMessage
  | SessionResumedMessage
  | SessionNotFoundMessage
  | SessionDestroyedMessage;
