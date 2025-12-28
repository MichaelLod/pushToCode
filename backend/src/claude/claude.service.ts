import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { OutputType } from '../common/interfaces/websocket.interface';
import * as pty from 'node-pty';

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
  claudeSessionId?: string;  // Claude's internal session ID for --resume
  ptyProcess?: pty.IPty;     // Interactive PTY process
}

@Injectable()
export class ClaudeService implements OnModuleInit {
  private readonly logger = new Logger(ClaudeService.name);
  private sessions: Map<string, SessionData> = new Map();
  private pendingAuthUrl: string | null = null;
  private isAuthenticated = false;
  private loginPtyProcess: pty.IPty | null = null;
  private loginEmitter: EventEmitter | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // First verify CLI is installed and working
    await this.verifyCliInstalled();
    // Then check Claude auth status on startup
    await this.checkAuthStatus();
  }

  private async verifyCliInstalled(): Promise<void> {
    this.logger.log('Verifying Claude CLI installation...');
    try {
      const version = execSync('claude --version', { timeout: 10000 }).toString().trim();
      this.logger.log(`Claude CLI version: ${version}`);
    } catch (error) {
      this.logger.error(`Claude CLI not working: ${error.message}`);
    }
  }

  private async checkAuthStatus(): Promise<void> {
    this.logger.log('Checking Claude authentication status...');

    try {
      // Run a simple claude command to check if auth is needed
      const claudeProcess = spawn('claude', [
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

      // Close stdin immediately
      claudeProcess.stdin?.end();

      let stderrOutput = '';
      let stdoutOutput = '';

      claudeProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdoutOutput += chunk;
        this.logger.log(`Auth check stdout: ${chunk.substring(0, 500)}`);
      });

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderrOutput += chunk;
        this.logger.log(`Auth check stderr: ${chunk.substring(0, 500)}`);
      });

      claudeProcess.on('close', (code) => {
        // Check if auth URL was output
        const authUrl = this.extractAuthUrl(stderrOutput);
        if (authUrl) {
          this.pendingAuthUrl = authUrl;
          this.isAuthenticated = false;
          this.logger.warn(`Claude requires authentication. Auth URL: ${authUrl}`);
        } else if (code === 0) {
          this.isAuthenticated = true;
          this.pendingAuthUrl = null;
          this.logger.log('Claude is authenticated and ready');
        } else {
          this.logger.warn(`Claude auth check exited with code ${code}`);
        }
      });

      claudeProcess.on('error', (error) => {
        this.logger.error(`Failed to check Claude auth: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(`Error checking Claude auth status: ${error.message}`);
    }
  }

  getPendingAuthUrl(): string | null {
    return this.pendingAuthUrl;
  }

  isClaudeAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  clearPendingAuth(): void {
    this.pendingAuthUrl = null;
    this.isAuthenticated = true;
  }

  async triggerLogin(): Promise<{ url: string | null; emitter: EventEmitter }> {
    this.logger.log('Triggering Claude login flow via PTY...');

    // Kill any existing login process
    if (this.loginPtyProcess) {
      this.logger.log('Killing existing login PTY process');
      this.loginPtyProcess.kill();
      this.loginPtyProcess = null;
    }

    const emitter = new EventEmitter();
    this.loginEmitter = emitter;

    return new Promise((resolve) => {
      let output = '';
      let foundUrl: string | null = null;

      // Use pseudo-terminal for interactive login with proper terminal emulation
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

      ptyProcess.onData((data: string) => {
        output += data;
        // Strip ANSI escape codes and control sequences for clean display
        const cleanData = this.stripAnsiAndControl(data);
        if (cleanData) {
          this.logger.log(`PTY output: ${cleanData.substring(0, 200)}`);
          // Emit PTY output to iOS app so user can see everything
          emitter.emit('pty_output', cleanData);
        }

        // Handle onboarding prompts by pressing Enter to accept defaults
        const isOnboardingPrompt = (
          cleanData.includes('Dark mode') ||
          cleanData.includes('Light mode') ||
          cleanData.includes('Choose the text style') ||
          cleanData.includes('Let\'s get started') ||
          cleanData.includes('Ready to code here') ||
          cleanData.includes('Yes, continue') ||
          /[❯>]\s*\d+\.\s*(Yes|Dark|Light)/i.test(cleanData)
        );
        const isAuthCodePrompt = (
          cleanData.includes('Paste your') ||
          cleanData.includes('Enter the code') ||
          cleanData.includes('authorization code') ||
          cleanData.includes('console.anthropic.com')
        );

        // Auto-press Enter only for onboarding menus, not for interactive prompts
        const now = Date.now();
        if (isOnboardingPrompt && !isAuthCodePrompt && !readyForCode && (now - lastEnterPress > 1000)) {
          this.logger.log(`Detected onboarding prompt, pressing Enter. Text: ${cleanData.substring(0, 100)}`);
          lastEnterPress = now;
          setTimeout(() => {
            if (this.loginPtyProcess === ptyProcess) {
              ptyProcess.write('\r');
            }
          }, 500);
        }

        // Check if CLI is ready to receive the auth code
        if (cleanData.includes('Paste your') ||
            cleanData.includes('Enter the code') ||
            cleanData.includes('paste the code') ||
            cleanData.includes('authorization code')) {
          this.logger.log('PTY is ready for auth code input');
          readyForCode = true;
        }

        const url = this.extractAuthUrl(data);
        if (url && !foundUrl) {
          foundUrl = url;
          this.pendingAuthUrl = url;
          this.logger.log(`Found auth URL: ${url}`);
          // After finding URL, assume we'll be ready for code soon
          readyForCode = true;
          resolve({ url, emitter });
        }

        // Check for success message after code is entered
        if (!authSuccessEmitted && (
            cleanData.includes('Successfully authenticated') ||
            cleanData.includes('Authentication successful') ||
            cleanData.includes('Logged in as'))) {
          this.logger.log('Authentication successful!');
          this.isAuthenticated = true;
          this.pendingAuthUrl = null;
          authSuccessEmitted = true;
          emitter.emit('auth_success');
        }

        // Check for error messages
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

        // Don't emit auth_success if we killed it due to timeout
        if (killedByTimeout) {
          this.logger.log('Process was killed by timeout, not emitting auth_success');
          if (!foundUrl) {
            resolve({ url: null, emitter });
          }
          return;
        }

        if (exitCode === 0 && !authSuccessEmitted && foundUrl) {
          // Only emit success if we found a URL and completed auth
          this.logger.log('Authentication successful based on exit code 0');
          this.isAuthenticated = true;
          this.pendingAuthUrl = null;
          authSuccessEmitted = true;
          emitter.emit('auth_success');
        } else if (exitCode !== 0) {
          emitter.emit('auth_failed', `Process exited with code ${exitCode}`);
        }
        if (!foundUrl) {
          this.logger.warn(`No auth URL found. Full output: ${output.substring(0, 500)}`);
          resolve({ url: null, emitter });
        }
      });

      // Timeout after 60 seconds for URL (longer to handle onboarding prompts)
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

  async submitAuthCode(code: string): Promise<boolean> {
    this.logger.log(`Submitting auth code: ${code.substring(0, 20)}...`);

    if (!this.loginPtyProcess) {
      this.logger.error('No active login PTY process to submit code to');
      return false;
    }

    try {
      // Clean the code - remove any whitespace or newlines that might have been copied
      const cleanCode = code.trim();
      this.logger.log(`Clean code length: ${cleanCode.length}`);

      // Write the code to the PTY followed by newline
      // Use \n for Unix-style newline
      this.loginPtyProcess.write(cleanCode + '\n');
      this.logger.log('Auth code submitted to PTY');
      return true;
    } catch (error) {
      this.logger.error(`Failed to submit auth code: ${error.message}`);
      return false;
    }
  }

  getLoginEmitter(): EventEmitter | null {
    return this.loginEmitter;
  }

  // Send any input to the login PTY (for user interaction)
  sendPtyInput(input: string): boolean {
    if (!this.loginPtyProcess) {
      this.logger.error('No active login PTY process');
      return false;
    }

    try {
      this.logger.log(`Sending PTY input: ${input.substring(0, 50)}`);
      this.loginPtyProcess.write(input);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send PTY input: ${error.message}`);
      return false;
    }
  }

  // Send input to a session's interactive PTY
  sendSessionPtyInput(sessionId: string, input: string): boolean {
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
      // Log the raw input for debugging
      const debugInput = input.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      this.logger.log(`Sending PTY input to session ${sessionId}: "${debugInput}"`);
      session.ptyProcess.write(input);
      this.logger.log(`PTY input sent successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send PTY input: ${error.message}`);
      return false;
    }
  }

  // Start Claude CLI in interactive mode for a session
  async startInteractiveSession(sessionId: string, projectPath: string): Promise<EventEmitter> {
    this.logger.log(`Starting interactive session ${sessionId} for project: ${projectPath}`);

    // Initialize or get existing session
    let session = this.sessions.get(sessionId);
    if (!session) {
      const emitter = new EventEmitter();
      session = {
        process: null as any,
        emitter,
        projectPath,
      };
      this.sessions.set(sessionId, session);
    }

    // Kill existing PTY if running
    if (session.ptyProcess) {
      this.logger.log(`Killing existing PTY for session ${sessionId}`);
      session.ptyProcess.kill();
      session.ptyProcess = undefined;
    }

    const emitter = session.emitter;

    // Check if we have a pending auth URL - if so, we need to login first
    if (this.pendingAuthUrl) {
      this.logger.log('Auth required, emitting auth_required event');
      emitter.emit('output', {
        type: 'auth_required',
        content: 'Claude requires authentication',
        authUrl: this.pendingAuthUrl,
      });
      return emitter;
    }

    // Spawn Claude CLI in interactive mode using PTY
    const ptyProcess = pty.spawn('claude', ['--dangerously-skip-permissions'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        IS_SANDBOX: '1',  // Auto-accept bypass permissions confirmation
      },
    });

    session.ptyProcess = ptyProcess;
    this.logger.log(`Interactive PTY spawned with PID: ${ptyProcess.pid}`);

    let lastEnterPress = 0;

    ptyProcess.onData((data: string) => {
      // Strip ANSI escape codes and terminal control sequences for clean display
      const cleanData = this.stripAnsiAndControl(data);
      if (cleanData) {
        this.logger.log(`Session ${sessionId} PTY: ${cleanData.substring(0, 200)}`);
        // Emit PTY output to client
        emitter.emit('pty_output', cleanData);
      }

      // Auto-handle onboarding prompts only (dark mode, text style setup)
      // These are non-security prompts that just need Enter to accept defaults
      const isOnboardingPrompt = (
        cleanData.includes('Dark mode') ||
        cleanData.includes('Light mode') ||
        cleanData.includes('Choose the text style') ||
        cleanData.includes('Let\'s get started') ||
        cleanData.includes('Ready to code here') ||
        /[❯>]\s*\d+\.\s*(Dark|Light)/i.test(cleanData)
      );

      const now = Date.now();
      if (isOnboardingPrompt && (now - lastEnterPress > 1000)) {
        this.logger.log(`Auto-accepting onboarding prompt: ${cleanData.substring(0, 100)}`);
        lastEnterPress = now;
        setTimeout(() => {
          if (session.ptyProcess === ptyProcess) {
            ptyProcess.write('\r');
          }
        }, 500);
      }

      // Check for auth URL in output
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
    });

    ptyProcess.onExit(({ exitCode }) => {
      this.logger.log(`Session ${sessionId} PTY exited with code ${exitCode}`);
      session.ptyProcess = undefined;
      emitter.emit('output', {
        type: 'exit',
        code: exitCode,
        isFinal: true,
      });
    });

    return emitter;
  }

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

    // Check if we have a pending auth URL - if so, emit it immediately
    if (this.pendingAuthUrl) {
      emitter.emit('output', {
        type: 'auth_required',
        content: 'Claude requires authentication',
        authUrl: this.pendingAuthUrl,
      });
      return emitter;
    }

    // Log environment for debugging
    const hasOAuthToken = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const hasAuthToken = !!process.env.ANTHROPIC_AUTH_TOKEN;
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    this.logger.log(`Spawning Claude CLI (CLAUDE_CODE_OAUTH_TOKEN: ${hasOAuthToken}, ANTHROPIC_AUTH_TOKEN: ${hasAuthToken}, ANTHROPIC_API_KEY: ${hasApiKey})`);
    this.logger.log(`Working directory: ${projectPath}`);

    // Spawn Claude CLI process with headless flags
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',  // Required for Docker/headless
      '--debug', 'api,auth',  // Debug API and auth issues
      '--verbose',
    ];

    // Resume previous conversation if we have a Claude session ID
    if (session.claudeSessionId) {
      args.push('--resume', session.claudeSessionId);
      this.logger.log(`Resuming Claude session: ${session.claudeSessionId}`);
    }

    this.logger.log(`Claude args: ${args.join(' ')}`);

    const claudeProcess = spawn('claude', args, {
      cwd: projectPath,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        CI: '1',  // Hint that we're in non-interactive mode
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.logger.log(`Claude process spawned with PID: ${claudeProcess.pid}`);

    // Close stdin immediately - CLI shouldn't need input with -p flag
    claudeProcess.stdin?.end();

    session.process = claudeProcess;

    // Add timeout - if no output after 30 seconds, something is wrong
    const startupTimeout = setTimeout(() => {
      this.logger.warn(`Claude process ${claudeProcess.pid} produced no output after 30s - may be hanging`);
    }, 30000);

    let buffer = '';
    let hasReceivedOutput = false;
    const currentOutputType: OutputType = 'text';

    claudeProcess.stdout?.on('data', (data: Buffer) => {
      if (!hasReceivedOutput) {
        hasReceivedOutput = true;
        clearTimeout(startupTimeout);
      }
      const chunk = data.toString();
      this.logger.log(`Claude stdout (${chunk.length} bytes): ${chunk.substring(0, 200)}...`);
      buffer += chunk;

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          // Capture Claude session ID for conversation continuity
          if (parsed.session_id && !session.claudeSessionId) {
            session.claudeSessionId = parsed.session_id;
            this.logger.log(`Captured Claude session ID: ${parsed.session_id}`);
          }

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
      if (!hasReceivedOutput) {
        hasReceivedOutput = true;
        clearTimeout(startupTimeout);
      }
      const content = data.toString();
      this.logger.warn(`Claude stderr (${content.length} bytes): ${content.substring(0, 500)}`);

      // Check for auth URL in stderr
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

      // If successful, mark as authenticated
      if (code === 0) {
        this.isAuthenticated = true;
        this.pendingAuthUrl = null;
      }

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
      const result = parsed.result || '';

      // Check if auth is required
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

  // Strip ALL ANSI escape sequences - iOS can't render them
  private stripAnsiAndControl(data: string): string {
    return data
      // Strip ALL ANSI escape sequences (colors, cursor, etc.)
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')    // CSI sequences (colors, cursor, etc.)
      .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')  // Private CSI sequences
      .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences (window title, etc.)
      .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '') // DCS, SOS, PM, APC sequences
      .replace(/\x1b[\(\)][AB012]/g, '')        // Character set selection
      .replace(/\x1b[=>]/g, '')                 // Keypad mode
      // Remove other control characters except newline/tab/carriage return
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  private extractAuthUrl(content: string): string | null {
    // First strip ANSI escape codes from the content
    const cleanContent = this.stripAnsiAndControl(content);

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
      const match = cleanContent.match(pattern);
      if (match) {
        // Clean up the URL (remove trailing punctuation and any remaining escape chars)
        let url = match[0]
          .replace(/[.,;:!?)"'\]]+$/, '')
          .replace(/[\x00-\x1f\x7f-\x9f]/g, ''); // Remove any control characters
        // If pattern has capture group, use that
        if (match[1]) {
          url = match[1]
            .replace(/[.,;:!?)"'\]]+$/, '')
            .replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        }
        // Only return if it's a valid URL
        if (url.startsWith('https://')) {
          // Decode URL to prevent double-encoding when iOS opens it
          // iOS may encode the URL again, so we send it decoded
          try {
            return decodeURIComponent(url);
          } catch {
            return url;
          }
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

    // Kill PTY process if running
    if (session.ptyProcess) {
      this.logger.log(`Stopping PTY for session ${sessionId}`);
      session.ptyProcess.kill();
      session.ptyProcess = undefined;
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
