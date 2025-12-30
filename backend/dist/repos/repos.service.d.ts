import { ConfigService } from '@nestjs/config';
import { CloneRepoDto, RepoResponseDto, GitHubRepoDto } from './dto/repo.dto';
export declare class ReposService {
    private configService;
    private readonly logger;
    private readonly reposPath;
    private repos;
    private readonly githubToken;
    constructor(configService: ConfigService);
    private initializeReposDirectory;
    private loadExistingRepos;
    private scanForNewRepos;
    private getRepoRemoteUrl;
    private saveMetadata;
    clone(dto: CloneRepoDto): Promise<RepoResponseDto>;
    list(): Promise<RepoResponseDto[]>;
    get(id: string): Promise<RepoResponseDto>;
    delete(id: string): Promise<void>;
    pull(id: string): Promise<void>;
    private extractRepoName;
    private getAuthenticatedUrl;
    getRepoPath(id: string): string | null;
    getAvailableRepos(): Promise<GitHubRepoDto[]>;
}
