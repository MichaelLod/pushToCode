import { ConfigService } from '@nestjs/config';
import { TranscribeResponseDto, TtsVoice } from './dto/transcribe.dto';
export declare class TranscriptionService {
    private configService;
    private readonly logger;
    private readonly openaiApiKey;
    private readonly whisperModel;
    constructor(configService: ConfigService);
    transcribe(audioBuffer: Buffer, filename: string, options?: {
        language?: string;
        prompt?: string;
    }): Promise<TranscribeResponseDto>;
    private getContentType;
    textToSpeech(text: string, options?: {
        voice?: TtsVoice;
        speed?: number;
    }): Promise<Buffer>;
}
