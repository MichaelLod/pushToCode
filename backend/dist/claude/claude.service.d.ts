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
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    private checkAuthStatus;
    getPendingAuthUrl(): string | null;
    isClaudeAuthenticated(): boolean;
    clearPendingAuth(): void;
    initSession(sessionId: string, projectPath: string): Promise<void>;
    execute(sessionId: string, prompt: string, projectPath: string): Promise<EventEmitter>;
    private parseClaudeOutput;
    private detectOutputType;
    private extractAuthUrl;
    stopSession(sessionId: string): Promise<void>;
    destroySession(sessionId: string): void;
    hasSession(sessionId: string): boolean;
    isRunning(sessionId: string): boolean;
}
