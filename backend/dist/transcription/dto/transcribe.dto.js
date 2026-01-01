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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextToSpeechDto = exports.TranscribeResponseDto = exports.TranscribeDto = void 0;
const class_validator_1 = require("class-validator");
class TranscribeDto {
    language;
    prompt;
}
exports.TranscribeDto = TranscribeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TranscribeDto.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TranscribeDto.prototype, "prompt", void 0);
class TranscribeResponseDto {
    text;
    duration;
    language;
}
exports.TranscribeResponseDto = TranscribeResponseDto;
class TextToSpeechDto {
    text;
    voice;
    speed;
}
exports.TextToSpeechDto = TextToSpeechDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TextToSpeechDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
    __metadata("design:type", String)
], TextToSpeechDto.prototype, "voice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.25),
    (0, class_validator_1.Max)(4.0),
    __metadata("design:type", Number)
], TextToSpeechDto.prototype, "speed", void 0);
//# sourceMappingURL=transcribe.dto.js.map