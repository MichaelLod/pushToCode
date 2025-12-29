import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from './claude.service';
import { IncomingMessage } from 'http';
interface AuthenticatedWebSocket extends WebSocket {
    isAlive: boolean;
    isAuthenticated: boolean;
    clientId: string;
    sessionIds: Set<string>;
}
export declare class ClaudeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private claudeService;
    private configService;
    server: Server;
    private readonly logger;
    private clients;
    private pingInterval;
    constructor(claudeService: ClaudeService, configService: ConfigService);
    afterInit(server: Server): void;
    handleConnection(client: AuthenticatedWebSocket, request: IncomingMessage): Promise<void>;
    handleDisconnect(client: AuthenticatedWebSocket): Promise<void>;
    private handleMessage;
    private handleInitSession;
    private handleExecute;
    private handleStop;
    private handleLogin;
    private handleSubmitAuthCode;
    private handleStartInteractive;
    private handlePtyInput;
    private handleUploadFile;
    private getExtFromMime;
    private handlePing;
    private sendMessage;
    private sendError;
    private generateClientId;
    onModuleDestroy(): void;
}
export {};
