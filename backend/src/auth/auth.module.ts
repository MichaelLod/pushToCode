import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyGuard } from './guards/api-key.guard';
import { WsApiKeyGuard } from './guards/ws-api-key.guard';

@Module({
  imports: [ConfigModule],
  providers: [ApiKeyGuard, WsApiKeyGuard],
  exports: [ApiKeyGuard, WsApiKeyGuard],
})
export class AuthModule {}
