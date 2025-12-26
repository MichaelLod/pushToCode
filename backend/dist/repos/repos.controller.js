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
exports.ReposController = void 0;
const common_1 = require("@nestjs/common");
const api_key_guard_1 = require("../auth/guards/api-key.guard");
const repos_service_1 = require("./repos.service");
const repo_dto_1 = require("./dto/repo.dto");
let ReposController = class ReposController {
    reposService;
    constructor(reposService) {
        this.reposService = reposService;
    }
    async clone(dto) {
        return this.reposService.clone(dto);
    }
    async list() {
        const repos = await this.reposService.list();
        return {
            repos,
            total: repos.length,
        };
    }
    async get(id) {
        return this.reposService.get(id);
    }
    async delete(id) {
        await this.reposService.delete(id);
    }
    async pull(id) {
        await this.reposService.pull(id);
    }
};
exports.ReposController = ReposController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [repo_dto_1.CloneRepoDto]),
    __metadata("design:returntype", Promise)
], ReposController.prototype, "clone", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReposController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReposController.prototype, "get", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReposController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/pull'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReposController.prototype, "pull", null);
exports.ReposController = ReposController = __decorate([
    (0, common_1.Controller)('repos'),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    __metadata("design:paramtypes", [repos_service_1.ReposService])
], ReposController);
//# sourceMappingURL=repos.controller.js.map