import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CloneRepoDto, RepoResponseDto, GitHubRepoDto } from './dto/repo.dto';

interface RepoMetadata {
  id: string;
  name: string;
  path: string;
  url: string;
  branch?: string;
  createdAt: Date;
}

@Injectable()
export class ReposService {
  private readonly logger = new Logger(ReposService.name);
  private readonly reposPath: string;
  private repos: Map<string, RepoMetadata> = new Map();

  private readonly githubToken: string | undefined;

  constructor(private configService: ConfigService) {
    this.reposPath =
      this.configService.get<string>('REPOS_PATH') ||
      path.join(process.cwd(), 'repos');
    const rawToken = this.configService.get<string>('GITHUB_TOKEN');
    this.githubToken = rawToken?.trim().replace(/^["']|["']$/g, ''); // Remove quotes and whitespace
    if (this.githubToken) {
      const masked = this.githubToken.slice(0, 4) + '...' + this.githubToken.slice(-4);
      this.logger.log(`GitHub token configured: Yes (length: ${this.githubToken.length}, preview: ${masked})`);
    } else {
      this.logger.log('GitHub token configured: No');
    }
    this.initializeReposDirectory();
    this.loadExistingRepos();
  }

  private async initializeReposDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reposPath, { recursive: true });
      this.logger.log(`Repos directory initialized: ${this.reposPath}`);
    } catch (error) {
      this.logger.error(`Failed to create repos directory: ${error.message}`);
    }
  }

  private async loadExistingRepos(): Promise<void> {
    // First, load from metadata file
    try {
      const metadataPath = path.join(this.reposPath, '.repos-metadata.json');
      const data = await fs.readFile(metadataPath, 'utf-8');
      const repos: RepoMetadata[] = JSON.parse(data);

      for (const repo of repos) {
        // Verify the repo still exists
        try {
          await fs.access(repo.path);
          this.repos.set(repo.id, {
            ...repo,
            createdAt: new Date(repo.createdAt),
          });
        } catch {
          this.logger.warn(
            `Repo ${repo.name} no longer exists at ${repo.path}`,
          );
        }
      }

      this.logger.log(`Loaded ${this.repos.size} repos from metadata`);
    } catch {
      // No metadata file yet, that's fine
      this.logger.log('No existing repos metadata found');
    }

    // Then, scan directory for any git repos not in metadata
    await this.scanForNewRepos();
  }

  private async scanForNewRepos(): Promise<void> {
    try {
      const entries = await fs.readdir(this.reposPath, { withFileTypes: true });
      const knownPaths = new Set(Array.from(this.repos.values()).map(r => r.path));
      let added = 0;

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
          continue;
        }

        const repoPath = path.join(this.reposPath, entry.name);

        // Skip if already known
        if (knownPaths.has(repoPath)) {
          continue;
        }

        // Check if it's a git repo
        try {
          await fs.access(path.join(repoPath, '.git'));

          // It's a git repo not in our metadata - add it
          const id = uuidv4();
          const repo: RepoMetadata = {
            id,
            name: entry.name,
            path: repoPath,
            url: await this.getRepoRemoteUrl(repoPath) || '',
            createdAt: new Date(),
          };

          this.repos.set(id, repo);
          added++;
          this.logger.log(`Discovered existing repo: ${entry.name}`);
        } catch {
          // Not a git repo, skip
        }
      }

      if (added > 0) {
        await this.saveMetadata();
        this.logger.log(`Added ${added} discovered repos to metadata`);
      }
    } catch (error) {
      this.logger.error(`Failed to scan repos directory: ${error.message}`);
    }
  }

  private async getRepoRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const { spawn } = await import('child_process');
      return new Promise((resolve) => {
        const git = spawn('git', ['remote', 'get-url', 'origin'], {
          cwd: repoPath,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        git.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        git.on('close', (code) => {
          resolve(code === 0 ? stdout.trim() : null);
        });

        git.on('error', () => {
          resolve(null);
        });
      });
    } catch {
      return null;
    }
  }

  private async saveMetadata(): Promise<void> {
    const metadataPath = path.join(this.reposPath, '.repos-metadata.json');
    const repos = Array.from(this.repos.values());
    await fs.writeFile(metadataPath, JSON.stringify(repos, null, 2));
  }

  async clone(dto: CloneRepoDto): Promise<RepoResponseDto> {
    const { url, branch } = dto;

    // Extract repo name from URL if not provided
    const name = dto.name || this.extractRepoName(url);
    const id = uuidv4();
    const repoPath = path.join(this.reposPath, name);

    // Check if directory already exists
    try {
      await fs.access(repoPath);
      throw new Error(`Repository with name "${name}" already exists`);
    } catch (error) {
      if (error.message.includes('already exists')) throw error;
      // Directory doesn't exist, which is what we want
    }

    const cloneUrl = this.getAuthenticatedUrl(url);
    this.logger.log(`Cloning ${url} to ${repoPath}`);

    await new Promise<void>((resolve, reject) => {
      const args = ['clone'];

      if (branch) {
        args.push('--branch', branch);
      }

      args.push('--depth', '1', cloneUrl, repoPath);

      const git = spawn('git', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';

      git.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Git clone error: ${error.message}`));
      });
    });

    const repo: RepoMetadata = {
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

  async list(): Promise<RepoResponseDto[]> {
    return Array.from(this.repos.values()).map((repo) => ({
      id: repo.id,
      name: repo.name,
      path: repo.path,
      url: repo.url,
      createdAt: repo.createdAt,
      branch: repo.branch,
    }));
  }

  async get(id: string): Promise<RepoResponseDto> {
    const repo = this.repos.get(id);
    if (!repo) {
      throw new NotFoundException(`Repository with id "${id}" not found`);
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

  async delete(id: string): Promise<void> {
    const repo = this.repos.get(id);
    if (!repo) {
      throw new NotFoundException(`Repository with id "${id}" not found`);
    }

    this.logger.log(`Deleting repository ${repo.name}`);

    try {
      await fs.rm(repo.path, { recursive: true, force: true });
    } catch (error) {
      this.logger.error(`Failed to delete repo files: ${error.message}`);
      throw new Error(`Failed to delete repository: ${error.message}`);
    }

    this.repos.delete(id);
    await this.saveMetadata();

    this.logger.log(`Deleted ${repo.name} successfully`);
  }

  async pull(id: string): Promise<void> {
    const repo = this.repos.get(id);
    if (!repo) {
      throw new NotFoundException(`Repository with id "${id}" not found`);
    }

    this.logger.log(`Pulling latest for ${repo.name}`);

    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['pull'], {
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
        } else {
          reject(new Error(`Git pull failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Git pull error: ${error.message}`));
      });
    });
  }

  private extractRepoName(url: string): string {
    // Handle various URL formats:
    // https://github.com/user/repo.git
    // git@github.com:user/repo.git
    // https://github.com/user/repo

    let name = url.split('/').pop() || url.split(':').pop() || 'repo';
    name = name.replace(/\.git$/, '');
    return name;
  }

  private getAuthenticatedUrl(url: string): string {
    this.logger.debug(`Original URL: ${url}, Token present: ${!!this.githubToken}`);
    // If no token, return original URL
    if (!this.githubToken) {
      return url;
    }

    // Convert SSH URL to HTTPS with token
    // git@github.com:user/repo.git -> https://x-access-token:token@github.com/user/repo.git
    if (url.startsWith('git@github.com:')) {
      const path = url.replace('git@github.com:', '');
      const authUrl = `https://x-access-token:${this.githubToken}@github.com/${path}`;
      this.logger.debug(`Transformed URL: https://x-access-token:****@github.com/${path}`);
      return authUrl;
    }

    // Add token to existing HTTPS GitHub URL
    // https://github.com/user/repo.git -> https://x-access-token:token@github.com/user/repo.git
    if (url.startsWith('https://github.com/')) {
      const path = url.replace('https://github.com/', '');
      const authUrl = `https://x-access-token:${this.githubToken}@github.com/${path}`;
      this.logger.debug(`Transformed URL: https://x-access-token:****@github.com/${path}`);
      return authUrl;
    }

    // Return original for non-GitHub URLs
    return url;
  }

  getRepoPath(id: string): string | null {
    const repo = this.repos.get(id);
    return repo?.path || null;
  }

  async getAvailableRepos(): Promise<GitHubRepoDto[]> {
    if (!this.githubToken) {
      throw new Error('GitHub token not configured');
    }

    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      {
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();
    return repos.map((r: any) => ({
      name: r.name,
      full_name: r.full_name,
      clone_url: r.clone_url,
      private: r.private,
      description: r.description,
    }));
  }
}
