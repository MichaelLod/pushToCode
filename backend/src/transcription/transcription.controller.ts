import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TranscriptionService } from './transcription.service';
import { TranscribeDto, TranscribeResponseDto } from './dto/transcribe.dto';

@Controller('transcribe')
@UseGuards(ApiKeyGuard)
export class TranscriptionController {
  private readonly logger = new Logger(TranscriptionController.name);

  constructor(private transcriptionService: TranscriptionService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max
      },
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'audio/m4a',
          'audio/mp4',
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/webm',
          'audio/x-m4a',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid audio format: ${file.mimetype}. Supported: m4a, mp3, mp4, wav, webm`,
            ),
            false,
          );
        }
      },
    }),
  )
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: TranscribeDto,
  ): Promise<TranscribeResponseDto> {
    this.logger.log(
      `Transcription request received: file=${file?.originalname}, size=${file?.size} bytes`,
    );

    if (!file) {
      this.logger.warn('Transcription request missing audio file');
      throw new BadRequestException('Audio file is required');
    }

    const result = await this.transcriptionService.transcribe(
      file.buffer,
      file.originalname,
      {
        language: dto.language,
        prompt: dto.prompt,
      },
    );

    this.logger.log(`Transcription complete: "${result.text.substring(0, 50)}..."`);
    return result;
  }
}
