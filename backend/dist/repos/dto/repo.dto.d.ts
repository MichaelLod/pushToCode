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
