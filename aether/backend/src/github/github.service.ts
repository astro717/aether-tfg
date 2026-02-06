import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';

export interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  url: string;
  description: string | null;
  default_branch: string;
  private: boolean;
}

export interface GithubCommit {
  sha: string;
  message: string;
  author_login: string | null;
  committed_at: Date;
  additions: number;
  deletions: number;
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
    status: string;
  }>;
}

export interface CommitDiff {
  sha: string;
  message: string;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private octokit: Octokit;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('github.token');
    this.octokit = new Octokit({ auth: token });
    this.logger.log('GithubService initialized with token');
  }

  /**
   * Create an Octokit instance with a specific user's token
   */
  private getOctokitForUser(userToken?: string): Octokit {
    if (userToken) {
      return new Octokit({ auth: userToken });
    }
    return this.octokit;
  }

  /**
   * Get all repositories accessible to the authenticated user
   */
  async getRepositories(userToken?: string): Promise<GithubRepository[]> {
    const octokit = this.getOctokitForUser(userToken);
    const repos: GithubRepository[] = [];

    try {
      // Paginate through all repos
      for await (const response of octokit.paginate.iterator(
        octokit.rest.repos.listForAuthenticatedUser,
        { per_page: 100, sort: 'updated' },
      )) {
        for (const repo of response.data) {
          repos.push({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner: repo.owner.login,
            url: repo.html_url,
            description: repo.description,
            default_branch: repo.default_branch,
            private: repo.private,
          });
        }
      }

      this.logger.log(`Fetched ${repos.length} repositories from GitHub`);
      return repos;
    } catch (error) {
      this.logger.error('Error fetching repositories:', error);
      throw error;
    }
  }

  /**
   * Get commits for a specific repository with pagination
   */
  async getCommits(
    owner: string,
    repo: string,
    options: { perPage?: number; page?: number; since?: string } = {},
    userToken?: string,
  ): Promise<GithubCommit[]> {
    const octokit = this.getOctokitForUser(userToken);
    const { perPage = 30, page = 1, since } = options;

    try {
      const response = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
        ...(since && { since }),
      });

      const commits: GithubCommit[] = response.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author_login: commit.author?.login || commit.commit.author?.name || null,
        committed_at: new Date(commit.commit.committer?.date || new Date()),
        additions: 0, // Will be fetched separately if needed
        deletions: 0,
        files: [],
      }));

      this.logger.log(`Fetched ${commits.length} commits from ${owner}/${repo}`);
      return commits;
    } catch (error) {
      this.logger.error(`Error fetching commits for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed commit information including diff/patch
   */
  async getDiff(
    owner: string,
    repo: string,
    sha: string,
    userToken?: string,
  ): Promise<CommitDiff> {
    const octokit = this.getOctokitForUser(userToken);

    try {
      const response = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      const commit = response.data;

      const diff: CommitDiff = {
        sha: commit.sha,
        message: commit.commit.message,
        files:
          commit.files?.map((file) => ({
            filename: file.filename,
            status: file.status || 'modified',
            additions: file.additions,
            deletions: file.deletions,
            patch: file.patch,
          })) || [],
        stats: {
          additions: commit.stats?.additions || 0,
          deletions: commit.stats?.deletions || 0,
          total: commit.stats?.total || 0,
        },
      };

      this.logger.log(`Fetched diff for commit ${sha} from ${owner}/${repo}`);
      return diff;
    } catch (error) {
      this.logger.error(`Error fetching diff for ${sha}:`, error);
      throw error;
    }
  }

  /**
   * Get all commits with full pagination
   */
  async getAllCommits(
    owner: string,
    repo: string,
    options: { since?: string; maxCommits?: number } = {},
    userToken?: string,
  ): Promise<GithubCommit[]> {
    const octokit = this.getOctokitForUser(userToken);
    const { since, maxCommits = 100 } = options;
    const commits: GithubCommit[] = [];

    try {
      for await (const response of octokit.paginate.iterator(
        octokit.rest.repos.listCommits,
        {
          owner,
          repo,
          per_page: 100,
          ...(since && { since }),
        },
      )) {
        for (const commit of response.data) {
          commits.push({
            sha: commit.sha,
            message: commit.commit.message,
            author_login: commit.author?.login || commit.commit.author?.name || null,
            committed_at: new Date(commit.commit.committer?.date || new Date()),
            additions: 0,
            deletions: 0,
            files: [],
          });

          if (commits.length >= maxCommits) {
            break;
          }
        }
        if (commits.length >= maxCommits) {
          break;
        }
      }

      this.logger.log(`Fetched ${commits.length} commits from ${owner}/${repo}`);
      return commits;
    } catch (error) {
      this.logger.error(`Error fetching all commits for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Get repository details by owner and repo name
   */
  async getRepository(
    owner: string,
    repo: string,
    userToken?: string,
  ): Promise<GithubRepository | null> {
    const octokit = this.getOctokitForUser(userToken);

    try {
      const response = await octokit.rest.repos.get({ owner, repo });
      const repoData = response.data;

      return {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        owner: repoData.owner.login,
        url: repoData.html_url,
        description: repoData.description,
        default_branch: repoData.default_branch,
        private: repoData.private,
      };
    } catch (error) {
      this.logger.error(`Error fetching repository ${owner}/${repo}:`, error);
      return null;
    }
  }
}
