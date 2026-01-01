"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ClaudeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const events_1 = require("events");
const pty = __importStar(require("node-pty"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const terminal_buffer_service_1 = require("./terminal-buffer.service");
let ClaudeService = ClaudeService_1 = class ClaudeService {
    configService;
    terminalBufferService;
    logger = new common_1.Logger(ClaudeService_1.name);
    sessions = new Map();
    pendingAuthUrl = null;
    isAuthenticated = false;
    loginPtyProcess = null;
    loginEmitter = null;
    SESSION_METADATA_PATH = path.join(process.cwd(), '.claude-sessions.json');
    SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    persistedSessions = new Map();
    constructor(configService, terminalBufferService) {
        this.configService = configService;
        this.terminalBufferService = terminalBufferService;
    }
    async onModuleInit() {
        await this.verifyCliInstalled();
        this.loadPersistedSessions();
        await this.checkAuthStatus();
    }
    loadPersistedSessions() {
        try {
            if (!fs.existsSync(this.SESSION_METADATA_PATH)) {
                this.logger.log('No persisted sessions file found, starting fresh');
                return;
            }
            const data = fs.readFileSync(this.SESSION_METADATA_PATH, 'utf-8');
            const sessions = JSON.parse(data);
            const now = Date.now();
            let expiredCount = 0;
            for (const session of sessions) {
                const lastActivity = new Date(session.lastActivityAt).getTime();
                if (now - lastActivity < this.SESSION_TTL_MS) {
                    this.persistedSessions.set(session.sessionId, session);
                }
                else {
                    expiredCount++;
                }
            }
            this.logger.log(`Loaded ${this.persistedSessions.size} persisted sessions, expired ${expiredCount}`);
            if (expiredCount > 0) {
                this.savePersistedSessions();
            }
        }
        catch (error) {
            this.logger.error(`Failed to load persisted sessions: ${error.message}`);
        }
    }
    savePersistedSessions() {
        try {
            const sessions = Array.from(this.persistedSessions.values());
            fs.writeFileSync(this.SESSION_METADATA_PATH, JSON.stringify(sessions, null, 2), 'utf-8');
            this.logger.log(`Saved ${sessions.length} sessions to ${this.SESSION_METADATA_PATH}`);
        }
        catch (error) {
            this.logger.error(`Failed to save persisted sessions: ${error.message}`);
        }
    }
    persistSession(sessionId, projectPath, claudeSessionId) {
        const now = new Date().toISOString();
        const existing = this.persistedSessions.get(sessionId);
        const metadata = {
            sessionId,
            claudeSessionId: claudeSessionId || existing?.claudeSessionId,
            projectPath,
            createdAt: existing?.createdAt || now,
            lastActivityAt: now,
        };
        this.persistedSessions.set(sessionId, metadata);
        this.savePersistedSessions();
    }
    getPersistedClaudeSessionId(sessionId) {
        return this.persistedSessions.get(sessionId)?.claudeSessionId;
    }
    async verifyCliInstalled() {
        this.logger.log('Verifying Claude CLI installation...');
        try {
            const version = (0, child_process_1.execSync)('claude --version', { timeout: 10000 }).toString().trim();
            this.logger.log(`Claude CLI version: ${version}`);
        }
        catch (error) {
            this.logger.error(`Claude CLI not working: ${error.message}`);
        }
    }
    async checkAuthStatus() {
        this.logger.log('Checking Claude authentication status...');
        try {
            const claudeProcess = (0, child_process_1.spawn)('claude', [
                '-p', 'echo test',
                '--output-format', 'json',
                '--dangerously-skip-permissions',
                '--debug', 'api,auth',
                '--verbose',
            ], {
                cwd: '/tmp',
                env: {
                    ...process.env,
                    FORCE_COLOR: '0',
                    CI: '1',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            claudeProcess.stdin?.end();
            let stderrOutput = '';
            let stdoutOutput = '';
            claudeProcess.stdout?.on('data', (data) => {
                const chunk = data.toString();
                stdoutOutput += chunk;
                this.logger.log(`Auth check stdout: ${chunk.substring(0, 500)}`);
            });
            claudeProcess.stderr?.on('data', (data) => {
                const chunk = data.toString();
                stderrOutput += chunk;
                this.logger.log(`Auth check stderr: ${chunk.substring(0, 500)}`);
            });
            claudeProcess.on('close', (code) => {
                const authUrl = this.extractAuthUrl(stderrOutput);
                if (authUrl) {
                    this.pendingAuthUrl = authUrl;
                    this.isAuthenticated = false;
                    this.logger.warn(`Claude requires authentication. Auth URL: ${authUrl}`);
                }
                else if (code === 0) {
                    this.isAuthenticated = true;
                    this.pendingAuthUrl = null;
                    this.logger.log('Claude is authenticated and ready');
                }
                else {
                    this.logger.warn(`Claude auth check exited with code ${code}`);
                }
            });
            claudeProcess.on('error', (error) => {
                this.logger.error(`Failed to check Claude auth: ${error.message}`);
            });
        }
        catch (error) {
            this.logger.error(`Error checking Claude auth status: ${error.message}`);
        }
    }
    getPendingAuthUrl() {
        return this.pendingAuthUrl;
    }
    isClaudeAuthenticated() {
        return this.isAuthenticated;
    }
    clearPendingAuth() {
        this.pendingAuthUrl = null;
        this.isAuthenticated = true;
    }
    async triggerLogin() {
        this.logger.log('Triggering Claude login flow via PTY...');
        if (this.loginPtyProcess) {
            this.logger.log('Killing existing login PTY process');
            this.loginPtyProcess.kill();
            this.loginPtyProcess = null;
        }
        const emitter = new events_1.EventEmitter();
        this.loginEmitter = emitter;
        return new Promise((resolve) => {
            let output = '';
            let foundUrl = null;
            const ptyProcess = pty.spawn('claude', ['login'], {
                name: 'xterm-256color',
                cols: 120,
                rows: 30,
                cwd: '/tmp',
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    FORCE_COLOR: '1',
                },
            });
            this.loginPtyProcess = ptyProcess;
            this.logger.log(`PTY login process spawned with PID: ${ptyProcess.pid}`);
            let readyForCode = false;
            let authSuccessEmitted = false;
            let killedByTimeout = false;
            let lastEnterPress = 0;
            ptyProcess.onData((data) => {
                output += data;
                const cleanData = this.stripAnsiAndControl(data);
                if (cleanData) {
                    emitter.emit('pty_output', cleanData);
                }
                if (!authSuccessEmitted && cleanData.includes('Welcome back')) {
                    this.logger.log('User already authenticated (Welcome back detected)');
                    this.isAuthenticated = true;
                    this.pendingAuthUrl = null;
                    authSuccessEmitted = true;
                    setTimeout(() => {
                        if (this.loginPtyProcess === ptyProcess) {
                            ptyProcess.kill();
                            this.loginPtyProcess = null;
                        }
                    }, 100);
                    emitter.emit('auth_success');
                    if (!foundUrl) {
                        resolve({ url: null, emitter });
                    }
                    return;
                }
                const isOnboardingPrompt = (cleanData.includes('Dark mode') ||
                    cleanData.includes('Light mode') ||
                    cleanData.includes('Choose the text style') ||
                    cleanData.includes('Let\'s get started') ||
                    cleanData.includes('Ready to code here') ||
                    cleanData.includes('Yes, continue') ||
                    /[❯>]\s*\d+\.\s*(Yes|Dark|Light)/i.test(cleanData));
                const isAuthCodePrompt = (cleanData.includes('Paste your') ||
                    cleanData.includes('Enter the code') ||
                    cleanData.includes('authorization code') ||
                    cleanData.includes('console.anthropic.com'));
                const now = Date.now();
                if (isOnboardingPrompt && !isAuthCodePrompt && !readyForCode && (now - lastEnterPress > 1000)) {
                    lastEnterPress = now;
                    setTimeout(() => {
                        if (this.loginPtyProcess === ptyProcess) {
                            ptyProcess.write('\r');
                        }
                    }, 500);
                }
                if (cleanData.includes('Paste your') ||
                    cleanData.includes('Enter the code') ||
                    cleanData.includes('paste the code') ||
                    cleanData.includes('authorization code')) {
                    readyForCode = true;
                }
                const url = this.extractAuthUrl(data);
                if (url && !foundUrl) {
                    foundUrl = url;
                    this.pendingAuthUrl = url;
                    readyForCode = true;
                    resolve({ url, emitter });
                }
                if (!authSuccessEmitted && (cleanData.includes('Successfully authenticated') ||
                    cleanData.includes('Authentication successful') ||
                    cleanData.includes('Logged in as'))) {
                    this.isAuthenticated = true;
                    this.pendingAuthUrl = null;
                    authSuccessEmitted = true;
                    emitter.emit('auth_success');
                }
                if (cleanData.includes('OAuth error') ||
                    cleanData.includes('Invalid code') ||
                    cleanData.includes('expired')) {
                    this.logger.warn(`Auth error detected: ${cleanData.substring(0, 100)}`);
                    emitter.emit('auth_failed', cleanData);
                }
            });
            ptyProcess.onExit(({ exitCode }) => {
                this.logger.log(`PTY login process exited with code ${exitCode}, killedByTimeout: ${killedByTimeout}`);
                this.loginPtyProcess = null;
                if (killedByTimeout) {
                    this.logger.log('Process was killed by timeout, not emitting auth_success');
                    if (!foundUrl) {
                        resolve({ url: null, emitter });
                    }
                    return;
                }
                if (exitCode === 0 && !authSuccessEmitted && foundUrl) {
                    this.logger.log('Authentication successful based on exit code 0');
                    this.isAuthenticated = true;
                    this.pendingAuthUrl = null;
                    authSuccessEmitted = true;
                    emitter.emit('auth_success');
                }
                else if (exitCode !== 0) {
                    emitter.emit('auth_failed', `Process exited with code ${exitCode}`);
                }
                if (!foundUrl) {
                    this.logger.warn(`No auth URL found. Full output: ${output.substring(0, 500)}`);
                    resolve({ url: null, emitter });
                }
            });
            setTimeout(() => {
                if (!foundUrl) {
                    this.logger.warn(`PTY timeout - no auth URL found. Output: ${output.substring(0, 500)}`);
                    killedByTimeout = true;
                    ptyProcess.kill();
                    this.loginPtyProcess = null;
                    resolve({ url: null, emitter });
                }
            }, 60000);
        });
    }
    async submitAuthCode(code) {
        this.logger.log(`Submitting auth code: ${code.substring(0, 20)}...`);
        if (!this.loginPtyProcess) {
            this.logger.error('No active login PTY process to submit code to');
            return false;
        }
        try {
            const cleanCode = code.trim();
            this.logger.log(`Clean code length: ${cleanCode.length}`);
            this.loginPtyProcess.write(cleanCode + '\n');
            this.logger.log('Auth code submitted to PTY');
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to submit auth code: ${error.message}`);
            return false;
        }
    }
    getLoginEmitter() {
        return this.loginEmitter;
    }
    sendPtyInput(input) {
        if (!this.loginPtyProcess) {
            this.logger.error('No active login PTY process');
            return false;
        }
        try {
            this.loginPtyProcess.write(input);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send PTY input: ${error.message}`);
            return false;
        }
    }
    sendSessionPtyInput(sessionId, input) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.error(`Session ${sessionId} not found`);
            return false;
        }
        if (!session.ptyProcess) {
            this.logger.error(`No active PTY for session ${sessionId}`);
            return false;
        }
        try {
            session.ptyProcess.write(input);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send PTY input: ${error.message}`);
            return false;
        }
    }
    async startInteractiveSession(sessionId, projectPath) {
        this.logger.log(`Starting interactive session ${sessionId} for project: ${projectPath}`);
        const persistedClaudeSessionId = this.getPersistedClaudeSessionId(sessionId);
        if (persistedClaudeSessionId) {
            this.logger.log(`Found persisted Claude session ID: ${persistedClaudeSessionId}`);
        }
        let session = this.sessions.get(sessionId);
        if (!session) {
            const emitter = new events_1.EventEmitter();
            session = {
                process: null,
                emitter,
                projectPath,
                claudeSessionId: persistedClaudeSessionId,
                ptyBuffer: '',
                lastSentLength: 0,
            };
            this.sessions.set(sessionId, session);
        }
        else if (persistedClaudeSessionId && !session.claudeSessionId) {
            session.claudeSessionId = persistedClaudeSessionId;
        }
        this.persistSession(sessionId, projectPath, session.claudeSessionId);
        if (session.ptyProcess) {
            this.logger.log(`Killing existing PTY for session ${sessionId}`);
            session.ptyProcess.kill();
            session.ptyProcess = undefined;
        }
        session.ptyBuffer = '';
        session.lastSentLength = 0;
        const emitter = session.emitter;
        if (this.pendingAuthUrl) {
            this.logger.log('Auth pending, but still spawning PTY for /login command');
        }
        const fs = await import('fs');
        let workingDir = '/tmp';
        try {
            if (fs.existsSync(projectPath)) {
                workingDir = projectPath;
                this.logger.log(`Using provided project path: ${workingDir}`);
            }
            else {
                this.logger.log(`Project path ${projectPath} doesn't exist, using /tmp`);
            }
        }
        catch (err) {
            this.logger.warn(`Error checking path ${projectPath}: ${err.message}`);
        }
        const cliArgs = ['--dangerously-skip-permissions'];
        if (session.claudeSessionId) {
            cliArgs.push('--resume', session.claudeSessionId);
            this.logger.log(`Resuming Claude conversation: ${session.claudeSessionId}`);
        }
        const ptyProcess = pty.spawn('claude', cliArgs, {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd: workingDir,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                FORCE_COLOR: '1',
            },
        });
        session.ptyProcess = ptyProcess;
        this.logger.log(`Interactive PTY spawned with PID: ${ptyProcess.pid} in cwd: ${workingDir}, args: ${cliArgs.join(' ')}`);
        this.terminalBufferService.createBuffer(sessionId, 120, 30);
        ptyProcess.onData((data) => {
            this.terminalBufferService.write(sessionId, data);
            this.terminalBufferService.getSnapshotThrottled(sessionId, (snapshot) => {
                emitter.emit('terminal_buffer', snapshot);
            });
            const filteredData = this.filterProcessingSpam(data, session);
            if (filteredData) {
                emitter.emit('pty_output', filteredData);
            }
            const authUrl = this.extractAuthUrl(data);
            if (authUrl) {
                this.pendingAuthUrl = authUrl;
                this.isAuthenticated = false;
                emitter.emit('output', {
                    type: 'auth_required',
                    content: 'Claude requires authentication',
                    authUrl,
                });
            }
            const rawText = this.stripAnsiAndControl(data);
            if (rawText.includes('Successfully authenticated') ||
                rawText.includes('Authentication successful') ||
                rawText.includes('Logged in as')) {
                this.isAuthenticated = true;
                this.pendingAuthUrl = null;
                emitter.emit('auth_success');
            }
        });
        ptyProcess.onExit(({ exitCode }) => {
            session.ptyProcess = undefined;
            this.terminalBufferService.destroyBuffer(sessionId);
            emitter.emit('output', {
                type: 'exit',
                code: exitCode,
                isFinal: true,
            });
        });
        return emitter;
    }
    async initSession(sessionId, projectPath) {
        if (this.sessions.has(sessionId)) {
            this.logger.warn(`Session ${sessionId} already exists, cleaning up`);
            await this.stopSession(sessionId);
        }
        const persistedClaudeSessionId = this.getPersistedClaudeSessionId(sessionId);
        if (persistedClaudeSessionId) {
            this.logger.log(`Restoring Claude session ID: ${persistedClaudeSessionId}`);
        }
        const emitter = new events_1.EventEmitter();
        this.sessions.set(sessionId, {
            process: null,
            emitter,
            projectPath,
            claudeSessionId: persistedClaudeSessionId,
            ptyBuffer: '',
            lastSentLength: 0,
        });
        this.persistSession(sessionId, projectPath, persistedClaudeSessionId);
        this.logger.log(`Session ${sessionId} initialized for project: ${projectPath}`);
    }
    async execute(sessionId, prompt, projectPath) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        if (!session.claudeSessionId) {
            const persistedClaudeSessionId = this.getPersistedClaudeSessionId(sessionId);
            if (persistedClaudeSessionId) {
                session.claudeSessionId = persistedClaudeSessionId;
                this.logger.log(`Restored Claude session ID from persistence: ${persistedClaudeSessionId}`);
            }
        }
        if (session.process && !session.process.killed) {
            session.process.kill('SIGTERM');
        }
        const emitter = session.emitter;
        if (this.pendingAuthUrl) {
            emitter.emit('output', {
                type: 'auth_required',
                content: 'Claude requires authentication',
                authUrl: this.pendingAuthUrl,
            });
            return emitter;
        }
        const hasOAuthToken = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
        const hasAuthToken = !!process.env.ANTHROPIC_AUTH_TOKEN;
        const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
        this.logger.log(`Spawning Claude CLI (CLAUDE_CODE_OAUTH_TOKEN: ${hasOAuthToken}, ANTHROPIC_AUTH_TOKEN: ${hasAuthToken}, ANTHROPIC_API_KEY: ${hasApiKey})`);
        this.logger.log(`Working directory: ${projectPath}`);
        const args = [
            '-p', prompt,
            '--output-format', 'stream-json',
            '--dangerously-skip-permissions',
            '--debug', 'api,auth',
            '--verbose',
        ];
        if (session.claudeSessionId) {
            args.push('--resume', session.claudeSessionId);
            this.logger.log(`Resuming Claude session: ${session.claudeSessionId}`);
        }
        this.logger.log(`Claude args: ${args.join(' ')}`);
        const claudeProcess = (0, child_process_1.spawn)('claude', args, {
            cwd: projectPath,
            env: {
                ...process.env,
                FORCE_COLOR: '0',
                CI: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.logger.log(`Claude process spawned with PID: ${claudeProcess.pid}`);
        claudeProcess.stdin?.end();
        session.process = claudeProcess;
        const startupTimeout = setTimeout(() => {
            this.logger.warn(`Claude process ${claudeProcess.pid} produced no output after 30s - may be hanging`);
        }, 30000);
        let buffer = '';
        let hasReceivedOutput = false;
        const currentOutputType = 'text';
        claudeProcess.stdout?.on('data', (data) => {
            if (!hasReceivedOutput) {
                hasReceivedOutput = true;
                clearTimeout(startupTimeout);
            }
            const chunk = data.toString();
            this.logger.log(`Claude stdout (${chunk.length} bytes): ${chunk.substring(0, 200)}...`);
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.session_id && !session.claudeSessionId) {
                        session.claudeSessionId = parsed.session_id;
                        this.logger.log(`Captured Claude session ID: ${parsed.session_id}`);
                        this.persistSession(sessionId, projectPath, parsed.session_id);
                    }
                    const output = this.parseClaudeOutput(parsed);
                    if (output) {
                        emitter.emit('output', output);
                    }
                }
                catch {
                    const detectedType = this.detectOutputType(line);
                    emitter.emit('output', {
                        type: 'output',
                        content: line,
                        outputType: detectedType,
                        isFinal: false,
                    });
                }
            }
        });
        claudeProcess.stderr?.on('data', (data) => {
            if (!hasReceivedOutput) {
                hasReceivedOutput = true;
                clearTimeout(startupTimeout);
            }
            const content = data.toString();
            this.logger.warn(`Claude stderr (${content.length} bytes): ${content.substring(0, 500)}`);
            const authUrl = this.extractAuthUrl(content);
            if (authUrl) {
                this.pendingAuthUrl = authUrl;
                this.isAuthenticated = false;
                this.logger.log(`Auth required, URL: ${authUrl}`);
                emitter.emit('output', {
                    type: 'auth_required',
                    content: 'Claude requires authentication',
                    authUrl,
                });
                return;
            }
            emitter.emit('output', {
                type: 'error',
                content,
            });
        });
        claudeProcess.on('close', (code) => {
            clearTimeout(startupTimeout);
            this.logger.log(`Claude process exited with code ${code}`);
            if (code === 0) {
                this.isAuthenticated = true;
                this.pendingAuthUrl = null;
            }
            if (buffer.trim()) {
                emitter.emit('output', {
                    type: 'output',
                    content: buffer,
                    outputType: 'text',
                    isFinal: false,
                });
            }
            emitter.emit('output', {
                type: 'exit',
                code: code ?? 0,
                isFinal: true,
            });
        });
        claudeProcess.on('error', (error) => {
            this.logger.error(`Claude process error: ${error.message}`);
            emitter.emit('output', {
                type: 'error',
                content: error.message,
            });
        });
        return emitter;
    }
    parseClaudeOutput(parsed) {
        if (parsed.type === 'assistant') {
            return {
                type: 'output',
                content: parsed.message?.content || '',
                outputType: 'text',
                isFinal: false,
            };
        }
        if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta;
            if (delta?.type === 'text_delta') {
                return {
                    type: 'output',
                    content: delta.text || '',
                    outputType: 'text',
                    isFinal: false,
                };
            }
            if (delta?.type === 'thinking_delta') {
                return {
                    type: 'output',
                    content: delta.thinking || '',
                    outputType: 'thinking',
                    isFinal: false,
                };
            }
        }
        if (parsed.type === 'result') {
            const result = parsed.result || '';
            if (result.includes('Please run /login') || result.includes('Invalid API key')) {
                return {
                    type: 'auth_required',
                    content: result,
                    authUrl: this.pendingAuthUrl || undefined,
                };
            }
            return {
                type: 'output',
                content: result,
                outputType: 'text',
                isFinal: true,
            };
        }
        if (parsed.type === 'system' && parsed.subtype === 'tool_use') {
            if (parsed.tool === 'Write' || parsed.tool === 'Edit') {
                return {
                    type: 'output',
                    content: JSON.stringify({
                        tool: parsed.tool,
                        file: parsed.input?.file_path,
                    }),
                    outputType: 'file_change',
                    isFinal: false,
                };
            }
        }
        if (typeof parsed === 'string') {
            return {
                type: 'output',
                content: parsed,
                outputType: this.detectOutputType(parsed),
                isFinal: false,
            };
        }
        return null;
    }
    detectOutputType(content) {
        if (content.includes('```') || content.match(/^\s{4,}/m)) {
            return 'code_block';
        }
        if (content.includes('<thinking>') || content.includes('</thinking>')) {
            return 'thinking';
        }
        if (content.includes('Created:') ||
            content.includes('Modified:') ||
            content.includes('File:')) {
            return 'file_change';
        }
        return 'text';
    }
    stripAnsiAndControl(data) {
        return data
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')
            .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '')
            .replace(/\x1b[\(\)][AB012]/g, '')
            .replace(/\x1b[=>]/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
    extractClaudeResponse(data) {
        const cleaned = this.stripAnsiAndControl(data);
        const uiPatterns = [
            /^Claude Code v[\d.]+/,
            /^Tips for getting started/,
            /^Welcome back/,
            /^\s*Organization\s*$/,
            /^Model:/,
            /^Context:/,
            /^\s*>\s*$/,
            /^>\s+\S/,
            /esc to interrupt/i,
            /Enchanting/,
            /Thinking/,
            /bypass permissions/i,
            /shift\+tab to cycle/i,
            /Tip:/i,
            /Did you know/i,
            /drag and drop/i,
            /Recent activity/i,
            /No recent/i,
            /↵\s*send/i,
            /UserPromptSubmit hook/i,
            /^\*\s*[▛▜▝▘▙▟]\s*\*/,
            /^\s*\*\s+\*\s*$/,
            /cycle\)$/,
        ];
        const lines = cleaned.split('\n').filter(line => {
            const trimmed = line.trim();
            if (!trimmed)
                return false;
            for (const pattern of uiPatterns) {
                if (pattern.test(trimmed))
                    return false;
            }
            return true;
        });
        const result = lines.join('\n').trim();
        return result || null;
    }
    filterProcessingSpam(data, session) {
        const cleanData = this.stripAnsiAndControl(data).trim();
        const pureSpinnerPattern = /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▁▂▃▄▅▆▇█]+$/;
        const isPureSpinner = pureSpinnerPattern.test(cleanData);
        const now = Date.now();
        if (isPureSpinner) {
            if (session.isProcessing && session.lastProcessingTime && (now - session.lastProcessingTime < 500)) {
                return null;
            }
            session.isProcessing = true;
            session.lastProcessingTime = now;
        }
        else if (cleanData.length > 0) {
            session.isProcessing = false;
        }
        return data;
    }
    extractAuthUrl(content) {
        const cleanContent = this.stripAnsiAndControl(content);
        const urlPatterns = [
            /https:\/\/console\.anthropic\.com[^\s]*/gi,
            /https:\/\/[^\s]+(?:login|auth|oauth|code|device)[^\s]*/gi,
            /(?:visit|open|go to|navigate to)[:\s]+([^\s]+)/gi,
            /https:\/\/[^\s]*anthropic\.com[^\s]*/gi,
            /https:\/\/[^\s]*claude\.ai[^\s]*/gi,
        ];
        for (const pattern of urlPatterns) {
            const match = cleanContent.match(pattern);
            if (match) {
                let url = match[0]
                    .replace(/[.,;:!?)"'\]]+$/, '')
                    .replace(/[\x00-\x1f\x7f-\x9f]/g, '');
                if (match[1]) {
                    url = match[1]
                        .replace(/[.,;:!?)"'\]]+$/, '')
                        .replace(/[\x00-\x1f\x7f-\x9f]/g, '');
                }
                if (url.startsWith('https://')) {
                    try {
                        return decodeURIComponent(url);
                    }
                    catch {
                        return url;
                    }
                }
            }
        }
        return null;
    }
    async stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Attempted to stop non-existent session ${sessionId}`);
            return;
        }
        if (session.ptyProcess) {
            this.logger.log(`Stopping PTY for session ${sessionId}`);
            session.ptyProcess.kill();
            session.ptyProcess = undefined;
        }
        this.terminalBufferService.destroyBuffer(sessionId);
        if (session.process && !session.process.killed) {
            this.logger.log(`Stopping session ${sessionId}`);
            session.process.kill('SIGTERM');
            setTimeout(() => {
                if (session.process && !session.process.killed) {
                    this.logger.warn(`Force killing session ${sessionId}`);
                    session.process.kill('SIGKILL');
                }
            }, 5000);
        }
        session.emitter.emit('output', {
            type: 'exit',
            code: -1,
            isFinal: true,
        });
    }
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.process && !session.process.killed) {
                session.process.kill('SIGKILL');
            }
            if (session.ptyProcess) {
                session.ptyProcess.kill();
            }
            this.terminalBufferService.destroyBuffer(sessionId);
            session.emitter.removeAllListeners();
            this.sessions.delete(sessionId);
            this.logger.log(`Session ${sessionId} destroyed`);
        }
    }
    hasSession(sessionId) {
        return this.sessions.has(sessionId);
    }
    isRunning(sessionId) {
        const session = this.sessions.get(sessionId);
        return !!(session?.process && !session.process.killed);
    }
    hasActiveSession(sessionId) {
        const session = this.sessions.get(sessionId);
        const hasBuffer = this.terminalBufferService.hasBuffer(sessionId);
        return !!(session && hasBuffer);
    }
    isPtyRunning(sessionId) {
        const session = this.sessions.get(sessionId);
        return !!(session?.ptyProcess);
    }
    getSessionBufferSnapshot(sessionId) {
        return this.terminalBufferService.getSnapshot(sessionId, true);
    }
    reattachSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Cannot reattach: session ${sessionId} not found`);
            return null;
        }
        this.logger.log(`Reattaching to session ${sessionId}, has PTY: ${!!session.ptyProcess}`);
        return session.emitter;
    }
    setVoiceMode(sessionId, enabled) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.voiceModeEnabled = enabled;
            this.logger.log(`Voice mode ${enabled ? 'enabled' : 'disabled'} for session ${sessionId}`);
        }
    }
    isVoiceModeEnabled(sessionId) {
        const session = this.sessions.get(sessionId);
        return session?.voiceModeEnabled || false;
    }
    parseVoiceMarkers(content) {
        const cleanContent = this.stripAnsiAndControl(content);
        const voiceMatch = cleanContent.match(/<voice>([\s\S]*?)<\/voice>/);
        if (!voiceMatch)
            return null;
        const voiceContent = voiceMatch[1];
        const speakMatch = voiceContent.match(/<speak>([\s\S]*?)<\/speak>/);
        const promptMatch = voiceContent.match(/<prompt\s+type="([^"]+)">([\s\S]*?)<\/prompt>/);
        const optionsMatch = voiceContent.match(/<options>([\s\S]*?)<\/options>/);
        const speak = speakMatch?.[1]?.trim() || '';
        if (!speak)
            return null;
        const result = {
            speak,
        };
        if (promptMatch) {
            result.promptType = promptMatch[1];
            result.promptText = promptMatch[2]?.trim();
        }
        if (optionsMatch) {
            result.options = optionsMatch[1].split(',').map(o => o.trim()).filter(o => o);
        }
        this.logger.log(`Parsed voice markers: speak="${speak.substring(0, 50)}...", promptType=${result.promptType}`);
        return result;
    }
};
exports.ClaudeService = ClaudeService;
exports.ClaudeService = ClaudeService = ClaudeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        terminal_buffer_service_1.TerminalBufferService])
], ClaudeService);
//# sourceMappingURL=claude.service.js.map