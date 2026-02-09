import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { users } from '@prisma/client';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) { }

  /**
   * Validate if a task's linked commits fulfill the task requirements
   * GET /ai/tasks/:taskId/validate
   */
  @Get('tasks/:taskId/validate')
  async validateTask(
    @Param('taskId') taskId: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.validateTaskCompletion(taskId, user);
  }

  /**
   * Get an AI-generated explanation of a commit
   * GET /ai/commits/:sha/explain
   */
  @Get('commits/:sha/explain')
  async explainCommit(
    @Param('sha') sha: string,
    @Query('onlyCached') onlyCached: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.explainCommit(sha, user, onlyCached === 'true');
  }

  /**
   * Explain a commit in the context of a specific task (Phase 6 - AI Prompt Design)
   * GET /ai/tasks/:taskId/commits/:sha/explain
   *
   * This endpoint provides contextual explanation combining:
   * - Diff del commit
   * - Descripción de la Tarea (#N)
   */
  @Get('tasks/:taskId/commits/:sha/explain')
  async explainCommitInTaskContext(
    @Param('taskId') taskId: string,
    @Param('sha') sha: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.explainCommitInTaskContext(sha, taskId, user);
  }

  /**
   * Analyze code quality and security vulnerabilities for a commit
   * GET /ai/commits/:sha/analyze
   */
  @Get('commits/:sha/analyze')
  async analyzeCommit(
    @Param('sha') sha: string,
    @Query('onlyCached') onlyCached: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.analyzeCode(sha, user, onlyCached === 'true');
  }

  /**
   * Generate a comprehensive task report
   * GET /ai/tasks/:taskId/report
   */
  @Get('tasks/:taskId/report')
  async generateTaskReport(
    @Param('taskId') taskId: string,
    @Query('commitSha') commitSha: string,
    @Query('onlyCached') onlyCached: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.generateTaskReport(taskId, commitSha, user, onlyCached === 'true');
  }
}
