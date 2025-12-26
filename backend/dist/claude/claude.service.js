"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ClaudeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const events_1 = require("events");
let ClaudeService = ClaudeService_1 = class ClaudeService {
    logger = new common_1.Logger(ClaudeService_1.name);
    sessions = new Map();
    async initSession(sessionId, projectPath) {
        if (this.sessions.has(sessionId)) {
            this.logger.warn(`Session ${sessionId} already exists, cleaning up`);
            await this.stopSession(sessionId);
        }
        const emitter = new events_1.EventEmitter();
        this.sessions.set(sessionId, {
            process: null,
            emitter,
            projectPath,
        });
        this.logger.log(`Session ${sessionId} initialized for project: ${projectPath}`);
    }
    async execute(sessionId, prompt, projectPath) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        if (session.process && !session.process.killed) {
            session.process.kill('SIGTERM');
        }
        const emitter = session.emitter;
        const claudeProcess = (0, child_process_1.spawn)('claude', ['-p', prompt, '--output-format', 'stream-json'], {
            cwd: projectPath,
            env: {
                ...process.env,
                FORCE_COLOR: '0',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        session.process = claudeProcess;
        let buffer = '';
        let currentOutputType = 'text';
        claudeProcess.stdout?.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const parsed = JSON.parse(line);
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
            const content = data.toString();
            this.logger.error(`Claude stderr: ${content}`);
            emitter.emit('output', {
                type: 'error',
                content,
            });
        });
        claudeProcess.on('close', (code) => {
            this.logger.log(`Claude process exited with code ${code}`);
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
            return {
                type: 'output',
                content: parsed.result || '',
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
    async stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Attempted to stop non-existent session ${sessionId}`);
            return;
        }
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
};
exports.ClaudeService = ClaudeService;
exports.ClaudeService = ClaudeService = ClaudeService_1 = __decorate([
    (0, common_1.Injectable)()
], ClaudeService);
//# sourceMappingURL=claude.service.js.map