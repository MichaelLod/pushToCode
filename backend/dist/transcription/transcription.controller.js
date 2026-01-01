"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TranscriptionController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const api_key_guard_1 = require("../auth/guards/api-key.guard");
const transcription_service_1 = require("./transcription.service");
const transcribe_dto_1 = require("./dto/transcribe.dto");
let TranscriptionController = TranscriptionController_1 = class TranscriptionController {
    transcriptionService;
    logger = new common_1.Logger(TranscriptionController_1.name);
    constructor(transcriptionService) {
        this.transcriptionService = transcriptionService;
    }
    async transcribe(file, dto) {
        this.logger.log(`Transcription request received: file=${file?.originalname}, size=${file?.size} bytes`);
        if (!file) {
            this.logger.warn('Transcription request missing audio file');
            throw new common_1.BadRequestException('Audio file is required');
        }
        const result = await this.transcriptionService.transcribe(file.buffer, file.originalname, {
            language: dto.language,
            prompt: dto.prompt,
        });
        this.logger.log(`Transcription complete: "${result.text.substring(0, 50)}..."`);
        return result;
    }
    async textToSpeech(dto, res) {
        if (!dto.text || dto.text.trim().length === 0) {
            throw new common_1.BadRequestException('Text is required for TTS');
        }
        this.logger.log(`TTS request: text="${dto.text.substring(0, 50)}...", voice=${dto.voice || 'alloy'}`);
        const audioBuffer = await this.transcriptionService.textToSpeech(dto.text, { voice: dto.voice, speed: dto.speed });
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'no-cache',
        });
        res.send(audioBuffer);
    }
};
exports.TranscriptionController = TranscriptionController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('audio', {
        limits: {
            fileSize: 25 * 1024 * 1024,
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
            }
            else {
                callback(new common_1.BadRequestException(`Invalid audio format: ${file.mimetype}. Supported: m4a, mp3, mp4, wav, webm`), false);
            }
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, transcribe_dto_1.TranscribeDto]),
    __metadata("design:returntype", Promise)
], TranscriptionController.prototype, "transcribe", null);
__decorate([
    (0, common_1.Post)('tts'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transcribe_dto_1.TextToSpeechDto, Object]),
    __metadata("design:returntype", Promise)
], TranscriptionController.prototype, "textToSpeech", null);
exports.TranscriptionController = TranscriptionController = TranscriptionController_1 = __decorate([
    (0, common_1.Controller)('transcribe'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __metadata("design:paramtypes", [transcription_service_1.TranscriptionService])
], TranscriptionController);
//# sourceMappingURL=transcription.controller.js.map