import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeService, ClaudeOutput } from './claude.service';
import {
  ClientMessage,
  ServerMessage,
  SessionStatus,
} from '../common/interfaces/websocket.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
})
export class ClaudeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ClaudeGateway.name);
  private clientSessions: Map<string, Set<string>> = new Map(); // socketId -> sessionIds

  constructor(
    private claudeService: ClaudeService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const apiKey =
      client.handshake.auth?.apiKey || client.handshake.headers['x-api-key'];
    const validApiKey = this.configService.get<string>('API_KEY');

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

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up sessions for this client
    const sessions = this.clientSessions.get(client.id);
    if (sessions) {
      for (const sessionId of sessions) {
        this.claudeService.destroySession(sessionId);
      }
      this.clientSessions.delete(client.id);
    }
  }

  @SubscribeMessage('init_session')
  async handleInitSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; projectId: string },
  ): Promise<void> {
    const { sessionId, projectId } = data;
    this.logger.log(`Init session: ${sessionId} for project: ${projectId}`);

    try {
      // Get project path from projectId (in real app, would look up in repos service)
      const projectPath = projectId; // For now, projectId is the full path

      await this.claudeService.initSession(sessionId, projectPath);

      // Track session for this client
      const sessions = this.clientSessions.get(client.id);
      if (sessions) {
        sessions.add(sessionId);
      }

      // Join the session room
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
    } catch (error) {
      this.sendError(client, sessionId, 'INIT_FAILED', error.message);
    }
  }

  @SubscribeMessage('execute')
  async handleExecute(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionId: string; prompt: string; projectPath: string },
  ): Promise<void> {
    const { sessionId, prompt, projectPath } = data;
    this.logger.log(
      `Execute in session ${sessionId}: ${prompt.substring(0, 50)}...`,
    );

    try {
      // Update status to running
      this.sendToSession(client, sessionId, {
        type: 'status',
        sessionId,
        status: 'running',
      });

      const emitter = await this.claudeService.execute(
        sessionId,
        prompt,
        projectPath,
      );

      emitter.on('output', (output: ClaudeOutput) => {
        if (output.type === 'output') {
          this.sendToSession(client, sessionId, {
            type: 'output',
            sessionId,
            content: output.content || '',
            outputType: output.outputType || 'text',
            isFinal: output.isFinal || false,
          });
        } else if (output.type === 'error') {
          this.sendError(
            client,
            sessionId,
            'EXECUTION_ERROR',
            output.content || 'Unknown error',
          );
        } else if (output.type === 'exit') {
          this.sendToSession(client, sessionId, {
            type: 'status',
            sessionId,
            status: 'idle',
          });
        }
      });
    } catch (error) {
      this.sendError(client, sessionId, 'EXECUTE_FAILED', error.message);
      this.sendToSession(client, sessionId, {
        type: 'status',
        sessionId,
        status: 'idle',
      });
    }
  }

  @SubscribeMessage('stop')
  async handleStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): Promise<void> {
    const { sessionId } = data;
    this.logger.log(`Stop session: ${sessionId}`);

    try {
      await this.claudeService.stopSession(sessionId);

      this.sendToSession(client, sessionId, {
        type: 'status',
        sessionId,
        status: 'stopped',
      });
    } catch (error) {
      this.sendError(client, sessionId, 'STOP_FAILED', error.message);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  private sendToSession(
    client: Socket,
    sessionId: string,
    message: ServerMessage,
  ): void {
    client.emit('message', message);
  }

  private sendError(
    client: Socket,
    sessionId: string,
    code: string,
    message: string,
  ): void {
    client.emit('message', {
      type: 'error',
      sessionId,
      code,
      message,
    });
  }
}
