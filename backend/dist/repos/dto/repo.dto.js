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
exports.AvailableReposResponseDto = exports.GitHubRepoDto = exports.RepoListResponseDto = exports.RepoResponseDto = exports.CloneRepoDto = void 0;
const class_validator_1 = require("class-validator");
class CloneRepoDto {
    url;
    name;
    branch;
}
exports.CloneRepoDto = CloneRepoDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CloneRepoDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9_-]+$/, {
        message: 'Name can only contain alphanumeric characters, dashes and underscores',
    }),
    __metadata("design:type", String)
], CloneRepoDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CloneRepoDto.prototype, "branch", void 0);
class RepoResponseDto {
    id;
    name;
    path;
    url;
    createdAt;
    branch;
}
exports.RepoResponseDto = RepoResponseDto;
class RepoListResponseDto {
    repos;
    total;
}
exports.RepoListResponseDto = RepoListResponseDto;
class GitHubRepoDto {
    name;
    full_name;
    clone_url;
    private;
    description;
}
exports.GitHubRepoDto = GitHubRepoDto;
class AvailableReposResponseDto {
    repos;
    total;
}
exports.AvailableReposResponseDto = AvailableReposResponseDto;
//# sourceMappingURL=repo.dto.js.map