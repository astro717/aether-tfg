import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards } from '@nestjs/common';
import { CommitsService } from './commits.service';
import { CreateCommitDto } from './dto/create-commit.dto';
import { UpdateCommitDto } from './dto/update-commit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { users } from '@prisma/client';

@Controller('commits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommitsController {
  constructor(private readonly commitsService: CommitsService) {}

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
}
