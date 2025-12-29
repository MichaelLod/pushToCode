/**
 * WebSocket message types for pushToCode
 * Matches backend WebSocket protocol
 */

// ============================================
// Client -> Server Messages
// ============================================

export type ClientMessageType =
  | "init_session"
  | "execute"
  | "stop"
  | "ping"
  | "pong"
  | "pty_input"
  | "login"
  | "start_interactive"
  | "submit_auth_code";

export interface InitSessionMessage {
  type: "init_session";
  sessionId: string;
  repoPath?: string;
}

export interface ExecuteMessage {
  type: "execute";
  sessionId: string;
  command: string;
}

export interface StopMessage {
  type: "stop";
  sessionId: string;
}

export interface PingMessage {
  type: "ping";
}

export interface PongMessage {
  type: "pong";
}

export interface PtyInputMessage {
  type: "pty_input";
  sessionId: string;
  data: string;
}

export interface LoginMessage {
  type: "login";
  apiKey: string;
}

export interface StartInteractiveMessage {
  type: "start_interactive";
  sessionId: string;
  projectPath: string;
  cols?: number;
  rows?: number;
}

export interface SubmitAuthCodeMessage {
  type: "submit_auth_code";
  code: string;
}

export interface UploadFileMessage {
  type: "upload_file";
  sessionId: string;
  filename: string;
  mimeType: string;
  data: string; // base64 encoded
}

export type ClientMessage =
  | InitSessionMessage
  | ExecuteMessage
  | StopMessage
  | PingMessage
  | PongMessage
  | PtyInputMessage
  | LoginMessage
  | StartInteractiveMessage
  | SubmitAuthCodeMessage
  | UploadFileMessage;

// ============================================
// Server -> Client Messages
// ============================================

export type ServerMessageType =
  | "session_ready"
  | "status"
  | "output"
  | "error"
  | "ping"
  | "pong"
  | "auth_required"
  | "auth_success"
  | "auth_failed"
  | "pty_output"
  | "terminal_buffer"
  | "login_interactive"
  | "interactive_started"
  | "file_uploaded";

// Terminal buffer data from server-side rendering
export interface TerminalBufferData {
  lines: string[];
  cursorX: number;
  cursorY: number;
  cols: number;
  rows: number;
  ansiContent?: string;  // Full ANSI-formatted content with colors preserved
}

export interface SessionReadyMessage {
  type: "session_ready";
  sessionId: string;
}

export interface StatusMessage {
  type: "status";
  sessionId: string;
  status: "idle" | "running" | "completed" | "error";
  message?: string;
}

export interface OutputMessage {
  type: "output";
  sessionId: string;
  content: string;
  outputType?: string;
  isFinal?: boolean;
}

export interface ErrorMessage {
  type: "error";
  sessionId?: string;
  code: string;
  message: string;
}

export interface ServerPingMessage {
  type: "ping";
}

export interface ServerPongMessage {
  type: "pong";
}

export interface AuthRequiredMessage {
  type: "auth_required";
}

export interface AuthSuccessMessage {
  type: "auth_success";
  userId?: string;
}

export interface AuthFailedMessage {
  type: "auth_failed";
  reason: string;
}

export interface PtyOutputMessage {
  type: "pty_output";
  sessionId: string;
  content: string;
}

export interface LoginInteractiveMessage {
  type: "login_interactive";
  sessionId: string;
  message: string;
}

export interface InteractiveStartedMessage {
  type: "interactive_started";
  sessionId: string;
  message?: string;
}

export interface FileUploadedMessage {
  type: "file_uploaded";
  sessionId: string;
  filePath: string;
  filename: string;
}

// Server-side rendered terminal buffer snapshot
export interface TerminalBufferMessage {
  type: "terminal_buffer";
  sessionId: string;
  buffer: TerminalBufferData;
}

export type ServerMessage =
  | SessionReadyMessage
  | StatusMessage
  | OutputMessage
  | ErrorMessage
  | ServerPingMessage
  | ServerPongMessage
  | AuthRequiredMessage
  | AuthSuccessMessage
  | AuthFailedMessage
  | PtyOutputMessage
  | TerminalBufferMessage
  | LoginInteractiveMessage
  | InteractiveStartedMessage
  | FileUploadedMessage;

// ============================================
// Type Guards
// ============================================

export function isServerMessage(data: unknown): data is ServerMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string"
  );
}

export function isOutputMessage(msg: ServerMessage): msg is OutputMessage {
  return msg.type === "output";
}

export function isPtyOutputMessage(msg: ServerMessage): msg is PtyOutputMessage {
  return msg.type === "pty_output";
}

export function isErrorMessage(msg: ServerMessage): msg is ErrorMessage {
  return msg.type === "error";
}

export function isStatusMessage(msg: ServerMessage): msg is StatusMessage {
  return msg.type === "status";
}

export function isAuthRequiredMessage(msg: ServerMessage): msg is AuthRequiredMessage {
  return msg.type === "auth_required";
}

export function isAuthSuccessMessage(msg: ServerMessage): msg is AuthSuccessMessage {
  return msg.type === "auth_success";
}

export function isAuthFailedMessage(msg: ServerMessage): msg is AuthFailedMessage {
  return msg.type === "auth_failed";
}

export function isTerminalBufferMessage(msg: ServerMessage): msg is TerminalBufferMessage {
  return msg.type === "terminal_buffer";
}
