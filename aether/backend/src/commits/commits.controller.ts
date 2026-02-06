import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { CommitsService } from './commits.service';
import { CreateCommitDto } from './dto/create-commit.dto';
import { UpdateCommitDto } from './dto/update-commit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { users } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Controller('commits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommitsController {
  constructor(
    private readonly commitsService: CommitsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(@Body() dto: CreateCommitDto, @CurrentUser() user: users) {
    return this.commitsService.create(dto, user);
  }

  @Get()
  findAll() {
    return this.commitsService.findAll();
  }

  @Get('repo/:repoId')
  findByRepo(@Param('repoId') repoId: string) {
    return this.commitsService.findByRepo(repoId);
  }

  @Patch(':id')
  update(@Param('sha') sha: string, @Body() dto: UpdateCommitDto, @CurrentUser() user: users) {
    return this.commitsService.update(sha, dto, user);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('sha') sha: string, @CurrentUser() user: users) {
    return this.commitsService.remove(sha, user);
  }

  /**
   * Sync commits from GitHub for a specific repository
   * POST /commits/sync/:repoId
   */
  @Post('sync/:repoId')
  async syncFromGithub(
    @Param('repoId') repoId: string,
    @CurrentUser() user: users,
    @Query('maxCommits') maxCommits?: string,
  ) {
    // Get repo to extract owner/name from URL
    const repo = await this.prisma.repos.findUnique({
      where: { id: repoId },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    // Parse owner/repo from GitHub URL
    const match = repo.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new NotFoundException('Invalid GitHub repository URL');
    }

    const [, owner, repoName] = match;

    return this.commitsService.syncFromGithub(
      repoId,
      owner,
      repoName.replace('.git', ''),
      user,
      { maxCommits: maxCommits ? parseInt(maxCommits, 10) : 50 },
    );
  }

  /**
   * Get commit with files
   * GET /commits/:sha/details
   */
  @Get(':sha/details')
  findOneWithFiles(@Param('sha') sha: string) {
    return this.commitsService.findOneWithFiles(sha);
  }

  /**
   * Get diff for a specific commit from GitHub
   * GET /commits/:sha/diff
   */
  @Get(':sha/diff')
  getDiff(@Param('sha') sha: string, @CurrentUser() user: users) {
    return this.commitsService.getDiff(sha, user);
  }
}
