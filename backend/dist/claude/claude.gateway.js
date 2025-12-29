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
        const pendingAuthUrl = this.claudeService.getPendingAuthUrl();
        if (pendingAuthUrl) {
            this.logger.log(`Sending pending auth URL to client: ${clientId}`);
            this.sendMessage(client, {
                type: 'auth_required',
                sessionId: '',
                authUrl: pendingAuthUrl,
                message: 'Claude requires authentication. Please log in to continue.',
            });
        }
    }
    async handleDisconnect(client) {
        const clientId = client.clientId;
        this.logger.log(`Client disconnected: ${clientId}`);
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
                case 'login':
                    await this.handleLogin(client);
                    break;
                case 'submit_auth_code':
                    await this.handleSubmitAuthCode(client, data);
                    break;
                case 'pty_input':
                    this.handlePtyInput(client, data);
                    break;
                case 'start_interactive':
                    await this.handleStartInteractive(client, data);
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
            emitter.on('output', async (output) => {
                if (output.type === 'output') {
                    this.sendMessage(client, {
                        type: 'output',
                        sessionId,
                        content: output.content || '',
                        outputType: output.outputType || 'text',
                        isFinal: output.isFinal || false,
                    });
                }
                else if (output.type === 'auth_required') {
                    if (!output.authUrl) {
                        this.logger.log('No auth URL in output, triggering login...');
                        const { url: authUrl, emitter: loginEmitter } = await this.claudeService.triggerLogin();
                        loginEmitter.on('pty_output', (output) => {
                            if (output) {
                                this.sendMessage(client, {
                                    type: 'pty_output',
                                    sessionId,
                                    content: output,
                                });
                            }
                        });
                        loginEmitter.on('auth_success', () => {
                            this.logger.log('Auth success received during execute, notifying client');
                            this.sendMessage(client, {
                                type: 'auth_success',
                                sessionId,
                                message: 'Successfully authenticated with Claude!',
                            });
                        });
                        loginEmitter.on('auth_failed', (reason) => {
                            this.logger.log(`Auth failed during execute: ${reason}`);
                            this.sendError(client, sessionId, 'AUTH_FAILED', reason);
                        });
                        this.sendMessage(client, {
                            type: 'login_interactive',
                            sessionId,
                            message: 'Claude login started. Type /login to authenticate.',
                        });
                        if (authUrl) {
                            this.sendMessage(client, {
                                type: 'auth_required',
                                sessionId,
                                authUrl: authUrl,
                                message: 'Please authenticate with Claude to continue.',
                            });
                        }
                    }
                    else {
                        this.sendMessage(client, {
                            type: 'auth_required',
                            sessionId,
                            authUrl: output.authUrl,
                            message: output.content || 'Authentication required',
                        });
                    }
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
    async handleLogin(client) {
        this.logger.log('Handling login request');
        try {
            const { url: authUrl, emitter } = await this.claudeService.triggerLogin();
            if (authUrl) {
                emitter.on('auth_success', () => {
                    this.logger.log('Auth success received, notifying client');
                    this.sendMessage(client, {
                        type: 'auth_success',
                        sessionId: '',
                        message: 'Successfully authenticated with Claude!',
                    });
                });
                emitter.on('auth_failed', (reason) => {
                    this.logger.log(`Auth failed: ${reason}`);
                    this.sendError(client, '', 'AUTH_FAILED', reason);
                });
                this.sendMessage(client, {
                    type: 'auth_required',
                    sessionId: '',
                    authUrl,
                    message: 'Please authenticate with Claude to continue.',
                });
            }
            else if (this.claudeService.isClaudeAuthenticated()) {
                this.logger.log('User already authenticated, notifying client');
                this.sendMessage(client, {
                    type: 'auth_success',
                    sessionId: '',
                    message: 'Already authenticated with Claude!',
                });
            }
            else {
                this.sendError(client, '', 'LOGIN_FAILED', 'Could not get authentication URL. Please try again.');
            }
        }
        catch (error) {
            this.sendError(client, '', 'LOGIN_FAILED', error.message);
        }
    }
    async handleSubmitAuthCode(client, data) {
        const { code } = data;
        this.logger.log('Handling auth code submission');
        if (!code) {
            this.sendError(client, '', 'INVALID_CODE', 'No auth code provided');
            return;
        }
        try {
            const loginEmitter = this.claudeService.getLoginEmitter();
            if (loginEmitter) {
                loginEmitter.on('auth_success', () => {
                    this.logger.log('Auth success after code submission');
                    this.sendMessage(client, {
                        type: 'auth_success',
                        sessionId: '',
                        message: 'Successfully authenticated with Claude!',
                    });
                });
                loginEmitter.on('auth_failed', (reason) => {
                    this.logger.log(`Auth failed after code submission: ${reason}`);
                    this.sendError(client, '', 'AUTH_FAILED', reason);
                });
            }
            const success = await this.claudeService.submitAuthCode(code);
            if (success) {
                this.sendMessage(client, {
                    type: 'auth_code_submitted',
                    sessionId: '',
                    message: 'Auth code submitted, waiting for verification...',
                });
            }
            else {
                this.sendError(client, '', 'CODE_SUBMIT_FAILED', 'Failed to submit auth code. No active login process.');
            }
        }
        catch (error) {
            this.sendError(client, '', 'CODE_SUBMIT_FAILED', error.message);
        }
    }
    async handleStartInteractive(client, data) {
        const { sessionId, projectPath } = data;
        this.logger.log(`Starting interactive session ${sessionId} for project: ${projectPath}`);
        try {
            client.sessionIds.add(sessionId);
            this.sendMessage(client, {
                type: 'status',
                sessionId,
                status: 'running',
            });
            const emitter = await this.claudeService.startInteractiveSession(sessionId, projectPath);
            emitter.on('pty_output', (output) => {
                if (output) {
                    this.sendMessage(client, {
                        type: 'pty_output',
                        sessionId,
                        content: output,
                    });
                }
            });
            emitter.on('output', (output) => {
                if (output.type === 'auth_required') {
                    this.sendMessage(client, {
                        type: 'auth_required',
                        sessionId,
                        authUrl: output.authUrl,
                        message: output.content || 'Authentication required',
                    });
                }
                else if (output.type === 'exit') {
                    this.sendMessage(client, {
                        type: 'status',
                        sessionId,
                        status: 'idle',
                    });
                }
            });
            this.sendMessage(client, {
                type: 'interactive_started',
                sessionId,
                message: 'Interactive Claude session started',
            });
        }
        catch (error) {
            this.sendError(client, sessionId, 'START_INTERACTIVE_FAILED', error.message);
        }
    }
    handlePtyInput(client, data) {
        const { sessionId, input } = data;
        if (!input) {
            return;
        }
        let success;
        if (sessionId) {
            success = this.claudeService.sendSessionPtyInput(sessionId, input);
        }
        else {
            success = this.claudeService.sendPtyInput(input);
        }
        if (!success) {
            this.sendError(client, sessionId || '', 'PTY_INPUT_FAILED', 'No active PTY session to send input to.');
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