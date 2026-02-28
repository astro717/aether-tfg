import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

/**
 * MetricsCronService — Daily snapshot generator for CFD metrics.
 *
 * This service solves the data pipeline gap: the CFD chart reads from
 * `daily_metrics`, but nothing was writing to it automatically.
 *
 * Runs at midnight UTC daily, capturing current task state per org.
 */
@Injectable()
export class MetricsCronService {
  private readonly logger = new Logger(MetricsCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Strips time component → midnight local time.
   */
  private dayFloor(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  /**
   * Generate and upsert a daily_metrics snapshot for a single org.
   */
  async upsertOrgSnapshot(orgId: string, snapshotDate: Date): Promise<void> {
    const tasks = await this.prisma.tasks.findMany({
      where: { organization_id: orgId },
      select: { status: true, created_at: true, updated_at: true },
    });

    let todoCount = 0;
    let inProgressCount = 0;
    let reviewCount = 0;
    let doneCount = 0;

    for (const task of tasks) {
      if (!task.created_at) continue;
      if (task.created_at > snapshotDate) continue;

      const currentStatus = task.status ?? 'todo';
      const updatedAt = this.dayFloor(new Date(task.updated_at));

      // Approximate historical status: if done and was completed after snapshot date,
      // treat as in_progress at that point in time
      let statusAtDay: string;
      if (currentStatus === 'done') {
        statusAtDay = updatedAt <= snapshotDate ? 'done' : 'in_progress';
      } else {
        statusAtDay = currentStatus;
      }

      switch (statusAtDay) {
        case 'done':
          doneCount++;
          break;
        case 'in_progress':
          inProgressCount++;
          break;
        case 'pending_validation':
          reviewCount++;
          break;
        default:
          todoCount++;
          break;
      }
    }

    const totalCount = todoCount + inProgressCount + reviewCount + doneCount;

    await this.prisma.daily_metrics.upsert({
      where: {
        organization_id_date: { organization_id: orgId, date: snapshotDate },
      },
      update: {
        todo_count: todoCount,
        in_progress_count: inProgressCount,
        review_count: reviewCount,
        done_count: doneCount,
        total_count: totalCount,
      },
      create: {
        organization_id: orgId,
        date: snapshotDate,
        todo_count: todoCount,
        in_progress_count: inProgressCount,
        review_count: reviewCount,
        done_count: doneCount,
        total_count: totalCount,
      },
    });

    this.logger.debug(
      `Snapshot ${snapshotDate.toISOString().split('T')[0]} for org ${orgId}: ` +
        `todo=${todoCount} in_progress=${inProgressCount} review=${reviewCount} done=${doneCount}`,
    );
  }

  /**
   * Cron job: runs at midnight UTC daily.
   * Takes a snapshot of all organizations' task states.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyMetricsSnapshot(): Promise<void> {
    this.logger.log('Starting daily metrics snapshot generation...');

    const today = this.dayFloor(new Date());

    const orgs = await this.prisma.organizations.findMany({
      select: { id: true, name: true },
    });

    for (const org of orgs) {
      try {
        await this.upsertOrgSnapshot(org.id, today);
        this.logger.log(`Snapshot completed for org: ${org.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to generate snapshot for org ${org.name}: ${message}`,
        );
      }
    }

    this.logger.log(
      `Daily metrics snapshot complete. Processed ${orgs.length} organization(s).`,
    );
  }

  /**
   * Backfill historical snapshots from a start date to today.
   * Useful for repairing gaps in historical data.
   *
   * @param startDate - The date to start backfilling from
   * @param orgId - Optional: limit to a single organization
   */
  async backfillSnapshots(startDate: Date, orgId?: string): Promise<number> {
    this.logger.log(
      `Starting backfill from ${startDate.toISOString().split('T')[0]}...`,
    );

    const today = this.dayFloor(new Date());
    const start = this.dayFloor(startDate);

    // Get orgs to process
    const orgs = orgId
      ? await this.prisma.organizations.findMany({
          where: { id: orgId },
          select: { id: true, name: true },
        })
      : await this.prisma.organizations.findMany({
          select: { id: true, name: true },
        });

    let snapshotsGenerated = 0;

    for (const org of orgs) {
      // Iterate from start date to today
      const current = new Date(start);
      while (current <= today) {
        try {
          await this.upsertOrgSnapshot(org.id, new Date(current));
          snapshotsGenerated++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Backfill failed for org ${org.name} on ${current.toISOString().split('T')[0]}: ${message}`,
          );
        }
        current.setDate(current.getDate() + 1);
      }
      this.logger.log(`Backfill complete for org: ${org.name}`);
    }

    this.logger.log(
      `Backfill complete. Generated ${snapshotsGenerated} snapshot(s).`,
    );
    return snapshotsGenerated;
  }
}
