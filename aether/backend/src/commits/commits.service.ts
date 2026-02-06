import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommitDto } from './dto/create-commit.dto';
import { UpdateCommitDto } from './dto/update-commit.dto';
import { GithubService } from '../github/github.service';

@Injectable()
export class CommitsService {
  private readonly logger = new Logger(CommitsService.name);

  // Regex to match task references like #42, T-15, TASK-123
  private readonly TASK_REF_PATTERN = /#(\d+)/g;

  constructor(
    private prisma: PrismaService,
    private githubService: GithubService,
  ) {}

  /**
   * Parse task references from a commit message
   * Returns array of readable_ids found (e.g., [42, 15, 123])
   */
  parseTaskReferences(message: string): number[] {
    const matches: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = this.TASK_REF_PATTERN.exec(message)) !== null) {
      const readableId = parseInt(match[1], 10);
      if (!isNaN(readableId) && !matches.includes(readableId)) {
        matches.push(readableId);
      }
    }

    // Reset regex lastIndex for subsequent uses
    this.TASK_REF_PATTERN.lastIndex = 0;

    return matches;
  }

  /**
   * Link a commit to tasks based on message references
   * Returns the number of tasks successfully linked
   */
  async linkCommitToTasks(commitSha: string, message: string): Promise<number> {
    const taskIds = this.parseTaskReferences(message);

    if (taskIds.length === 0) {
      return 0;
    }

    let linkedCount = 0;

    for (const readableId of taskIds) {
      // Find task by readable_id
      const task = await this.prisma.tasks.findUnique({
        where: { readable_id: readableId },
      });

      if (!task) {
        this.logger.warn(`Task #${readableId} referenced in commit ${commitSha.substring(0, 7)} not found`);
        continue;
      }

      // Check if link already exists
      const existingLink = await this.prisma.task_commits.findUnique({
        where: {
          task_id_commit_sha: {
            task_id: task.id,
            commit_sha: commitSha,
          },
        },
      });

      if (existingLink) {
        this.logger.debug(`Commit ${commitSha.substring(0, 7)} already linked to task #${readableId}`);
        continue;
      }

      // Create the link
      await this.prisma.task_commits.create({
        data: {
          task_id: task.id,
          commit_sha: commitSha,
        },
      });

      this.logger.log(`Linked commit ${commitSha.substring(0, 7)} to task #${readableId}`);
      linkedCount++;
    }

    return linkedCount;
  }

  async create(dto: CreateCommitDto, user: any) {
    return this.prisma.commits.create({
      data: {
        sha: dto.sha,
        repo_id: dto.repo_id,
        author_login: user.username,
        committed_at: dto.committed_at ?? new Date(),
        message: dto.message,
        added_lines: dto.added_lines ?? 0,
        deleted_lines: dto.deleted_lines ?? 0,
      },
    });
  }

  async findAll() {
    return this.prisma.commits.findMany({
      orderBy: { committed_at: 'desc' },
    });
  }

  async findByRepo(repoId: string) {
    return this.prisma.commits.findMany({
      where: { repo_id: repoId },
      orderBy: { committed_at: 'desc' },
    });
  }

  async update(sha: string, dto: UpdateCommitDto, user: any) {
    const commit = await this.prisma.commits.findUnique({ where: { sha } });
    if (!commit) throw new NotFoundException('Commit not found');

    // Author can edit their own commits, managers can edit all
    if (commit.author_login !== user.username && user.role !== 'manager') {
      throw new ForbiddenException('You cannot edit this commit');
    }

    return this.prisma.commits.update({
      where: { sha },
      data: dto,
    });
  }

  async remove(sha: string, user: any) {
    if (user.role !== 'manager') throw new ForbiddenException('Only managers can delete commits');

    return this.prisma.commits.delete({ where: { sha } });
  }

  /**
   * Sync commits from GitHub for a specific repository
   * Automatically links commits to tasks based on #N references in commit messages
   */
  async syncFromGithub(
    repoId: string,
    owner: string,
    repoName: string,
    user: any,
    options: { maxCommits?: number } = {},
  ) {
    const userToken = user.github_access_token || undefined;
    const { maxCommits = 50 } = options;

    this.logger.log(`Syncing commits for ${owner}/${repoName}`);

    // Get latest commit date from DB to only fetch newer commits
    const latestCommit = await this.prisma.commits.findFirst({
      where: { repo_id: repoId },
      orderBy: { committed_at: 'desc' },
    });

    const since = latestCommit?.committed_at?.toISOString();

    const githubCommits = await this.githubService.getAllCommits(
      owner,
      repoName,
      { since, maxCommits },
      userToken,
    );

    let syncedCount = 0;
    let linkedCount = 0;

    for (const ghCommit of githubCommits) {
      // Check if commit already exists
      const existingCommit = await this.prisma.commits.findUnique({
        where: { sha: ghCommit.sha },
      });

      if (!existingCommit) {
        // Get detailed commit info with stats
        const commitDetails = await this.githubService.getDiff(
          owner,
          repoName,
          ghCommit.sha,
          userToken,
        );

        await this.prisma.commits.create({
          data: {
            sha: ghCommit.sha,
            repo_id: repoId,
            author_login: ghCommit.author_login,
            message: ghCommit.message,
            committed_at: ghCommit.committed_at,
            added_lines: commitDetails.stats.additions,
            deleted_lines: commitDetails.stats.deletions,
          },
        });

        // Save commit files
        for (const file of commitDetails.files) {
          await this.prisma.commit_files.create({
            data: {
              commit_sha: ghCommit.sha,
              path: file.filename,
              additions: file.additions,
              deletions: file.deletions,
            },
          });
        }

        // Link commit to tasks based on #N references in message
        if (ghCommit.message) {
          const tasksLinked = await this.linkCommitToTasks(ghCommit.sha, ghCommit.message);
          linkedCount += tasksLinked;
        }

        syncedCount++;
        this.logger.log(`Synced commit: ${ghCommit.sha.substring(0, 7)}`);
      } else {
        // Even for existing commits, try to link if not already linked
        if (existingCommit.message) {
          const tasksLinked = await this.linkCommitToTasks(existingCommit.sha, existingCommit.message);
          linkedCount += tasksLinked;
        }
      }
    }

    this.logger.log(`Synced ${syncedCount} new commits, linked ${linkedCount} task references for ${owner}/${repoName}`);

    return {
      synced: syncedCount,
      linked: linkedCount,
      total: githubCommits.length,
      repoId,
    };
  }

  /**
   * Get commit with its files
   */
  async findOneWithFiles(sha: string) {
    return this.prisma.commits.findUnique({
      where: { sha },
      include: {
        commit_files: true,
        repos: true,
      },
    });
  }

  /**
   * Get diff for a commit from GitHub
   * Uses the app's GitHub token for reliability (user tokens may expire)
   */
  async getDiff(sha: string, _user: any) {
    const commit = await this.prisma.commits.findUnique({
      where: { sha },
      include: { repos: true },
    });

    if (!commit || !commit.repos) {
      throw new NotFoundException('Commit or repository not found');
    }

    // Parse owner/repo from URL
    const match = commit.repos.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new NotFoundException('Invalid GitHub repository URL');
    }

    const [, owner, repoName] = match;

    // Always use app token for diff - it's more reliable than user tokens
    // which can expire. The app token (KEY_GITHUB_TOKEN) has no expiry.
    return this.githubService.getDiff(
      owner,
      repoName.replace('.git', ''),
      sha,
      undefined, // Use app token, not user token
    );
  }
}
