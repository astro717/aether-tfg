/**
 * seed-additive.ts — NON-DESTRUCTIVE drip seeder for daily_metrics.
 *
 * Design goals
 * ────────────
 * • Each run inserts a small batch of NEW "todo" tasks (mimicking a real org where
 *   work items trickle in daily), then refreshes today's daily_metrics snapshot.
 * • Tasks are distributed across ALL members of the organisation.
 * • Every task gets a due_date (1–21 days after creation).
 * • Fully idempotent for daily_metrics (upsert); tasks are always new UUIDs.
 *
 * First-time / historical bootstrap
 * ──────────────────────────────────
 * Pass --bootstrap to also insert historical tasks (various statuses, last 30 days)
 * and regenerate the full 31-day daily_metrics history:
 *
 *   npm run seed:additive -- --bootstrap
 *
 * Normal drip (run daily / on demand):
 *
 *   npm run seed:additive
 *
 * Algorithm (drip mode)
 * ─────────────────────
 * 1. Find org + all its members.
 * 2. Insert DRIP_COUNT (2–4) todo tasks via raw SQL (sets created_at/updated_at/due_date freely).
 * 3. Recompute today's daily_metrics snapshot from ALL org tasks and upsert it.
 *
 * Algorithm (bootstrap mode)
 * ──────────────────────────
 * 1–2. Same as drip but inserts BOOTSTRAP_COUNT tasks with historical dates & mixed statuses.
 * 3. Recompute ALL 31 daily snapshots.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Generate a random UUID v4 */
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate a 6-character uppercase alphanumeric hash */
function generateHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const DAYS_BACK = 30;
const BOOTSTRAP_COUNT = 50;
const DRIP_MIN = 2;
const DRIP_MAX = 4;

// Bootstrap status distribution: 40% done, 30% in_progress, 20% todo, 10% pending_validation
const BOOTSTRAP_STATUS_POOL: string[] = [
  ...Array(20).fill('done'),
  ...Array(15).fill('in_progress'),
  ...Array(10).fill('todo'),
  ...Array(5).fill('pending_validation'),
];

const TASK_TITLES = [
  'Implement user authentication flow',
  'Fix memory leak in event loop',
  'Add unit tests for payment service',
  'Refactor database connection pool',
  'Update API documentation',
  'Review and merge PR from feature branch',
  'Deploy v2.1 to staging environment',
  'Investigate intermittent 502 errors',
  'Optimise slow query on reports endpoint',
  'Set up CI/CD pipeline for mobile app',
  'Migrate user data to new schema',
  'Add dark mode support to dashboard',
  'Implement real-time notifications',
  'Fix XSS vulnerability in comment form',
  'Write E2E tests for checkout flow',
  'Integrate Stripe webhook handler',
  'Sync GitHub commits with task tracker',
  'Analyse DORA metrics for Q1',
  'Upgrade dependencies to latest minor',
  'Create onboarding email sequence',
  'Add rate limiting to public API',
  'Set up error monitoring with Sentry',
  'Refactor authentication middleware',
  'Implement CSV export for reports',
  'Add pagination to activity feed',
  'Write runbook for incident response',
  'Profile and optimise bundle size',
  'Create admin user management panel',
  'Add two-factor authentication support',
  'Document REST API with OpenAPI spec',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a Date that is `n` days ago, with a random working-hours time. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randomInt(8, 18), randomInt(0, 59), randomInt(0, 59), 0);
  return d;
}

/** Strips time component → midnight UTC. */
function dayFloor(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Pick a pseudo-random title that won't collide easily. */
function pickTitle(index: number, suffix: string): string {
  return TASK_TITLES[index % TASK_TITLES.length] + ` ${suffix}`;
}

// ── Org / member lookup ───────────────────────────────────────────────────────

async function resolveContext() {
  const org = await prisma.organizations.findFirst({
    orderBy: { created_at: 'asc' },
  });
  if (!org) throw new Error('No organisation found. Create one via the app first.');
  // Get task_prefix from org or derive from name
  const prefix = (org as any).task_prefix || org.name.substring(0, 3).toUpperCase();
  console.log(`  → Organisation: "${org.name}" (${org.id}), prefix: ${prefix}`);

  const memberships = await prisma.user_organizations.findMany({
    where: { organization_id: org.id },
    include: { users: { select: { id: true, username: true } } },
  });
  if (memberships.length === 0) {
    throw new Error('No members found in organisation. Add at least one member first.');
  }

  const members = memberships.map((m) => ({
    id: m.user_id,
    username: m.users.username,
  }));
  console.log(`  → Members (${members.length}): ${members.map((m) => m.username).join(', ')}`);

  return { org, members, prefix };
}

// ── Raw-SQL task insertion ────────────────────────────────────────────────────

interface TaskSpec {
  status: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  assigneeId: string;
  validatedById: string | null;
  title: string;
  readableId: string;
}

async function insertTask(orgId: string, spec: TaskSpec): Promise<void> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO tasks (
      id, organization_id, title, status,
      assignee_id, validated_by,
      due_date,
      created_at, updated_at,
      readable_id
    ) VALUES (
      ${id}::uuid,
      ${orgId}::uuid,
      ${spec.title},
      ${spec.status},
      ${spec.assigneeId}::uuid,
      ${spec.validatedById}::uuid,
      ${spec.dueDate},
      ${spec.createdAt},
      ${spec.updatedAt},
      ${spec.readableId}
    )
    ON CONFLICT DO NOTHING
  `;
}

// ── daily_metrics snapshot ────────────────────────────────────────────────────

async function upsertSnapshot(orgId: string, snapshotDay: Date, allTasks: Array<{
  status: string | null;
  created_at: Date | null;
  updated_at: Date;
}>): Promise<void> {
  let todoCount = 0;
  let inProgressCount = 0;
  let reviewCount = 0;
  let doneCount = 0;

  for (const task of allTasks) {
    if (!task.created_at) continue;
    const createdAt = new Date(task.created_at);
    if (createdAt > snapshotDay) continue;

    const currentStatus = task.status ?? 'todo';
    const updatedAt = dayFloor(new Date(task.updated_at));

    let statusAtDay: string;
    if (currentStatus === 'done') {
      statusAtDay = updatedAt <= snapshotDay ? 'done' : 'in_progress';
    } else {
      statusAtDay = currentStatus;
    }

    switch (statusAtDay) {
      case 'done':               doneCount++;       break;
      case 'in_progress':        inProgressCount++; break;
      case 'pending_validation': reviewCount++;     break;
      default:                   todoCount++;       break;
    }
  }

  const totalCount = todoCount + inProgressCount + reviewCount + doneCount;

  await prisma.daily_metrics.upsert({
    where: { organization_id_date: { organization_id: orgId, date: snapshotDay } },
    update:  { todo_count: todoCount, in_progress_count: inProgressCount, review_count: reviewCount, done_count: doneCount, total_count: totalCount },
    create:  { organization_id: orgId, date: snapshotDay, todo_count: todoCount, in_progress_count: inProgressCount, review_count: reviewCount, done_count: doneCount, total_count: totalCount },
  });

  const label = snapshotDay.toISOString().split('T')[0];
  console.log(`  ${label}  todo=${todoCount}  in_progress=${inProgressCount}  review=${reviewCount}  done=${doneCount}  total=${totalCount}`);
}

// ── Bootstrap mode ────────────────────────────────────────────────────────────

async function runBootstrap(orgId: string, members: Array<{ id: string; username: string }>, prefix: string) {
  console.log(`\n📦 Bootstrap: inserting ${BOOTSTRAP_COUNT} historical tasks…`);

  const nano = Date.now() % 100000; // cheap uniquifier

  // Cycle time distribution: realistic variation (1, 2, 3, 5, 8, 13, 20 days)
  const CYCLE_TIME_POOL = [1, 1, 2, 2, 2, 3, 3, 3, 5, 5, 8, 8, 13, 20];

  for (let i = 0; i < BOOTSTRAP_COUNT; i++) {
    const status = BOOTSTRAP_STATUS_POOL[i % BOOTSTRAP_STATUS_POOL.length];

    let createdAt: Date;
    let updatedAt: Date;

    if (status === 'done') {
      // For done tasks: spread completion dates across the full 30-day range
      // This ensures different periods capture different subsets of completions
      const completedDaysAgo = randomInt(0, DAYS_BACK); // 0-30 days ago
      const cycleTime = CYCLE_TIME_POOL[randomInt(0, CYCLE_TIME_POOL.length - 1)];
      const createdDaysAgo = completedDaysAgo + cycleTime;

      createdAt = daysAgo(createdDaysAgo);
      updatedAt = daysAgo(completedDaysAgo);
    } else {
      // For non-done tasks: created 1-30 days ago, updated shortly after creation
      const createdDaysAgo = randomInt(1, DAYS_BACK);
      createdAt = daysAgo(createdDaysAgo);
      updatedAt = new Date(createdAt.getTime() + randomInt(0, 3600) * 1000);
    }

    // Due date: 3–21 days after creation (may be in the past for overdue tasks)
    const dueDaysAfterCreation = randomInt(3, 21);
    const dueDate = new Date(createdAt.getTime() + dueDaysAfterCreation * 86_400_000);

    // Round-robin across members
    const assignee = members[i % members.length];
    const validatedById = status !== 'pending_validation' ? assignee.id : null;

    // Generate premium readable_id (e.g., AET-3M2KV9)
    const readableId = `${prefix}-${generateHash()}`;

    await insertTask(orgId, {
      status,
      createdAt,
      updatedAt,
      dueDate,
      assigneeId: assignee.id,
      validatedById,
      title: pickTitle(i, `#B${nano + i}`),
      readableId,
    });
  }
  console.log(`  ✓ Historical tasks inserted.`);

  // Rebuild full 31-day snapshot history
  const allTasks = await prisma.tasks.findMany({
    where: { organization_id: orgId },
    select: { status: true, created_at: true, updated_at: true },
  });
  console.log(`  Total tasks in org: ${allTasks.length}`);
  console.log(`\n📅 Generating ${DAYS_BACK + 1} daily snapshots…`);

  for (let d = DAYS_BACK; d >= 0; d--) {
    await upsertSnapshot(orgId, dayFloor(daysAgo(d)), allTasks);
  }
}

// ── Drip mode ─────────────────────────────────────────────────────────────────

async function runDrip(orgId: string, members: Array<{ id: string; username: string }>, prefix: string) {
  const count = randomInt(DRIP_MIN, DRIP_MAX);
  console.log(`\n💧 Drip: inserting ${count} new todo task(s)…`);

  const now = new Date();
  const nano = Date.now() % 100000;

  for (let i = 0; i < count; i++) {
    // Created in the last few minutes to "right now"
    const createdAt = new Date(now.getTime() - randomInt(0, 30) * 60_000);
    const updatedAt = new Date(createdAt.getTime() + randomInt(10, 120) * 1000);

    // Due date: 5–14 working days from today
    const dueDate = new Date(now.getTime() + randomInt(5, 14) * 86_400_000);

    // Distribute across members
    const assignee = members[(i + randomInt(0, members.length - 1)) % members.length];

    // Generate premium readable_id (e.g., AET-3M2KV9)
    const readableId = `${prefix}-${generateHash()}`;

    await insertTask(orgId, {
      status: 'todo',
      createdAt,
      updatedAt,
      dueDate,
      assigneeId: assignee.id,
      validatedById: null,
      title: pickTitle(i + count, `#D${nano + i}`),
      readableId,
    });

    console.log(`  ✓ "${TASK_TITLES[(i + count) % TASK_TITLES.length]}" → ${assignee.username} (due ${dueDate.toISOString().split('T')[0]})`);
  }

  // Refresh today's snapshot only
  const allTasks = await prisma.tasks.findMany({
    where: { organization_id: orgId },
    select: { status: true, created_at: true, updated_at: true },
  });
  console.log(`\n📅 Refreshing today's snapshot (org total: ${allTasks.length} tasks)…`);
  await upsertSnapshot(orgId, dayFloor(new Date()), allTasks);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const isBootstrap = process.argv.includes('--bootstrap');
  console.log(`🌱 Aether Additive Seeder — ${isBootstrap ? 'BOOTSTRAP' : 'drip'} mode`);

  const { org, members, prefix } = await resolveContext();

  if (isBootstrap) {
    await runBootstrap(org.id, members, prefix);
  } else {
    await runDrip(org.id, members, prefix);
  }

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
