import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as path from 'path';
import { VoiceOption } from './voice.interface';

export interface VoiceClaudeOutput {
  type: 'response' | 'error' | 'exit';
  text?: string;
  options?: VoiceOption[];
  code?: number;
}

interface VoiceSession {
  ptyProcess: pty.IPty;
  emitter: EventEmitter;
  projectPath: string;
  buffer: string;
  isProcessing: boolean;
  createdAt: Date;
  lastActivityAt: Date;
}

@Injectable()
export class VoiceSessionService {
  private readonly logger = new Logger(VoiceSessionService.name);
  private sessions: Map<string, VoiceSession> = new Map();
  private readonly agentPromptPath: string;

  constructor(private configService: ConfigService) {
    // Path to the voice agent prompt file
    this.agentPromptPath = path.join(process.cwd(), '.claude', 'agents', 'voice.md');
  }

  /**
   * Start or get an existing voice session
   */
  async getOrCreateSession(sessionId: string, projectPath: string): Promise<EventEmitter> {
    let session = this.sessions.get(sessionId);

    if (session) {
      session.lastActivityAt = new Date();
      return session.emitter;
    }

    return this.createSession(sessionId, projectPath);
  }

  /**
   * Create a new voice session with Claude CLI
   */
  private async createSession(sessionId: string, projectPath: string): Promise<EventEmitter> {
    this.logger.log(`Creating voice session ${sessionId} for project: ${projectPath}`);

    const emitter = new EventEmitter();

    // Determine working directory
    const fs = await import('fs');
    let workingDir = '/tmp';
    try {
      if (fs.existsSync(projectPath)) {
        workingDir = projectPath;
      } else {
        this.logger.log(`Project path ${projectPath} doesn't exist, using /tmp`);
      }
    } catch (err) {
      this.logger.warn(`Error checking path ${projectPath}: ${err.message}`);
    }

    // Build CLI args with voice agent prompt
    const cliArgs = [
      '--dangerously-skip-permissions',
      '--agent-prompt', this.agentPromptPath,
    ];

    this.logger.log(`Spawning Claude CLI with args: ${cliArgs.join(' ')}`);

    // Spawn Claude CLI with PTY
    const ptyProcess = pty.spawn('claude', cliArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: workingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '0', // Disable colors for cleaner parsing
      },
    });

    const session: VoiceSession = {
      ptyProcess,
      emitter,
      projectPath,
      buffer: '',
      isProcessing: false,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.logger.log(`Voice PTY spawned with PID: ${ptyProcess.pid}`);

    // Handle PTY output
    ptyProcess.onData((data: string) => {
      session.lastActivityAt = new Date();
      this.handlePtyOutput(sessionId, session, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      this.logger.log(`Voice PTY ${sessionId} exited with code ${exitCode}`);
      emitter.emit('output', {
        type: 'exit',
        code: exitCode,
      } as VoiceClaudeOutput);
      this.sessions.delete(sessionId);
    });

    return emitter;
  }

  /**
   * Handle PTY output and parse Claude responses
   */
  private handlePtyOutput(sessionId: string, session: VoiceSession, data: string): void {
    // Strip ANSI escape codes
    const cleanData = this.stripAnsi(data);
    session.buffer += cleanData;

    // Check if we have a complete response
    // Claude typically ends responses with a prompt indicator or newlines
    const response = this.parseResponse(session.buffer);

    if (response) {
      session.buffer = '';
      session.isProcessing = false;
      session.emitter.emit('output', response);
    }
  }

  /**
   * Parse Claude's response and extract text + options
   */
  private parseResponse(buffer: string): VoiceClaudeOutput | null {
    // Look for response patterns
    // The voice agent should output clean text, possibly with [OPTIONS: {...}]

    // Skip UI/status lines
    const uiPatterns = [
      /^Claude Code v[\d.]+/,
      /^Model:/,
      /^Context:/,
      /^>\s*$/,
      /esc to interrupt/i,
      /Thinking/,
      /^\s*$/,
    ];

    const lines = buffer.split('\n');
    const contentLines: string[] = [];
    let options: VoiceOption[] | undefined;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip UI lines
      let isUi = false;
      for (const pattern of uiPatterns) {
        if (pattern.test(trimmed)) {
          isUi = true;
          break;
        }
      }
      if (isUi) continue;

      // Check for OPTIONS marker
      const optionsMatch = trimmed.match(/\[OPTIONS:\s*(\{.*\})\]/);
      if (optionsMatch) {
        try {
          const optionsObj = JSON.parse(optionsMatch[1]);
          options = Object.entries(optionsObj).map(([id, label]) => ({
            id,
            label: String(label),
            action: `select_option_${id}`,
          }));
        } catch (e) {
          this.logger.warn(`Failed to parse OPTIONS: ${e.message}`);
        }
        // Remove OPTIONS marker from line
        const cleanLine = trimmed.replace(/\[OPTIONS:\s*\{.*\}\]/, '').trim();
        if (cleanLine) {
          contentLines.push(cleanLine);
        }
        continue;
      }

      contentLines.push(trimmed);
    }

    // Only return if we have meaningful content
    // Look for end-of-response indicators
    const hasContent = contentLines.length > 0;
    const text = contentLines.join(' ').trim();

    // Check if response seems complete (ends with punctuation, has options, or buffer is long enough)
    const seemsComplete =
      text.match(/[.!?]$/) ||
      options !== undefined ||
      text.length > 100;

    if (hasContent && seemsComplete) {
      return {
        type: 'response',
        text,
        options,
      };
    }

    return null;
  }

  /**
   * Send text input to a voice session
   */
  async sendText(sessionId: string, text: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found`);
      return false;
    }

    try {
      session.isProcessing = true;
      session.lastActivityAt = new Date();
      session.buffer = ''; // Clear buffer for new response

      // Send text to Claude CLI
      session.ptyProcess.write(text + '\r');
      this.logger.log(`Sent to voice session ${sessionId}: "${text.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send text to session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Select an option in a voice session
   */
  async selectOption(sessionId: string, optionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.error(`Session ${sessionId} not found`);
      return false;
    }

    try {
      session.isProcessing = true;
      session.lastActivityAt = new Date();
      session.buffer = '';

      // Send the option selection as text
      session.ptyProcess.write(`Option ${optionId}\r`);
      this.logger.log(`Selected option ${optionId} in session ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to select option in session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Check if a session is processing
   */
  isProcessing(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.isProcessing ?? false;
  }

  /**
   * Destroy a voice session
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.logger.log(`Destroying voice session ${sessionId}`);
      session.ptyProcess.kill();
      session.emitter.removeAllListeners();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Strip ANSI escape codes from text
   */
  private stripAnsi(text: string): string {
    return text
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '')
      .replace(/\x1b[\(\)][AB012]/g, '')
      .replace(/\x1b[=>]/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivityAt.getTime() > maxAgeMs) {
        this.logger.log(`Cleaning up inactive voice session ${sessionId}`);
        this.destroySession(sessionId);
      }
    }
  }
}
