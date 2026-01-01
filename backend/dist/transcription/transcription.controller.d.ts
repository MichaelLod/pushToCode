import type { Response } from 'express';
import { TranscriptionService } from './transcription.service';
import { TranscribeDto, TranscribeResponseDto, TextToSpeechDto } from './dto/transcribe.dto';
export declare class TranscriptionController {
    private transcriptionService;
    private readonly logger;
    constructor(transcriptionService: TranscriptionService);
    transcribe(file: Express.Multer.File, dto: TranscribeDto): Promise<TranscribeResponseDto>;
    textToSpeech(dto: TextToSpeechDto, res: Response): Promise<void>;
}
