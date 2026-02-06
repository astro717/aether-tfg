import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRepoDto } from './dto/create-repo.dto';
import { UpdateRepoDto } from './dto/update-repo.dto';
import { GithubService, GithubRepository } from '../github/github.service';

@Injectable()
export class ReposService {
  private readonly logger = new Logger(ReposService.name);

  constructor(
    private prisma: PrismaService,
    private githubService: GithubService,
  ) {}

  async create(dto: CreateRepoDto, creator: any) {
    if (creator.role !== 'manager') {
      throw new ForbiddenException('Only managers can create repos');
    }

    return this.prisma.repos.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        url: dto.url,
        organization_id: dto.organization_id,
      },
    });
  }

  async findAll() {
    return this.prisma.repos.findMany();
  }

  async findOne(id: string) {
    const repo = await this.prisma.repos.findUnique({
      where: { id },
    });
    if (!repo) throw new NotFoundException('Repo not found');
    return repo;
  }

  async update(id: string, dto: UpdateRepoDto, user: any) {
    if (user.role !== 'manager') throw new ForbiddenException('Only managers can edit repos');

    return this.prisma.repos.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, user: any) {
    if (user.role !== 'manager') throw new ForbiddenException('Only managers can delete repos');

    return this.prisma.repos.delete({ where: { id } });
  }

  /**
   * Sync repositories from GitHub for a user
   * Uses the user's GitHub access token if available, otherwise falls back to system token
   */
  async syncFromGithub(user: any, organizationId?: string) {
    const userToken = user.github_access_token || undefined;

    this.logger.log(`Syncing GitHub repos for user ${user.username}`);

    const githubRepos = await this.githubService.getRepositories(userToken);

    const syncedRepos: GithubRepository[] = [];

    for (const ghRepo of githubRepos) {
      // Upsert: create or update repo based on URL (unique identifier)
      const existingRepo = await this.prisma.repos.findFirst({
        where: { url: ghRepo.url },
      });

      if (existingRepo) {
        // Update existing repo
        await this.prisma.repos.update({
          where: { id: existingRepo.id },
          data: {
            name: ghRepo.name,
            provider: 'github',
            url: ghRepo.url,
          },
        });
        this.logger.log(`Updated repo: ${ghRepo.full_name}`);
      } else {
        // Create new repo
        await this.prisma.repos.create({
          data: {
            name: ghRepo.full_name,
            provider: 'github',
            url: ghRepo.url,
            organization_id: organizationId || null,
          },
        });
        this.logger.log(`Created repo: ${ghRepo.full_name}`);
      }

      syncedRepos.push(ghRepo);
    }

    this.logger.log(`Synced ${syncedRepos.length} repos from GitHub`);

    return {
      synced: syncedRepos.length,
      repos: syncedRepos,
    };
  }

  /**
   * Get repository by URL
   */
  async findByUrl(url: string) {
    return this.prisma.repos.findFirst({
      where: { url },
    });
  }

  /**
   * Parse owner and repo name from GitHub URL
   */
  parseGithubUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
    return null;
  }
}
