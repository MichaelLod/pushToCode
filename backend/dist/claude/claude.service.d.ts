import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { OutputType } from '../common/interfaces/websocket.interface';
export interface ClaudeOutput {
    type: 'output' | 'error' | 'exit' | 'auth_required';
    content?: string;
    outputType?: OutputType;
    code?: number;
    isFinal?: boolean;
    authUrl?: string;
}
export declare class ClaudeService implements OnModuleInit {
    private configService;
    private readonly logger;
    private sessions;
    private pendingAuthUrl;
    private isAuthenticated;
    private loginPtyProcess;
    private loginEmitter;
    private readonly SESSION_METADATA_PATH;
    private readonly SESSION_TTL_MS;
    private persistedSessions;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    private loadPersistedSessions;
    private savePersistedSessions;
    private persistSession;
    private getPersistedClaudeSessionId;
    private verifyCliInstalled;
    private checkAuthStatus;
    getPendingAuthUrl(): string | null;
    isClaudeAuthenticated(): boolean;
    clearPendingAuth(): void;
    triggerLogin(): Promise<{
        url: string | null;
        emitter: EventEmitter;
    }>;
    submitAuthCode(code: string): Promise<boolean>;
    getLoginEmitter(): EventEmitter | null;
    sendPtyInput(input: string): boolean;
    sendSessionPtyInput(sessionId: string, input: string): boolean;
    startInteractiveSession(sessionId: string, projectPath: string): Promise<EventEmitter>;
    initSession(sessionId: string, projectPath: string): Promise<void>;
    execute(sessionId: string, prompt: string, projectPath: string): Promise<EventEmitter>;
    private parseClaudeOutput;
    private detectOutputType;
    private stripAnsiAndControl;
    private extractClaudeResponse;
    private filterProcessingSpam;
    private extractAuthUrl;
    stopSession(sessionId: string): Promise<void>;
    destroySession(sessionId: string): void;
    hasSession(sessionId: string): boolean;
    isRunning(sessionId: string): boolean;
}
