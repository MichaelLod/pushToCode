export type OutputType = 'text' | 'code_block' | 'thinking' | 'file_change';
export type SessionStatus = 'idle' | 'running' | 'stopped';
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
export type ClientMessage = InitSessionMessage | ExecuteMessage | StopMessage;
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
export type ServerMessage = SessionReadyMessage | StatusMessage | OutputMessage | ErrorMessage | AuthRequiredMessage;
