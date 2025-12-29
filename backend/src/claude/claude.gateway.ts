import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeService, ClaudeOutput } from './claude.service';
import { IncomingMessage } from 'http';
import { ServerMessage, TerminalBufferData } from '../common/interfaces/websocket.interface';
import { TerminalBufferSnapshot } from './terminal-buffer.service';

// Extended WebSocket type with custom properties
interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
  clientId: string;
  sessionIds: Set<string>;
}

// WebSocket ready state constant
const WS_OPEN = 1;

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ClaudeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ClaudeGateway.name);
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private pingInterval: NodeJS.Timeout;

  constructor(
    private claudeService: ClaudeService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');

    // Setup ping interval to keep connections alive
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
        } catch {
          // Client disconnected
        }
      });
    }, 30000);
  }

  async handleConnection(
    client: AuthenticatedWebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    const clientId = this.generateClientId();
    client.clientId = clientId;
    client.sessionIds = new Set();
    client.isAlive = true;
    client.isAuthenticated = false;

    // Check API key from headers
    const apiKey =
      request.headers['x-api-key'] ||
      new URL(request.url || '', 'http://localhost').searchParams.get('apiKey');
    const validApiKey = this.configService.get<string>('API_KEY');

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

    // Setup message handler
    client.on('message', (data) => {
      this.handleMessage(client, data.toString());
    });

    // Handle pong responses
    client.on('pong', () => {
      client.isAlive = true;
    });

    // Check if Claude requires authentication and notify client
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

  async handleDisconnect(client: AuthenticatedWebSocket): Promise<void> {
    const clientId = client.clientId;
    this.logger.log(`Client disconnected: ${clientId}`);

    // Don't destroy sessions immediately - client may reconnect
    // Sessions will be cleaned up when a new session with same ID is created
    // or when the server restarts

    this.clients.delete(clientId);
  }

  private async handleMessage(
    client: AuthenticatedWebSocket,
    rawData: string,
  ): Promise<void> {
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
        case 'upload_file':
          await this.handleUploadFile(client, data);
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
    } catch (error) {
      this.logger.error(`Error parsing message: ${error.message}`);
    }
  }

  private async handleInitSession(
    client: AuthenticatedWebSocket,
    data: { sessionId: string; projectId: string },
  ): Promise<void> {
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
    } catch (error) {
      this.sendError(client, sessionId, 'INIT_FAILED', error.message);
    }
  }

  private async handleExecute(
    client: AuthenticatedWebSocket,
    data: { sessionId: string; prompt: string; projectPath: string },
  ): Promise<void> {
    const { sessionId, prompt, projectPath } = data;
    this.logger.log(
      `Execute in session ${sessionId}: ${prompt.substring(0, 50)}...`,
    );

    try {
      this.sendMessage(client, {
        type: 'status',
        sessionId,
        status: 'running',
      });

      const emitter = await this.claudeService.execute(
        sessionId,
        prompt,
        projectPath,
      );

      emitter.on('output', async (output: ClaudeOutput) => {
        if (output.type === 'output') {
          this.sendMessage(client, {
            type: 'output',
            sessionId,
            content: output.content || '',
            outputType: output.outputType || 'text',
            isFinal: output.isFinal || false,
          });
        } else if (output.type === 'auth_required') {
          // If no auth URL yet, trigger login to get one
          if (!output.authUrl) {
            this.logger.log('No auth URL in output, triggering login...');
            const { url: authUrl, emitter: loginEmitter } = await this.claudeService.triggerLogin();

            // Listen for PTY output and stream to iOS
            loginEmitter.on('pty_output', (output: string) => {
              if (output) {
                this.sendMessage(client, {
                  type: 'pty_output',
                  sessionId,
                  content: output,
                });
              }
            });

            // Listen for auth success/failure
            loginEmitter.on('auth_success', () => {
              this.logger.log('Auth success received during execute, notifying client');
              this.sendMessage(client, {
                type: 'auth_success',
                sessionId,
                message: 'Successfully authenticated with Claude!',
              });
            });

            loginEmitter.on('auth_failed', (reason: string) => {
              this.logger.log(`Auth failed during execute: ${reason}`);
              this.sendError(client, sessionId, 'AUTH_FAILED', reason);
            });

            // Tell iOS we're in interactive login mode - they can send pty_input
            this.sendMessage(client, {
              type: 'login_interactive',
              sessionId,
              message: 'Claude login started. Type /login to authenticate.',
            });

            // If we got a URL, also send it
            if (authUrl) {
              this.sendMessage(client, {
                type: 'auth_required',
                sessionId,
                authUrl: authUrl,
                message: 'Please authenticate with Claude to continue.',
              });
            }
          } else {
            this.sendMessage(client, {
              type: 'auth_required',
              sessionId,
              authUrl: output.authUrl,
              message: output.content || 'Authentication required',
            });
          }
        } else if (output.type === 'error') {
          this.sendError(
            client,
            sessionId,
            'EXECUTION_ERROR',
            output.content || 'Unknown error',
          );
        } else if (output.type === 'exit') {
          this.sendMessage(client, {
            type: 'status',
            sessionId,
            status: 'idle',
          });
        }
      });
    } catch (error) {
      this.sendError(client, sessionId, 'EXECUTE_FAILED', error.message);
      this.sendMessage(client, {
        type: 'status',
        sessionId,
        status: 'idle',
      });
    }
  }

  private async handleStop(
    client: AuthenticatedWebSocket,
    data: { sessionId: string },
  ): Promise<void> {
    const { sessionId } = data;
    this.logger.log(`Stop session: ${sessionId}`);

    try {
      await this.claudeService.stopSession(sessionId);

      this.sendMessage(client, {
        type: 'status',
        sessionId,
        status: 'stopped',
      });
    } catch (error) {
      this.sendError(client, sessionId, 'STOP_FAILED', error.message);
    }
  }

  private async handleLogin(client: AuthenticatedWebSocket): Promise<void> {
    this.logger.log('Handling login request');

    try {
      const { url: authUrl, emitter } = await this.claudeService.triggerLogin();

      if (authUrl) {
        // Listen for auth success/failure
        emitter.on('auth_success', () => {
          this.logger.log('Auth success received, notifying client');
          this.sendMessage(client, {
            type: 'auth_success',
            sessionId: '',
            message: 'Successfully authenticated with Claude!',
          });
        });

        emitter.on('auth_failed', (reason: string) => {
          this.logger.log(`Auth failed: ${reason}`);
          this.sendError(client, '', 'AUTH_FAILED', reason);
        });

        this.sendMessage(client, {
          type: 'auth_required',
          sessionId: '',
          authUrl,
          message: 'Please authenticate with Claude to continue.',
        });
      } else if (this.claudeService.isClaudeAuthenticated()) {
        // User was already authenticated (detected "Welcome back")
        this.logger.log('User already authenticated, notifying client');
        this.sendMessage(client, {
          type: 'auth_success',
          sessionId: '',
          message: 'Already authenticated with Claude!',
        });
      } else {
        this.sendError(
          client,
          '',
          'LOGIN_FAILED',
          'Could not get authentication URL. Please try again.',
        );
      }
    } catch (error) {
      this.sendError(client, '', 'LOGIN_FAILED', error.message);
    }
  }

  private async handleSubmitAuthCode(
    client: AuthenticatedWebSocket,
    data: { code: string },
  ): Promise<void> {
    const { code } = data;
    this.logger.log('Handling auth code submission');

    if (!code) {
      this.sendError(client, '', 'INVALID_CODE', 'No auth code provided');
      return;
    }

    try {
      // Get the login emitter to listen for auth events
      const loginEmitter = this.claudeService.getLoginEmitter();
      if (loginEmitter) {
        // Set up listeners (they may already exist, but adding more is fine)
        loginEmitter.on('auth_success', () => {
          this.logger.log('Auth success after code submission');
          this.sendMessage(client, {
            type: 'auth_success',
            sessionId: '',
            message: 'Successfully authenticated with Claude!',
          });
        });

        loginEmitter.on('auth_failed', (reason: string) => {
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
      } else {
        this.sendError(
          client,
          '',
          'CODE_SUBMIT_FAILED',
          'Failed to submit auth code. No active login process.',
        );
      }
    } catch (error) {
      this.sendError(client, '', 'CODE_SUBMIT_FAILED', error.message);
    }
  }

  private async handleStartInteractive(
    client: AuthenticatedWebSocket,
    data: { sessionId: string; projectPath: string },
  ): Promise<void> {
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

      // Stream terminal buffer snapshots to client (new server-side rendering approach)
      // This sends the complete terminal state instead of raw output chunks
      emitter.on('terminal_buffer', (snapshot: TerminalBufferSnapshot) => {
        this.sendMessage(client, {
          type: 'terminal_buffer',
          sessionId,
          buffer: snapshot as TerminalBufferData,
        });
      });

      // Legacy: Stream raw PTY output to client (for backwards compatibility)
      emitter.on('pty_output', (output: string) => {
        if (output) {
          this.sendMessage(client, {
            type: 'pty_output',
            sessionId,
            content: output,
          });
        }
      });

      // Handle auth required
      emitter.on('output', (output: ClaudeOutput) => {
        if (output.type === 'auth_required') {
          this.sendMessage(client, {
            type: 'auth_required',
            sessionId,
            authUrl: output.authUrl,
            message: output.content || 'Authentication required',
          });
        } else if (output.type === 'exit') {
          this.sendMessage(client, {
            type: 'status',
            sessionId,
            status: 'idle',
          });
        }
      });

      // Notify client that interactive session is ready
      this.sendMessage(client, {
        type: 'interactive_started',
        sessionId,
        message: 'Interactive Claude session started',
      });
    } catch (error) {
      this.sendError(client, sessionId, 'START_INTERACTIVE_FAILED', error.message);
    }
  }

  private handlePtyInput(
    client: AuthenticatedWebSocket,
    message: { sessionId?: string; data?: string; input?: string },
  ): void {
    const { sessionId } = message;
    // Support both 'data' (web client) and 'input' (legacy) field names
    const input = message.data || message.input;

    if (!input) {
      return;
    }

    // If sessionId provided, send to session PTY, otherwise to login PTY
    let success: boolean;
    if (sessionId) {
      success = this.claudeService.sendSessionPtyInput(sessionId, input);
    } else {
      success = this.claudeService.sendPtyInput(input);
    }

    if (!success) {
      this.sendError(
        client,
        sessionId || '',
        'PTY_INPUT_FAILED',
        'No active PTY session to send input to.',
      );
    }
  }

  private async handleUploadFile(
    client: AuthenticatedWebSocket,
    data: { sessionId: string; filename: string; mimeType: string; data: string },
  ): Promise<void> {
    const { sessionId, filename, mimeType, data: base64Data } = data;
    this.logger.log(`Upload file: ${filename} (${mimeType}) for session ${sessionId}`);

    try {
      // Import fs dynamically
      const fs = await import('fs');
      const path = await import('path');
      const crypto = await import('crypto');

      // Create temp directory if it doesn't exist
      const tempDir = '/tmp/pushtocode-uploads';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate unique filename
      const ext = path.extname(filename) || this.getExtFromMime(mimeType);
      const uniqueName = `${crypto.randomBytes(8).toString('hex')}${ext}`;
      const filePath = path.join(tempDir, uniqueName);

      // Decode base64 and write file
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      this.logger.log(`File saved to: ${filePath}`);

      // Send success response
      this.sendMessage(client, {
        type: 'file_uploaded',
        sessionId,
        filePath,
        filename,
      });
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      this.sendError(client, sessionId, 'UPLOAD_FAILED', error.message);
    }
  }

  private getExtFromMime(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
    };
    return mimeToExt[mimeType] || '';
  }

  private handlePing(client: AuthenticatedWebSocket): void {
    client.isAlive = true;
    this.sendMessage(client, { type: 'pong', timestamp: Date.now() });
  }

  private sendMessage(client: AuthenticatedWebSocket, message: any): void {
    try {
      if (client.readyState === WS_OPEN) {
        client.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
    }
  }

  private sendError(
    client: AuthenticatedWebSocket,
    sessionId: string,
    code: string,
    message: string,
  ): void {
    this.sendMessage(client, {
      type: 'error',
      sessionId,
      code,
      message,
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  onModuleDestroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }
}
