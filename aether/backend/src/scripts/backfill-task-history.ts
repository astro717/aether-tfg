/**
 * backfill-task-history.ts — Transparent History Recovery for Event Sourcing Migration
 *
 * Purpose
 * ───────
 * This script populates the `task_history` table with synthetic events derived from
 * existing tasks. It ensures a seamless transition to the Event Sourcing architecture
 * by reconstructing a baseline history that the CFD can immediately visualize.
 *
 * Algorithm
 * ─────────
 * For each existing task in the database:
 *
 * 1. **Event 1 (Creation):** Insert a row with:
 *    - previous_status: null (task was just created)
 *    - new_status: 'todo' (initial state)
 *    - changed_at: task.created_at
 *    - changed_by: task.assignee_id (creator proxy)
 *
 * 2. **Event 2 (Current State):** If task.status !== 'todo', insert a second row:
 *    - previous_status: 'todo'
 *    - new_status: task.status (current state)
 *    - changed_at: task.updated_at
 *    - changed_by: task.assignee_id (actor proxy)
 *
 * Idempotency
 * ───────────
 * Running multiple times is safe: the script checks for existing events per task
 * and skips tasks that already have history records.
 *
 * Usage
 * ─────
 *   npm run backfill:history
 *
 * Run this ONCE before deploying the Event Sourcing rewrite of getDailyMetrics().
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TaskWithTimestamps {
  id: string;
  status: string | null;
  assignee_id: string | null;
  organization_id: string | null;
  created_at: Date | null;
  updated_at: Date;
}

async function main() {
  console.log('🔄 Task History Backfill — Event Sourcing Migration');
  console.log('════════════════════════════════════════════════════\n');

  // Fetch all tasks with relevant fields
  const tasks = await prisma.tasks.findMany({
    select: {
      id: true,
      status: true,
      assignee_id: true,
      organization_id: true,
      created_at: true,
      updated_at: true,
    },
  });

  console.log(`📋 Found ${tasks.length} tasks to process.\n`);

  let created = 0;
  let skipped = 0;
  let eventsInserted = 0;

  for (const task of tasks as TaskWithTimestamps[]) {
    // Check if this task already has history events (idempotency guard)
    const existingEvents = await prisma.task_history.count({
      where: { task_id: task.id },
    });

    if (existingEvents > 0) {
      skipped++;
      continue;
    }

    // Skip tasks without organization_id (B2B requirement)
    if (!task.organization_id) {
      skipped++;
      continue;
    }

    const createdAt = task.created_at ?? new Date();
    const currentStatus = task.status ?? 'todo';

    // Event 1: Task creation (always insert)
    await prisma.task_history.create({
      data: {
        task_id: task.id,
        organization_id: task.organization_id,
        previous_status: null,
        new_status: 'todo',
        changed_by: task.assignee_id,
        changed_at: createdAt,
      },
    });
    eventsInserted++;

    // Event 2: Transition to current state (only if not 'todo')
    if (currentStatus !== 'todo') {
      await prisma.task_history.create({
        data: {
          task_id: task.id,
          organization_id: task.organization_id,
          previous_status: 'todo',
          new_status: currentStatus,
          changed_by: task.assignee_id,
          changed_at: task.updated_at,
        },
      });
      eventsInserted++;
    }

    created++;
  }

  console.log('📊 Results');
  console.log('──────────');
  console.log(`  Tasks processed:  ${created}`);
  console.log(`  Tasks skipped:    ${skipped} (already had history)`);
  console.log(`  Events inserted:  ${eventsInserted}`);

  // Summary stats
  const totalEvents = await prisma.task_history.count();
  console.log(`\n  Total task_history rows: ${totalEvents}`);

  console.log('\n✅ Backfill complete! CFD is now ready for Event Sourcing.');
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
