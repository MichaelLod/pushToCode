import { ConfigService } from '@nestjs/config';
import { CloneRepoDto, RepoResponseDto } from './dto/repo.dto';
export declare class ReposService {
    private configService;
    private readonly logger;
    private readonly reposPath;
    private repos;
    constructor(configService: ConfigService);
    private initializeReposDirectory;
    private loadExistingRepos;
    private saveMetadata;
    clone(dto: CloneRepoDto): Promise<RepoResponseDto>;
    list(): Promise<RepoResponseDto[]>;
    get(id: string): Promise<RepoResponseDto>;
    delete(id: string): Promise<void>;
    pull(id: string): Promise<void>;
    private extractRepoName;
    getRepoPath(id: string): string | null;
}
