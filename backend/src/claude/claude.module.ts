import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaudeService } from './claude.service';
import { ClaudeGateway } from './claude.gateway';
import { ClaudeController } from './claude.controller';
import { TerminalBufferService } from './terminal-buffer.service';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [ConfigModule, VoiceModule],
  controllers: [ClaudeController],
  providers: [ClaudeService, ClaudeGateway, TerminalBufferService],
  exports: [ClaudeService, TerminalBufferService],
})
export class ClaudeModule {}
