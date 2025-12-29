import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StressorService } from './stressor.service';
import { StressorConfigDto, AddProjectDto, StressorStatusDto } from './dto/stressor.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Controller('stressor')
@UseGuards(ApiKeyGuard)
export class StressorController {
  constructor(private readonly stressorService: StressorService) {}

  @Get('status')
  getStatus(): StressorStatusDto {
    return this.stressorService.getStatus();
  }

  @Get('config')
  getConfig(): StressorConfigDto {
    return this.stressorService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() config: Partial<StressorConfigDto>): StressorConfigDto {
    return this.stressorService.updateConfig(config);
  }

  @Post('start')
  async start(): Promise<{ success: boolean; message: string }> {
    return this.stressorService.start();
  }

  @Post('stop')
  async stop(): Promise<{ success: boolean; message: string }> {
    return this.stressorService.stop();
  }

  @Post('projects')
  addProject(@Body() dto: AddProjectDto): StressorConfigDto {
    return this.stressorService.addProject(dto.path);
  }

  @Delete('projects/:path')
  removeProject(@Param('path') projectPath: string): StressorConfigDto {
    // Decode the path (it will be URL encoded)
    const decodedPath = decodeURIComponent(projectPath);
    return this.stressorService.removeProject(decodedPath);
  }

  @Get('logs')
  getLogs(@Query('lines') lines?: string): { logs: string } {
    const numLines = lines ? parseInt(lines, 10) : 100;
    return { logs: this.stressorService.getLogs(numLines) };
  }
}
