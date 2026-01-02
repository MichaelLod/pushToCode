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
import { IncomingMessage } from 'http';
import { VoiceSessionService, VoiceClaudeOutput } from './voice-session.service';
import { TtsService } from './tts.service';
import {
  VoiceClientMessage,
  VoiceServerMessage,
  VoiceOption,
} from './voice.interface';

// Extended WebSocket type with custom properties
interface AuthenticatedVoiceSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
  clientId: string;
  sessionId?: string;
}

// WebSocket ready state constant
const WS_OPEN = 1;

@WebSocketGateway({
  path: '/voice',
  cors: {
    origin: '*',
  },
})
export class VoiceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private clients: Map<string, AuthenticatedVoiceSocket> = new Map();
  private pingInterval: NodeJS.Timeout;

  constructor(
    private voiceSessionService: VoiceSessionService,
    private ttsService: TtsService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('Voice WebSocket Gateway initialized at /voice');

    // Setup ping interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          this.logger.warn(`Voice client ${id} not responding, terminating`);
          client.close();
          this.clients.delete(id);
          return;
        }
        client.isAlive = false;
        try {
          this.sendMessage(client, { type: 'ping' } as any);
        } catch {
          // Client disconnected
        }
      });
    }, 30000);

    // Cleanup inactive sessions periodically
    setInterval(() => {
      this.voiceSessionService.cleanupInactiveSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async handleConnection(
    client: AuthenticatedVoiceSocket,
    request: IncomingMessage,
  ): Promise<void> {
    const clientId = this.generateClientId();
    client.clientId = clientId;
    client.isAlive = true;
    client.isAuthenticated = false;

    // Check API key from headers or query params
    const apiKey =
      request.headers['x-api-key'] ||
      new URL(request.url || '', 'http://localhost').searchParams.get('apiKey');
    const validApiKey = this.configService.get<string>('API_KEY');

    if (!validApiKey || apiKey !== validApiKey) {
      this.logger.warn(`Unauthorized voice connection attempt from ${clientId}`);
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
    this.logger.log(`Voice client connected: ${clientId}`);

    // Setup message handler
    client.on('message', (data) => {
      this.handleMessage(client, data.toString());
    });

    // Handle pong responses
    client.on('pong', () => {
      client.isAlive = true;
    });
  }

  async handleDisconnect(client: AuthenticatedVoiceSocket): Promise<void> {
    const clientId = client.clientId;
    this.logger.log(`Voice client disconnected: ${clientId}`);

    // Clean up session if client had one
    if (client.sessionId) {
      this.voiceSessionService.destroySession(client.sessionId);
    }

    this.clients.delete(clientId);
  }

  private async handleMessage(
    client: AuthenticatedVoiceSocket,
    rawData: string,
  ): Promise<void> {
    try {
      const data: VoiceClientMessage = JSON.parse(rawData);
      const { type } = data;

      switch (type) {
        case 'voice_text':
          await this.handleVoiceText(client, data);
          break;
        case 'voice_select_option':
          await this.handleSelectOption(client, data);
          break;
        case 'ping':
          this.handlePing(client);
          break;
        case 'pong':
          client.isAlive = true;
          break;
        default:
          this.logger.warn(`Unknown voice message type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error parsing voice message: ${error.message}`);
    }
  }

  private async handleVoiceText(
    client: AuthenticatedVoiceSocket,
    data: { text: string; sessionId: string; repoPath?: string },
  ): Promise<void> {
    const { text, sessionId, repoPath } = data;
    this.logger.log(`Voice text from ${client.clientId}: "${text.substring(0, 50)}..."`);

    try {
      // Update status to processing
      this.sendMessage(client, {
        type: 'status',
        sessionId,
        status: 'processing',
      });

      // Get or create voice session with actual repo path
      const projectPath = repoPath || '/tmp';
      const emitter = await this.voiceSessionService.getOrCreateSession(
        sessionId,
        projectPath,
      );
      client.sessionId = sessionId;

      // Set up one-time listener for this response
      const responseHandler = async (output: VoiceClaudeOutput) => {
        if (output.type === 'response' && output.text) {
          // Send text response
          this.sendMessage(client, {
            type: 'voice_response',
            text: output.text,
            options: output.options,
            sessionId,
          });

          // Stream TTS audio
          await this.streamTtsToClient(client, output.text);

          // Update status to idle
          this.sendMessage(client, {
            type: 'status',
            sessionId,
            status: 'idle',
          });
        } else if (output.type === 'error') {
          this.sendError(client, sessionId, 'CLAUDE_ERROR', output.text || 'Unknown error');
        }

        // Remove listener after handling
        emitter.removeListener('output', responseHandler);
      };

      emitter.on('output', responseHandler);

      // Send text to Claude
      const sent = await this.voiceSessionService.sendText(sessionId, text);
      if (!sent) {
        emitter.removeListener('output', responseHandler);
        this.sendError(client, sessionId, 'SEND_FAILED', 'Failed to send text to Claude');
      }
    } catch (error) {
      this.logger.error(`Error handling voice text: ${error.message}`);
      this.sendError(client, sessionId, 'PROCESSING_ERROR', error.message);
    }
  }

  private async handleSelectOption(
    client: AuthenticatedVoiceSocket,
    data: { optionId: string; sessionId: string; repoPath?: string },
  ): Promise<void> {
    const { optionId, sessionId, repoPath } = data;
    this.logger.log(`Option selected: ${optionId} in session ${sessionId}`);

    try {
      this.sendMessage(client, {
        type: 'status',
        sessionId,
        status: 'processing',
      });

      const projectPath = repoPath || '/tmp';
      const emitter = await this.voiceSessionService.getOrCreateSession(sessionId, projectPath);

      const responseHandler = async (output: VoiceClaudeOutput) => {
        if (output.type === 'response' && output.text) {
          this.sendMessage(client, {
            type: 'voice_response',
            text: output.text,
            options: output.options,
            sessionId,
          });

          await this.streamTtsToClient(client, output.text);

          this.sendMessage(client, {
            type: 'status',
            sessionId,
            status: 'idle',
          });
        }
        emitter.removeListener('output', responseHandler);
      };

      emitter.on('output', responseHandler);

      const sent = await this.voiceSessionService.selectOption(sessionId, optionId);
      if (!sent) {
        emitter.removeListener('output', responseHandler);
        this.sendError(client, sessionId, 'SELECT_FAILED', 'Failed to select option');
      }
    } catch (error) {
      this.logger.error(`Error handling option selection: ${error.message}`);
      this.sendError(client, sessionId, 'PROCESSING_ERROR', error.message);
    }
  }

  /**
   * Stream TTS audio to client as base64 chunks
   */
  private async streamTtsToClient(
    client: AuthenticatedVoiceSocket,
    text: string,
  ): Promise<void> {
    if (!this.ttsService.isAvailable()) {
      this.logger.warn('TTS not available, skipping audio');
      return;
    }

    // Update status to speaking
    this.sendMessage(client, {
      type: 'status',
      sessionId: client.sessionId || '',
      status: 'speaking',
    });

    return new Promise((resolve) => {
      this.ttsService.streamTts(text, {
        onChunk: (chunk: Buffer) => {
          // Send audio chunk as base64
          this.sendMessage(client, {
            type: 'voice_audio',
            audio: chunk.toString('base64'),
            isFinal: false,
          });
        },
        onEnd: () => {
          // Send final marker
          this.sendMessage(client, {
            type: 'voice_audio',
            audio: '',
            isFinal: true,
          });
          resolve();
        },
        onError: (error: Error) => {
          this.logger.error(`TTS streaming error: ${error.message}`);
          // Still resolve to continue the flow
          resolve();
        },
      });
    });
  }

  private handlePing(client: AuthenticatedVoiceSocket): void {
    client.isAlive = true;
    this.sendMessage(client, { type: 'pong', timestamp: Date.now() });
  }

  private sendMessage(client: AuthenticatedVoiceSocket, message: VoiceServerMessage | { type: 'ping' }): void {
    try {
      if (client.readyState === WS_OPEN) {
        client.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.error(`Error sending voice message: ${error.message}`);
    }
  }

  private sendError(
    client: AuthenticatedVoiceSocket,
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

    // Also set status back to idle on error
    this.sendMessage(client, {
      type: 'status',
      sessionId,
      status: 'idle',
    });
  }

  private generateClientId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  onModuleDestroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }
}
