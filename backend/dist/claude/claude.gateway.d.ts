import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from './claude.service';
export declare class ClaudeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private claudeService;
    private configService;
    server: Server;
    private readonly logger;
    private clientSessions;
    constructor(claudeService: ClaudeService, configService: ConfigService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleInitSession(client: Socket, data: {
        sessionId: string;
        projectId: string;
    }): Promise<void>;
    handleExecute(client: Socket, data: {
        sessionId: string;
        prompt: string;
        projectPath: string;
    }): Promise<void>;
    handleStop(client: Socket, data: {
        sessionId: string;
    }): Promise<void>;
    handlePing(client: Socket): void;
    private sendToSession;
    private sendError;
}
