"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ClaudeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const claude_service_1 = require("./claude.service");
let ClaudeGateway = ClaudeGateway_1 = class ClaudeGateway {
    claudeService;
    configService;
    server;
    logger = new common_1.Logger(ClaudeGateway_1.name);
    clientSessions = new Map();
    constructor(claudeService, configService) {
        this.claudeService = claudeService;
        this.configService = configService;
    }
    async handleConnection(client) {
        const apiKey = client.handshake.auth?.apiKey || client.handshake.headers['x-api-key'];
        const validApiKey = this.configService.get('API_KEY');
        if (!validApiKey || apiKey !== validApiKey) {
            this.logger.warn(`Unauthorized connection attempt from ${client.id}`);
            client.emit('error', {
                type: 'error',
                sessionId: '',
                code: 'UNAUTHORIZED',
                message: 'Invalid API key',
            });
            client.disconnect();
            return;
        }
        this.logger.log(`Client connected: ${client.id}`);
        this.clientSessions.set(client.id, new Set());
    }
    async handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const sessions = this.clientSessions.get(client.id);
        if (sessions) {
            for (const sessionId of sessions) {
                this.claudeService.destroySession(sessionId);
            }
            this.clientSessions.delete(client.id);
        }
    }
    async handleInitSession(client, data) {
        const { sessionId, projectId } = data;
        this.logger.log(`Init session: ${sessionId} for project: ${projectId}`);
        try {
            const projectPath = projectId;
            await this.claudeService.initSession(sessionId, projectPath);
            const sessions = this.clientSessions.get(client.id);
            if (sessions) {
                sessions.add(sessionId);
            }
            client.join(sessionId);
            this.sendToSession(client, sessionId, {
                type: 'session_ready',
                sessionId,
            });
            this.sendToSession(client, sessionId, {
                type: 'status',
                sessionId,
                status: 'idle',
            });
        }
        catch (error) {
            this.sendError(client, sessionId, 'INIT_FAILED', error.message);
        }
    }
    async handleExecute(client, data) {
        const { sessionId, prompt, projectPath } = data;
        this.logger.log(`Execute in session ${sessionId}: ${prompt.substring(0, 50)}...`);
        try {
            this.sendToSession(client, sessionId, {
                type: 'status',
                sessionId,
                status: 'running',
            });
            const emitter = await this.claudeService.execute(sessionId, prompt, projectPath);
            emitter.on('output', (output) => {
                if (output.type === 'output') {
                    this.sendToSession(client, sessionId, {
                        type: 'output',
                        sessionId,
                        content: output.content || '',
                        outputType: output.outputType || 'text',
                        isFinal: output.isFinal || false,
                    });
                }
                else if (output.type === 'error') {
                    this.sendError(client, sessionId, 'EXECUTION_ERROR', output.content || 'Unknown error');
                }
                else if (output.type === 'exit') {
                    this.sendToSession(client, sessionId, {
                        type: 'status',
                        sessionId,
                        status: 'idle',
                    });
                }
            });
        }
        catch (error) {
            this.sendError(client, sessionId, 'EXECUTE_FAILED', error.message);
            this.sendToSession(client, sessionId, {
                type: 'status',
                sessionId,
                status: 'idle',
            });
        }
    }
    async handleStop(client, data) {
        const { sessionId } = data;
        this.logger.log(`Stop session: ${sessionId}`);
        try {
            await this.claudeService.stopSession(sessionId);
            this.sendToSession(client, sessionId, {
                type: 'status',
                sessionId,
                status: 'stopped',
            });
        }
        catch (error) {
            this.sendError(client, sessionId, 'STOP_FAILED', error.message);
        }
    }
    handlePing(client) {
        client.emit('pong', { timestamp: Date.now() });
    }
    sendToSession(client, sessionId, message) {
        client.emit('message', message);
    }
    sendError(client, sessionId, code, message) {
        client.emit('message', {
            type: 'error',
            sessionId,
            code,
            message,
        });
    }
};
exports.ClaudeGateway = ClaudeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ClaudeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('init_session'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ClaudeGateway.prototype, "handleInitSession", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('execute'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ClaudeGateway.prototype, "handleExecute", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('stop'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ClaudeGateway.prototype, "handleStop", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ClaudeGateway.prototype, "handlePing", null);
exports.ClaudeGateway = ClaudeGateway = ClaudeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        transports: ['websocket', 'polling'],
    }),
    __metadata("design:paramtypes", [claude_service_1.ClaudeService,
        config_1.ConfigService])
], ClaudeGateway);
//# sourceMappingURL=claude.gateway.js.map