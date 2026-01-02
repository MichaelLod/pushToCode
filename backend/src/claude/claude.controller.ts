import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ClaudeService, PersistedSessionMetadata } from './claude.service';

@Controller('claude')
@UseGuards(ApiKeyGuard)
export class ClaudeController {
  private readonly logger = new Logger(ClaudeController.name);

  constructor(private claudeService: ClaudeService) {}

  @Get('sessions')
  async getSessions(): Promise<PersistedSessionMetadata[]> {
    this.logger.log('GET /claude/sessions called');
    return this.claudeService.getPersistedSessions();
  }
}
