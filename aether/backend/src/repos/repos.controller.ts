import { Controller, Get, Post, Body, Param, Delete, Patch, Query, NotFoundException } from '@nestjs/common';
import { ReposService } from './repos.service';
import { CreateRepoDto } from './dto/create-repo.dto';
import { UpdateRepoDto } from './dto/update-repo.dto';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { users } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CommitsService } from '../commits/commits.service';

@Controller('repos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReposController {
  constructor(
    private readonly reposService: ReposService,
    private readonly commitsService: CommitsService,
  ) {}

  @Post()
  @Roles('manager')
  create(@Body() dto: CreateRepoDto, @CurrentUser() user: users) {
    return this.reposService.create(dto, user);
  }

  @Get()
  findAll() {
    return this.reposService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reposService.findOne(id);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') id: string, @Body() dto: UpdateRepoDto, @CurrentUser() user: users) {
    return this.reposService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') id: string, @CurrentUser() user: users) {
    return this.reposService.remove(id, user);
  }

  /**
   * Sync repositories from GitHub
   * POST /repos/sync
   */
  @Post('sync')
  syncFromGithub(
    @CurrentUser() user: users,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.reposService.syncFromGithub(user, organizationId);
  }

  /**
   * Sync commits from GitHub for a specific repository
   * POST /repos/:id/sync-commits
   *
   * This fetches commits and their diffs from GitHub and stores them in the database.
   * The diff data is critical for AI analysis.
   */
  @Post(':id/sync-commits')
  async syncCommits(
    @Param('id') repoId: string,
    @CurrentUser() user: users,
    @Query('maxCommits') maxCommits?: string,
  ) {
    // Get repo to extract owner/name from URL
    const repo = await this.reposService.findOne(repoId);

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    // Parse owner/repo from GitHub URL
    const parsed = this.reposService.parseGithubUrl(repo.url);
    if (!parsed) {
      throw new NotFoundException('Invalid GitHub repository URL');
    }

    return this.commitsService.syncFromGithub(
      repoId,
      parsed.owner,
      parsed.repo,
      user,
      { maxCommits: maxCommits ? parseInt(maxCommits, 10) : 50 },
    );
  }
}
