import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
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

interface SessionData {
  process: ChildProcess;
  emitter: EventEmitter;
  projectPath: string;
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private sessions: Map<string, SessionData> = new Map();

  constructor(private configService: ConfigService) {}

  async initSession(sessionId: string, projectPath: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      this.logger.warn(`Session ${sessionId} already exists, cleaning up`);
      await this.stopSession(sessionId);
    }

    const emitter = new EventEmitter();
    this.sessions.set(sessionId, {
      process: null as any,
      emitter,
      projectPath,
    });

    this.logger.log(
      `Session ${sessionId} initialized for project: ${projectPath}`,
    );
  }

  async execute(
    sessionId: string,
    prompt: string,
    projectPath: string,
  ): Promise<EventEmitter> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Kill existing process if running
    if (session.process && !session.process.killed) {
      session.process.kill('SIGTERM');
    }

    const emitter = session.emitter;

    // Get API key from config
    const anthropicApiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured');
    }

    // Spawn Claude CLI process
    const claudeProcess = spawn(
      'claude',
      ['-p', prompt, '--output-format', 'stream-json'],
      {
        cwd: projectPath,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: anthropicApiKey || '',
          FORCE_COLOR: '0',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    session.process = claudeProcess;

    let buffer = '';
    const currentOutputType: OutputType = 'text';

    claudeProcess.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          const output = this.parseClaudeOutput(parsed);
          if (output) {
            emitter.emit('output', output);
          }
        } catch {
          // Not JSON, emit as plain text
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

    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const content = data.toString();
      this.logger.error(`Claude stderr: ${content}`);

      // Check for auth URL in stderr
      const authUrl = this.extractAuthUrl(content);
      if (authUrl) {
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
      this.logger.log(`Claude process exited with code ${code}`);

      // Process any remaining buffer
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

  private parseClaudeOutput(parsed: any): ClaudeOutput | null {
    // Handle different Claude stream-json output formats
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

    // Handle raw text output
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

  private detectOutputType(content: string): OutputType {
    // Detect code blocks
    if (content.includes('```') || content.match(/^\s{4,}/m)) {
      return 'code_block';
    }

    // Detect thinking markers
    if (content.includes('<thinking>') || content.includes('</thinking>')) {
      return 'thinking';
    }

    // Detect file changes
    if (
      content.includes('Created:') ||
      content.includes('Modified:') ||
      content.includes('File:')
    ) {
      return 'file_change';
    }

    return 'text';
  }

  private extractAuthUrl(content: string): string | null {
    // Match various OAuth/login URL patterns
    const urlPatterns = [
      // Direct URL on its own line
      /https:\/\/[^\s]+(?:login|auth|oauth|code)[^\s]*/gi,
      // URL after "visit" or "open" prompt
      /(?:visit|open|go to|navigate to)[:\s]+([^\s]+)/gi,
      // anthropic.com URLs
      /https:\/\/[^\s]*anthropic\.com[^\s]*/gi,
      // claude.ai URLs
      /https:\/\/[^\s]*claude\.ai[^\s]*/gi,
    ];

    for (const pattern of urlPatterns) {
      const match = content.match(pattern);
      if (match) {
        // Clean up the URL (remove trailing punctuation)
        let url = match[0].replace(/[.,;:!?)"'\]]+$/, '');
        // If pattern has capture group, use that
        if (match[1]) {
          url = match[1].replace(/[.,;:!?)"'\]]+$/, '');
        }
        // Only return if it's a valid URL
        if (url.startsWith('https://')) {
          return url;
        }
      }
    }

    return null;
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Attempted to stop non-existent session ${sessionId}`);
      return;
    }

    if (session.process && !session.process.killed) {
      this.logger.log(`Stopping session ${sessionId}`);
      session.process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
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

  destroySession(sessionId: string): void {
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

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  isRunning(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!(session?.process && !session.process.killed);
  }
}
