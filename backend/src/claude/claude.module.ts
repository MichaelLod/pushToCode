import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaudeService } from './claude.service';
import { ClaudeGateway } from './claude.gateway';
import { ClaudeController } from './claude.controller';
import { TerminalBufferService } from './terminal-buffer.service';

@Module({
  imports: [ConfigModule],
  controllers: [ClaudeController],
  providers: [ClaudeService, ClaudeGateway, TerminalBufferService],
  exports: [ClaudeService, TerminalBufferService],
})
export class ClaudeModule {}
