import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { TranscribeResponseDto, TtsVoice } from './dto/transcribe.dto';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly openaiApiKey: string;
  private readonly whisperModel = 'whisper-1';

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    options?: { language?: string; prompt?: string },
  ): Promise<TranscribeResponseDto> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: filename,
      contentType: this.getContentType(filename),
    });
    formData.append('model', this.whisperModel);

    if (options?.language) {
      formData.append('language', options.language);
    }

    if (options?.prompt) {
      formData.append('prompt', options.prompt);
    }

    // Request verbose_json to get duration info
    formData.append('response_format', 'verbose_json');

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      const data = response.data;

      return {
        text: data.text,
        duration: data.duration,
        language: data.language,
      };
    } catch (error) {
      this.logger.error(
        `Transcription error: ${error.response?.data?.error?.message || error.message}`,
      );
      throw new Error(
        `Transcription failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      m4a: 'audio/m4a',
      mp3: 'audio/mpeg',
      mp4: 'audio/mp4',
      mpeg: 'audio/mpeg',
      mpga: 'audio/mpeg',
      wav: 'audio/wav',
      webm: 'audio/webm',
    };
    return mimeTypes[ext || ''] || 'audio/m4a';
  }

  async textToSpeech(
    text: string,
    options?: { voice?: TtsVoice; speed?: number },
  ): Promise<Buffer> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const voice = options?.voice || 'alloy';
    const speed = Math.min(4.0, Math.max(0.25, options?.speed || 1.0));

    try {
      this.logger.log(`TTS request: voice=${voice}, speed=${speed}, text="${text.substring(0, 50)}..."`);

      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: text,
          voice,
          speed,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        },
      );

      this.logger.log(`TTS complete: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(
        `TTS error: ${error.response?.data?.error?.message || error.message}`,
      );
      throw new Error(
        `TTS failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}
