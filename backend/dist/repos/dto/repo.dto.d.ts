export declare class CloneRepoDto {
    url: string;
    name?: string;
    branch?: string;
}
export declare class RepoResponseDto {
    id: string;
    name: string;
    path: string;
    url: string;
    createdAt: Date;
    branch?: string;
}
export declare class RepoListResponseDto {
    repos: RepoResponseDto[];
    total: number;
}
export declare class GitHubRepoDto {
    name: string;
    full_name: string;
    clone_url: string;
    private: boolean;
    description: string | null;
}
export declare class AvailableReposResponseDto {
    repos: GitHubRepoDto[];
    total: number;
}
