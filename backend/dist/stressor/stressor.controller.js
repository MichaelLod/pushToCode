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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StressorController = void 0;
const common_1 = require("@nestjs/common");
const stressor_service_1 = require("./stressor.service");
const stressor_dto_1 = require("./dto/stressor.dto");
const api_key_guard_1 = require("../auth/guards/api-key.guard");
let StressorController = class StressorController {
    stressorService;
    constructor(stressorService) {
        this.stressorService = stressorService;
    }
    getStatus() {
        return this.stressorService.getStatus();
    }
    getConfig() {
        return this.stressorService.getConfig();
    }
    updateConfig(config) {
        return this.stressorService.updateConfig(config);
    }
    async start() {
        return this.stressorService.start();
    }
    async stop() {
        return this.stressorService.stop();
    }
    addProject(dto) {
        return this.stressorService.addProject(dto.path);
    }
    removeProject(projectPath) {
        const decodedPath = decodeURIComponent(projectPath);
        return this.stressorService.removeProject(decodedPath);
    }
    getLogs(lines) {
        const numLines = lines ? parseInt(lines, 10) : 100;
        return { logs: this.stressorService.getLogs(numLines) };
    }
};
exports.StressorController = StressorController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", stressor_dto_1.StressorStatusDto)
], StressorController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", stressor_dto_1.StressorConfigDto)
], StressorController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)('config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", stressor_dto_1.StressorConfigDto)
], StressorController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Post)('start'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StressorController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('stop'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StressorController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)('projects'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [stressor_dto_1.AddProjectDto]),
    __metadata("design:returntype", stressor_dto_1.StressorConfigDto)
], StressorController.prototype, "addProject", null);
__decorate([
    (0, common_1.Delete)('projects/:path'),
    __param(0, (0, common_1.Param)('path')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", stressor_dto_1.StressorConfigDto)
], StressorController.prototype, "removeProject", null);
__decorate([
    (0, common_1.Get)('logs'),
    __param(0, (0, common_1.Query)('lines')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], StressorController.prototype, "getLogs", null);
exports.StressorController = StressorController = __decorate([
    (0, common_1.Controller)('stressor'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __metadata("design:paramtypes", [stressor_service_1.StressorService])
], StressorController);
//# sourceMappingURL=stressor.controller.js.map