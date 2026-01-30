
import {Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, ParseUUIDPipe} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
//import type { Request } from 'express';
import type { users as User } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';




type AuthedRequest = Request & { user: User };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(dto, user.id);
  }

  @Get('my-tasks')
  async getMyTasks(@CurrentUser() user: User) {
    return this.tasksService.findAllByRole(user);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: User) {
    return this.tasksService.findOneOwned(id, user.id);
  }


  @Roles('manager')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/validate')
  async validateTask(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.validateTask(id, user.id);
  }

  @Get('organization/:organizationId/kanban')
  async getKanbanData(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.getTasksByStatus(organizationId, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.tasksService.findAllByRole(user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('manager')
  async remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
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
}
