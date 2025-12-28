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
import { ServerMessage } from '../common/interfaces/websocket.interface';

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

            // Listen for auth success/failure
            loginEmitter.on('auth_success', () => {
              this.logger.log('Auth success received during execute, notifying client');
              this.sendMessage(client, {
                type: 'auth_success',
                sessionId,
                message: 'Successfully authenticated with Claude!',
              });
            });

            this.sendMessage(client, {
              type: 'auth_required',
              sessionId,
              authUrl: authUrl || '',
              message: 'Please authenticate with Claude to continue.',
            });
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
