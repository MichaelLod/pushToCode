import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ReposService } from './repos.service';
import {
  CloneRepoDto,
  RepoResponseDto,
  RepoListResponseDto,
  AvailableReposResponseDto,
} from './dto/repo.dto';

@Controller('repos')
@UseGuards(ApiKeyGuard)
export class ReposController {
  private readonly logger = new Logger(ReposController.name);

  constructor(private reposService: ReposService) {}

  // IMPORTANT: Put specific routes BEFORE parameterized routes
  @Get('available')
  async getAvailable(): Promise<AvailableReposResponseDto> {
    this.logger.log('GET /repos/available called');
    try {
      const repos = await this.reposService.getAvailableRepos();
      return { repos, total: repos.length };
    } catch (error) {
      this.logger.error(`Failed to get available repos: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  @Post()
  async clone(@Body() dto: CloneRepoDto): Promise<RepoResponseDto> {
    return this.reposService.clone(dto);
  }

  @Get()
  async list(): Promise<RepoListResponseDto> {
    const repos = await this.reposService.list();
    return {
      repos,
      total: repos.length,
    };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<RepoResponseDto> {
    return this.reposService.get(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.reposService.delete(id);
  }

  @Post(':id/pull')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pull(@Param('id') id: string): Promise<void> {
    await this.reposService.pull(id);
  }
}
