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
var ClaudeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const claude_service_1 = require("./claude.service");
const WS_OPEN = 1;
let ClaudeGateway = ClaudeGateway_1 = class ClaudeGateway {
    claudeService;
    configService;
    server;
    logger = new common_1.Logger(ClaudeGateway_1.name);
    clients = new Map();
    pingInterval;
    constructor(claudeService, configService) {
        this.claudeService = claudeService;
        this.configService = configService;
    }
    afterInit(server) {
        this.logger.log('WebSocket Gateway initialized');
        this.pingInterval = setInterval(() => {
            this.clients.forEach((client, id) => {
                if (!client.isAlive) {
                    this.logger.warn(`Client ${id} not responding, terminating`);
                    client.close();
                    this.clients.delete(id);
                    return;
                }
                client.isAlive = false;
                try {
                    client.send(JSON.stringify({ type: 'ping' }));
                }
                catch {
                }
            });
        }, 30000);
    }
    async handleConnection(client, request) {
        const clientId = this.generateClientId();
        client.clientId = clientId;
        client.sessionIds = new Set();
        client.isAlive = true;
        client.isAuthenticated = false;
        const apiKey = request.headers['x-api-key'] ||
            new URL(request.url || '', 'http://localhost').searchParams.get('apiKey');
        const validApiKey = this.configService.get('API_KEY');
        if (!validApiKey || apiKey !== validApiKey) {
            this.logger.warn(`Unauthorized connection attempt from ${clientId}`);
            this.sendMessage(client, {
                type: 'error',
                sessionId: '',
                code: 'UNAUTHORIZED',
                message: 'Invalid API key',
            });
            client.close();
            return;
        }
        client.isAuthenticated = true;
        this.clients.set(clientId, client);
        this.logger.log(`Client connected: ${clientId}`);
        client.on('message', (data) => {
            this.handleMessage(client, data.toString());
        });
        client.on('pong', () => {
            client.isAlive = true;
        });
    }
    async handleDisconnect(client) {
        const clientId = client.clientId;
        this.logger.log(`Client disconnected: ${clientId}`);
        if (client.sessionIds) {
            for (const sessionId of client.sessionIds) {
                this.claudeService.destroySession(sessionId);
            }
        }
        this.clients.delete(clientId);
    }
    async handleMessage(client, rawData) {
        try {
            const data = JSON.parse(rawData);
            const { type } = data;
            switch (type) {
                case 'init_session':
                    await this.handleInitSession(client, data);
                    break;
                case 'execute':
                    await this.handleExecute(client, data);
                    break;
                case 'stop':
                    await this.handleStop(client, data);
                    break;
                case 'ping':
                    this.handlePing(client);
                    break;
                case 'pong':
                    client.isAlive = true;
                    break;
                default:
                    this.logger.warn(`Unknown message type: ${type}`);
            }
        }
        catch (error) {
            this.logger.error(`Error parsing message: ${error.message}`);
        }
    }
    async handleInitSession(client, data) {
        const { sessionId, projectId } = data;
        this.logger.log(`Init session: ${sessionId} for project: ${projectId}`);
        try {
            const projectPath = projectId;
            await this.claudeService.initSession(sessionId, projectPath);
            client.sessionIds.add(sessionId);
            this.sendMessage(client, {
                type: 'session_ready',
                sessionId,
            });
            this.sendMessage(client, {
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
            this.sendMessage(client, {
                type: 'status',
                sessionId,
                status: 'running',
            });
            const emitter = await this.claudeService.execute(sessionId, prompt, projectPath);
            emitter.on('output', (output) => {
                if (output.type === 'output') {
                    this.sendMessage(client, {
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
                    this.sendMessage(client, {
                        type: 'status',
                        sessionId,
                        status: 'idle',
                    });
                }
            });
        }
        catch (error) {
            this.sendError(client, sessionId, 'EXECUTE_FAILED', error.message);
            this.sendMessage(client, {
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
            this.sendMessage(client, {
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
        client.isAlive = true;
        this.sendMessage(client, { type: 'pong', timestamp: Date.now() });
    }
    sendMessage(client, message) {
        try {
            if (client.readyState === WS_OPEN) {
                client.send(JSON.stringify(message));
            }
        }
        catch (error) {
            this.logger.error(`Error sending message: ${error.message}`);
        }
    }
    sendError(client, sessionId, code, message) {
        this.sendMessage(client, {
            type: 'error',
            sessionId,
            code,
            message,
        });
    }
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    onModuleDestroy() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
    }
};
exports.ClaudeGateway = ClaudeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], ClaudeGateway.prototype, "server", void 0);
exports.ClaudeGateway = ClaudeGateway = ClaudeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [claude_service_1.ClaudeService,
        config_1.ConfigService])
], ClaudeGateway);
//# sourceMappingURL=claude.gateway.js.map