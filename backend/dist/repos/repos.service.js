"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReposService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReposService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
let ReposService = ReposService_1 = class ReposService {
    configService;
    logger = new common_1.Logger(ReposService_1.name);
    reposPath;
    repos = new Map();
    githubToken;
    constructor(configService) {
        this.configService = configService;
        this.reposPath =
            this.configService.get('REPOS_PATH') ||
                path.join(process.cwd(), 'repos');
        const rawToken = this.configService.get('GITHUB_TOKEN');
        this.githubToken = rawToken?.trim().replace(/^["']|["']$/g, '');
        if (this.githubToken) {
            const masked = this.githubToken.slice(0, 4) + '...' + this.githubToken.slice(-4);
            this.logger.log(`GitHub token configured: Yes (length: ${this.githubToken.length}, preview: ${masked})`);
        }
        else {
            this.logger.log('GitHub token configured: No');
        }
        this.initializeReposDirectory();
        this.loadExistingRepos();
    }
    async initializeReposDirectory() {
        try {
            await fs.mkdir(this.reposPath, { recursive: true });
            this.logger.log(`Repos directory initialized: ${this.reposPath}`);
        }
        catch (error) {
            this.logger.error(`Failed to create repos directory: ${error.message}`);
        }
    }
    async loadExistingRepos() {
        try {
            const metadataPath = path.join(this.reposPath, '.repos-metadata.json');
            const data = await fs.readFile(metadataPath, 'utf-8');
            const repos = JSON.parse(data);
            for (const repo of repos) {
                try {
                    await fs.access(repo.path);
                    this.repos.set(repo.id, {
                        ...repo,
                        createdAt: new Date(repo.createdAt),
                    });
                }
                catch {
                    this.logger.warn(`Repo ${repo.name} no longer exists at ${repo.path}`);
                }
            }
            this.logger.log(`Loaded ${this.repos.size} existing repos`);
        }
        catch {
            this.logger.log('No existing repos metadata found');
        }
    }
    async saveMetadata() {
        const metadataPath = path.join(this.reposPath, '.repos-metadata.json');
        const repos = Array.from(this.repos.values());
        await fs.writeFile(metadataPath, JSON.stringify(repos, null, 2));
    }
    async clone(dto) {
        const { url, branch } = dto;
        const name = dto.name || this.extractRepoName(url);
        const id = (0, uuid_1.v4)();
        const repoPath = path.join(this.reposPath, name);
        try {
            await fs.access(repoPath);
            throw new Error(`Repository with name "${name}" already exists`);
        }
        catch (error) {
            if (error.message.includes('already exists'))
                throw error;
        }
        const cloneUrl = this.getAuthenticatedUrl(url);
        this.logger.log(`Cloning ${url} to ${repoPath}`);
        await new Promise((resolve, reject) => {
            const args = ['clone'];
            if (branch) {
                args.push('--branch', branch);
            }
            args.push('--depth', '1', cloneUrl, repoPath);
            const git = (0, child_process_1.spawn)('git', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stderr = '';
            git.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            git.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Git clone failed: ${stderr}`));
                }
            });
            git.on('error', (error) => {
                reject(new Error(`Git clone error: ${error.message}`));
            });
        });
        const repo = {
            id,
            name,
            path: repoPath,
            url,
            branch,
            createdAt: new Date(),
        };
        this.repos.set(id, repo);
        await this.saveMetadata();
        this.logger.log(`Cloned ${name} successfully`);
        return {
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.url,
            createdAt: repo.createdAt,
            branch: repo.branch,
        };
    }
    async list() {
        return Array.from(this.repos.values()).map((repo) => ({
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.url,
            createdAt: repo.createdAt,
            branch: repo.branch,
        }));
    }
    async get(id) {
        const repo = this.repos.get(id);
        if (!repo) {
            throw new common_1.NotFoundException(`Repository with id "${id}" not found`);
        }
        return {
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.url,
            createdAt: repo.createdAt,
            branch: repo.branch,
        };
    }
    async delete(id) {
        const repo = this.repos.get(id);
        if (!repo) {
            throw new common_1.NotFoundException(`Repository with id "${id}" not found`);
        }
        this.logger.log(`Deleting repository ${repo.name}`);
        try {
            await fs.rm(repo.path, { recursive: true, force: true });
        }
        catch (error) {
            this.logger.error(`Failed to delete repo files: ${error.message}`);
            throw new Error(`Failed to delete repository: ${error.message}`);
        }
        this.repos.delete(id);
        await this.saveMetadata();
        this.logger.log(`Deleted ${repo.name} successfully`);
    }
    async pull(id) {
        const repo = this.repos.get(id);
        if (!repo) {
            throw new common_1.NotFoundException(`Repository with id "${id}" not found`);
        }
        this.logger.log(`Pulling latest for ${repo.name}`);
        await new Promise((resolve, reject) => {
            const git = (0, child_process_1.spawn)('git', ['pull'], {
                cwd: repo.path,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stderr = '';
            git.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            git.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Git pull failed: ${stderr}`));
                }
            });
            git.on('error', (error) => {
                reject(new Error(`Git pull error: ${error.message}`));
            });
        });
    }
    extractRepoName(url) {
        let name = url.split('/').pop() || url.split(':').pop() || 'repo';
        name = name.replace(/\.git$/, '');
        return name;
    }
    getAuthenticatedUrl(url) {
        this.logger.debug(`Original URL: ${url}, Token present: ${!!this.githubToken}`);
        if (!this.githubToken) {
            return url;
        }
        if (url.startsWith('git@github.com:')) {
            const path = url.replace('git@github.com:', '');
            const authUrl = `https://x-access-token:${this.githubToken}@github.com/${path}`;
            this.logger.debug(`Transformed URL: https://x-access-token:****@github.com/${path}`);
            return authUrl;
        }
        if (url.startsWith('https://github.com/')) {
            const path = url.replace('https://github.com/', '');
            const authUrl = `https://x-access-token:${this.githubToken}@github.com/${path}`;
            this.logger.debug(`Transformed URL: https://x-access-token:****@github.com/${path}`);
            return authUrl;
        }
        return url;
    }
    getRepoPath(id) {
        const repo = this.repos.get(id);
        return repo?.path || null;
    }
    async getAvailableRepos() {
        if (!this.githubToken) {
            throw new Error('GitHub token not configured');
        }
        const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
                Authorization: `Bearer ${this.githubToken}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        const repos = await response.json();
        return repos.map((r) => ({
            name: r.name,
            full_name: r.full_name,
            clone_url: r.clone_url,
            private: r.private,
            description: r.description,
        }));
    }
};
exports.ReposService = ReposService;
exports.ReposService = ReposService = ReposService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ReposService);
//# sourceMappingURL=repos.service.js.map