import { TranscriptionService } from './transcription.service';
import { TranscribeDto, TranscribeResponseDto } from './dto/transcribe.dto';
export declare class TranscriptionController {
    private transcriptionService;
    constructor(transcriptionService: TranscriptionService);
    transcribe(file: Express.Multer.File, dto: TranscribeDto): Promise<TranscribeResponseDto>;
}
