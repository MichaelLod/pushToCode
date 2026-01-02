import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TtsStreamCallback {
  onChunk: (chunk: Buffer) => void;
  onEnd: () => void;
  onError: (error: Error) => void;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly openaiApiKey: string | undefined;
  private readonly model = 'tts-1';
  private readonly voice = 'alloy';

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!this.openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY not configured - TTS will be disabled');
    }
  }

  /**
   * Check if TTS is available (API key configured)
   */
  isAvailable(): boolean {
    return !!this.openaiApiKey;
  }

  /**
   * Stream TTS audio for the given text
   * Calls onChunk for each audio chunk, onEnd when complete, onError on failure
   */
  async streamTts(text: string, callback: TtsStreamCallback): Promise<void> {
    if (!this.openaiApiKey) {
      callback.onError(new Error('TTS not available - OPENAI_API_KEY not configured'));
      return;
    }

    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided to TTS, skipping');
      callback.onEnd();
      return;
    }

    try {
      this.logger.log(`Starting TTS for text: "${text.substring(0, 50)}..."`);

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          voice: this.voice,
          input: text,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body from OpenAI TTS API');
      }

      const reader = response.body.getReader();
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.log(`TTS complete, total bytes: ${totalBytes}`);
          callback.onEnd();
          break;
        }

        if (value) {
          totalBytes += value.length;
          callback.onChunk(Buffer.from(value));
        }
      }
    } catch (error) {
      this.logger.error(`TTS error: ${error.message}`);
      callback.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Generate TTS audio and return as a single buffer
   * Useful for smaller texts where streaming isn't necessary
   */
  async generateTts(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.streamTts(text, {
        onChunk: (chunk) => chunks.push(chunk),
        onEnd: () => resolve(Buffer.concat(chunks)),
        onError: reject,
      });
    });
  }
}
