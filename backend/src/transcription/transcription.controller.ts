import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TranscriptionService } from './transcription.service';
import { TranscribeDto, TranscribeResponseDto, TextToSpeechDto } from './dto/transcribe.dto';

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

  @Post('tts')
  async textToSpeech(
    @Body() dto: TextToSpeechDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!dto.text || dto.text.trim().length === 0) {
      throw new BadRequestException('Text is required for TTS');
    }

    this.logger.log(`TTS request: text="${dto.text.substring(0, 50)}...", voice=${dto.voice || 'alloy'}`);

    const audioBuffer = await this.transcriptionService.textToSpeech(
      dto.text,
      { voice: dto.voice, speed: dto.speed },
    );

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-cache',
    });
    res.send(audioBuffer);
  }
}
