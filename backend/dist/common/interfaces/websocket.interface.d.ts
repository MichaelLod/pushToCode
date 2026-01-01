export type OutputType = 'text' | 'code_block' | 'thinking' | 'file_change';
export type SessionStatus = 'idle' | 'running' | 'stopped';
export interface TerminalBufferData {
    lines: string[];
    cursorX: number;
    cursorY: number;
    cols: number;
    rows: number;
    ansiContent?: string;
}
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
export interface TerminalBufferMessage {
    type: 'terminal_buffer';
    sessionId: string;
    buffer: TerminalBufferData;
}
export interface SessionResumedMessage {
    type: 'session_resumed';
    sessionId: string;
    buffer: TerminalBufferData;
    isRunning: boolean;
}
export interface SessionNotFoundMessage {
    type: 'session_not_found';
    sessionId: string;
}
export interface SessionDestroyedMessage {
    type: 'session_destroyed';
    sessionId: string;
}
export type VoicePromptType = 'confirm' | 'choice' | 'input';
export interface VoiceOutputData {
    speak: string;
    promptType?: VoicePromptType;
    promptText?: string;
    options?: string[];
}
export interface VoiceModeMessage {
    type: 'voice_mode';
    sessionId: string;
    enabled: boolean;
}
export interface VoiceOutputMessage {
    type: 'voice_output';
    sessionId: string;
    voiceData: VoiceOutputData;
}
export type ServerMessage = SessionReadyMessage | StatusMessage | OutputMessage | ErrorMessage | AuthRequiredMessage | TerminalBufferMessage | SessionResumedMessage | SessionNotFoundMessage | SessionDestroyedMessage | VoiceOutputMessage;
