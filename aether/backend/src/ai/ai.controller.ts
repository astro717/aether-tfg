import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
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
   *
   * Supports caching indexed by (task_id, commit_sha)
   * Query params:
   *   - onlyCached=true: only retrieve cached results (404 if not cached)
   *   - forceRegenerate=true: bypass cache and generate fresh (for regeneration)
   *   - language: output language code (en, es, fr, de, pt, zh, ja)
   *   - depth: analysis depth (concise, standard, detailed)
   */
  @Get('tasks/:taskId/commits/:sha/explain')
  async explainCommitInTaskContext(
    @Param('taskId') taskId: string,
    @Param('sha') sha: string,
    @Query('onlyCached') onlyCached: string,
    @Query('forceRegenerate') forceRegenerate: string,
    @Query('language') language: string,
    @Query('depth') depth: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.explainCommitInTaskContext(
      sha,
      taskId,
      user,
      onlyCached === 'true',
      forceRegenerate === 'true',
      language || 'en',
      depth || 'standard',
    );
  }

  /**
   * Analyze code quality and security vulnerabilities for a commit
   * GET /ai/commits/:sha/analyze
   *
   * Query params:
   *   - onlyCached=true: only retrieve cached results (404 if not cached)
   *   - forceRegenerate=true: bypass cache and generate fresh (deletes old reports)
   *   - language: output language code (en, es, fr, de, pt, zh, ja)
   *   - depth: analysis depth (concise, standard, detailed)
   */
  @Get('commits/:sha/analyze')
  async analyzeCommit(
    @Param('sha') sha: string,
    @Query('onlyCached') onlyCached: string,
    @Query('forceRegenerate') forceRegenerate: string,
    @Query('language') language: string,
    @Query('depth') depth: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.analyzeCode(sha, user, onlyCached === 'true', forceRegenerate === 'true', language || 'en', depth || 'standard');
  }

  /**
   * Generate a comprehensive task report
   * GET /ai/tasks/:taskId/report
   *
   * Query params:
   *   - commitSha: Required commit SHA to scope the report
   *   - onlyCached=true: only retrieve cached results (404 if not cached)
   *   - forceRegenerate=true: bypass cache, delete old reports, and generate fresh
   *                           This fixes the "ghost regeneration" bug
   */
  @Get('tasks/:taskId/report')
  async generateTaskReport(
    @Param('taskId') taskId: string,
    @Query('commitSha') commitSha: string,
    @Query('onlyCached') onlyCached: string,
    @Query('forceRegenerate') forceRegenerate: string,
    @CurrentUser() user: users,
  ) {
    return this.aiService.generateTaskReport(
      taskId,
      commitSha,
      user,
      onlyCached === 'true',
      forceRegenerate === 'true',
    );
  }

  /**
   * Generate an AI-powered manager report
   * POST /ai/manager-report
   *
   * Body:
   *   - type: 'weekly_organization' | 'user_performance' | 'bottleneck_prediction'
   *   - organizationId: UUID of the organization
   *   - userId?: Optional user ID for user_performance reports
   *   - period: Period identifier (e.g., 'YYYY-W##' for weeks, 'YYYY-MM-DD:YYYY-MM-DD' for ranges)
   *   - forceRegenerate?: Force new report generation, bypassing cache
   */
  @Post('manager-report')
  async generateManagerReport(
    @Body() body: {
      type: string;
      organizationId: string;
      userId?: string;
      period: string;
      forceRegenerate?: boolean;
    },
    @CurrentUser() user: users,
  ) {
    return this.aiService.generateManagerReport(
      body.type,
      body.organizationId,
      body.userId,
      user,
      body.period,
      body.forceRegenerate || false,
    );
  }

  /**
   * Check availability of existing manager reports
   * GET /ai/manager-report/availability
   *
   * Query params:
   *   - organizationId: UUID of the organization
   *   - period: Period identifier
   */
  @Get('manager-report/availability')
  async checkManagerReportAvailability(
    @Query('organizationId') organizationId: string,
    @Query('period') period: string,
    @CurrentUser() user: users,
  ) {
    // Verify user is manager in this organization
    const userOrg = await this.aiService['prisma'].user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: user.id,
          organization_id: organizationId,
        },
      },
    });

    const role = userOrg?.role_in_org;
    if (!userOrg || (role !== 'admin' && role !== 'manager')) {
      return { available: [] };
    }

    // Find all existing reports for this org and period
    const reports = await this.aiService['prisma'].ai_reports.findMany({
      where: {
        organization_id: organizationId,
        type: {
          startsWith: 'manager_',
        },
      },
      select: {
        type: true,
        metadata: true,
        created_at: true,
      },
    });

    // Filter by period and format response
    const available = reports
      .filter(r => {
        if (!r.metadata || !r.type) return false;
        const metadata = r.metadata as { period?: string; target_user_id?: string };
        return metadata.period === period;
      })
      .map(r => {
        const metadata = r.metadata as { period?: string; target_user_id?: string };
        return {
          type: r.type!.replace('manager_', ''),
          userId: metadata.target_user_id || null,
          createdAt: r.created_at,
        };
      });

    return { available };
  }
}
