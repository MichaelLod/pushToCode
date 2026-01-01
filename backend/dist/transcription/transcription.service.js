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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var TranscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
let TranscriptionService = TranscriptionService_1 = class TranscriptionService {
    configService;
    logger = new common_1.Logger(TranscriptionService_1.name);
    openaiApiKey;
    whisperModel = 'whisper-1';
    constructor(configService) {
        this.configService = configService;
        this.openaiApiKey = this.configService.get('OPENAI_API_KEY') || '';
    }
    async transcribe(audioBuffer, filename, options) {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }
        const formData = new form_data_1.default();
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
        formData.append('response_format', 'verbose_json');
        try {
            const response = await axios_1.default.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    Authorization: `Bearer ${this.openaiApiKey}`,
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            const data = response.data;
            return {
                text: data.text,
                duration: data.duration,
                language: data.language,
            };
        }
        catch (error) {
            this.logger.error(`Transcription error: ${error.response?.data?.error?.message || error.message}`);
            throw new Error(`Transcription failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
    getContentType(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes = {
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
    async textToSpeech(text, options) {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }
        const voice = options?.voice || 'alloy';
        const speed = Math.min(4.0, Math.max(0.25, options?.speed || 1.0));
        try {
            this.logger.log(`TTS request: voice=${voice}, speed=${speed}, text="${text.substring(0, 50)}..."`);
            const response = await axios_1.default.post('https://api.openai.com/v1/audio/speech', {
                model: 'tts-1',
                input: text,
                voice,
                speed,
            }, {
                headers: {
                    Authorization: `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer',
            });
            this.logger.log(`TTS complete: ${response.data.byteLength} bytes`);
            return Buffer.from(response.data);
        }
        catch (error) {
            this.logger.error(`TTS error: ${error.response?.data?.error?.message || error.message}`);
            throw new Error(`TTS failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
};
exports.TranscriptionService = TranscriptionService;
exports.TranscriptionService = TranscriptionService = TranscriptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TranscriptionService);
//# sourceMappingURL=transcription.service.js.map