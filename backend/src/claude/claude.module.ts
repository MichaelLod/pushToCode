import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaudeService } from './claude.service';
import { ClaudeGateway } from './claude.gateway';

@Module({
  imports: [ConfigModule],
  providers: [ClaudeService, ClaudeGateway],
  exports: [ClaudeService],
})
export class ClaudeModule {}
