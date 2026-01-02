import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaudeService } from './claude.service';
import { ClaudeGateway } from './claude.gateway';
import { TerminalBufferService } from './terminal-buffer.service';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [ConfigModule, VoiceModule],
  providers: [ClaudeService, ClaudeGateway, TerminalBufferService],
  exports: [ClaudeService, TerminalBufferService],
})
export class ClaudeModule {}
