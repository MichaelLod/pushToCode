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
export declare class ClaudeService {
    private configService;
    private readonly logger;
    private sessions;
    constructor(configService: ConfigService);
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
