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
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ReposService } from './repos.service';
import {
  CloneRepoDto,
  RepoResponseDto,
  RepoListResponseDto,
} from './dto/repo.dto';

@Controller('repos')
@UseGuards(ApiKeyGuard)
export class ReposController {
  constructor(private reposService: ReposService) {}

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
