import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  Matches,
} from 'class-validator';

export class CloneRepoDto {
  @IsNotEmpty()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Name can only contain alphanumeric characters, dashes and underscores',
  })
  name?: string;

  @IsOptional()
  @IsString()
  branch?: string;
}

export class RepoResponseDto {
  id: string;
  name: string;
  path: string;
  url: string;
  createdAt: Date;
  branch?: string;
}

export class RepoListResponseDto {
  repos: RepoResponseDto[];
  total: number;
}

export class GitHubRepoDto {
  name: string;
  full_name: string;
  clone_url: string;
  private: boolean;
  description: string | null;
}

export class AvailableReposResponseDto {
  repos: GitHubRepoDto[];
  total: number;
}
