import { ReposService } from './repos.service';
import { CloneRepoDto, RepoResponseDto, RepoListResponseDto, AvailableReposResponseDto } from './dto/repo.dto';
export declare class ReposController {
    private reposService;
    constructor(reposService: ReposService);
    clone(dto: CloneRepoDto): Promise<RepoResponseDto>;
    list(): Promise<RepoListResponseDto>;
    getAvailable(): Promise<AvailableReposResponseDto>;
    get(id: string): Promise<RepoResponseDto>;
    delete(id: string): Promise<void>;
    pull(id: string): Promise<void>;
}
