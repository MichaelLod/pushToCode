import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const apiKey =
      client.handshake.auth?.apiKey || client.handshake.headers['x-api-key'];

    const validApiKey = this.configService.get<string>('API_KEY');

    if (!validApiKey) {
      throw new WsException('API key not configured on server');
    }

    if (!apiKey) {
      throw new WsException('API key is required');
    }

    if (apiKey !== validApiKey) {
      throw new WsException('Invalid API key');
    }

    return true;
  }
}
