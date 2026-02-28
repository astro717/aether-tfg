
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TasksService } from './tasks.service';
import { MetricsCronService } from './metrics-cron.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LinkCommitDto } from './dto/link-commit.dto';
//import type { Request } from 'express';
import type { users as User } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';




type AuthedRequest = Request & { user: User };

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly metricsCronService: MetricsCronService,
  ) { }

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(dto, user);
  }

  @Get('my-tasks')
  async getMyTasks(@CurrentUser() user: User) {
    // Always returns only tasks assigned to this user (for sidebar)
    return this.tasksService.findMyTasks(user.id);
  }

  @Get('my-pulse')
  async getMyPulse(@CurrentUser() user: User) {
    return this.tasksService.getMyPulse(user.id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: User) {
    // Managers can view any task, regular users only their own
    return this.tasksService.findOneOwned(id, user.id, user.role);
  }


  @Post(':id/validate')
  async validateTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.validateTask(id, user.id);
  }

  @Post(':id/reject')
  async rejectTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: User,
  ) {
    return this.tasksService.rejectTask(id, user.id, body.reason);
  }

  @Get('organization/:organizationId/pending-validation')
  async getPendingValidationTasks(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.getPendingValidationTasks(organizationId, user.id);
  }

  @Get('organization/:organizationId/kanban')
  async getKanbanData(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.getTasksByStatus(organizationId, user.userId);
  }

  @Get('organization/:organizationId/analytics')
  async getAnalytics(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query('period') period: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.getAnalytics(organizationId, user.id, period);
  }

  @Get('organization/:organizationId/cfd')
  async getCFD(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Query('range') range: string = '30d',
    @CurrentUser() user: User,
  ) {
    return this.tasksService.getDailyMetrics(organizationId, range);
  }

  @UseGuards(RolesGuard)
  @Roles('"manager"', '"admin"')
  @Post('organization/:organizationId/metrics/backfill')
  async backfillMetrics(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() body: { startDate?: string },
    @CurrentUser() user: User,
  ) {
    // Default to 30 days ago if no start date provided
    const startDate = body.startDate
      ? new Date(body.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const count = await this.metricsCronService.backfillSnapshots(
      startDate,
      organizationId,
    );

    return {
      success: true,
      message: `Backfill complete. Generated ${count} snapshot(s).`,
      snapshotsGenerated: count,
    };
  }

  @Get('organization/:organizationId/daily-pulse')
  async getDailyPulse(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.getDailyPulse(organizationId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.tasksService.findAllByRole(user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  // Archive endpoints
  @Patch(':id/archive')
  async archiveTask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.archiveTask(id, user.id, user.role);
  }

  @Post('organization/:organizationId/archive-done')
  async archiveAllDone(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.archiveAllDone(organizationId, user.id, user.role);
  }

  // Comment endpoints
  @Get(':id/comments')
  async getComments(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tasksService.getComments(id);
  }

  @Post(':id/comments')
  async addComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.addComment(id, user.id, dto.content);
  }

  @Delete('comments/:commentId')
  async deleteComment(
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.deleteComment(commentId, user.id, user.role);
  }

  // Link commit to task
  @Post(':id/commits')
  async linkCommit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: LinkCommitDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.linkCommit(id, dto.commit_sha, user.id, user.role);
  }
}
