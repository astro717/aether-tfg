/**
 * kanban-heartbeat.ts — The Monopoly Kanban Auto-Population Engine
 *
 * Purpose
 * ───────
 * This script runs endlessly (or via cron/pm2) to inject "artificial life" into the 
 * Kanban board of the 'developer' organization. It prevents the CFD and performance 
 * graphs from flatlining by randomly simulating the creation of new 'todo' tasks.
 *
 * It uses Math.random() heavily to prevent obvious geometric patterns in the analytics.
 * 
 * Usage
 * ─────
 *   npx ts-node src/scripts/kanban-heartbeat.ts
 * 
 * To run in the background endlessly:
 *   pm2 start src/scripts/kanban-heartbeat.ts --name kanban-heartbeat --interpreter npx -- interpreter-args "ts-node"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The target organization name
const TARGET_ORG_NAME = 'Test Organization';

// Realistic Dev Task Titles
const TASK_TITLES = [
    // Frontend — UI & UX
    'Implement dark mode toggle with system preference sync',
    'Add skeleton loading states to analytics dashboard',
    'Fix iOS Safari flex layout bug in mobile nav',
    'Refactor Redux store slices to Zustand',
    'Improve keyboard navigation for modal dialogs',
    'Add drag-and-drop reordering to Kanban board',
    'Implement virtualized list for large task feeds',
    'Fix cumulative layout shift on landing page',
    'Add ARIA labels and roles to chart components',
    'Migrate Storybook configuration to v8',
    'Implement infinite scroll on activity feed',
    'Fix date picker timezone offset in task form',
    'Add confetti animation on task completion',
    'Refactor sidebar navigation to use Radix UI',
    'Implement collapsible sidebar with persist state',
    'Add empty-state illustrations to all list views',
    'Fix avatar image fallback initials logic',
    'Implement command palette with keyboard shortcut',
    'Add tooltip to all icon-only buttons',
    'Optimize Framer Motion animations for low-end devices',
    // Frontend — Performance & Architecture
    'Lazy load dashboard chart components on demand',
    'Optimize bundle size with tree shaking audit',
    'Split vendor chunk for faster initial load',
    'Implement React Suspense boundaries for data fetching',
    'Add service worker for offline task browsing',
    'Fix memory leak in WebSocket message listener',
    'Migrate legacy CSS modules to Tailwind utility classes',
    'Implement code splitting for manager and member routes',
    'Add Content Security Policy meta tags',
    'Profile and fix re-renders in TaskCard component',
    // Backend — Features
    'Draft API documentation for v2 REST endpoints',
    'Implement rate limiting on public API endpoints',
    'Add soft delete support for archived tasks',
    'Implement webhook delivery system for integrations',
    'Build full-text search index on task titles',
    'Add bulk status update endpoint for tasks',
    'Implement CSV export for analytics reports',
    'Create PDF report generation for sprint summaries',
    'Add custom fields schema to task model',
    'Build task template system for recurring work',
    'Implement notification preferences API',
    'Add Slack webhook integration for task events',
    'Build time tracking entry endpoint',
    'Implement task dependency graph resolver',
    'Add priority field to task model and endpoints',
    // Backend — Performance & Reliability
    'Add Redis caching layer for analytics queries',
    'Implement database connection pooling via pgBouncer',
    'Fix N+1 query in paginated task list endpoint',
    'Add database index on assignee_id and status columns',
    'Implement API response compression middleware',
    'Optimize CFD query with materialized view',
    'Add request timeout and circuit breaker middleware',
    'Write migration for user notification preferences',
    'Implement idempotency keys for task creation API',
    'Add query result pagination cursor support',
    // Backend — Security & Auth
    'Rotate service account API keys and secrets',
    'Implement CSRF protection on mutation endpoints',
    'Add Content-Security-Policy response headers',
    'Audit and tighten OAuth2 scope definitions',
    'Implement refresh token rotation with revocation',
    'Add IP allowlist for admin API routes',
    'Enable row-level security on organization tables',
    // DevOps & Infrastructure
    'Configure GitHub Actions matrix CI pipeline',
    'Set up staging environment on Fly.io',
    'Add health check and readiness probe endpoint',
    'Configure Sentry source maps upload in build',
    'Set up structured log aggregation with Datadog',
    'Implement blue-green zero-downtime deployment',
    'Configure CDN caching rules for static assets',
    'Add database backup verification job',
    'Set up Dependabot for automated dependency PRs',
    'Configure alerting on p99 latency threshold',
    // Testing
    'Write unit tests for task status machine',
    'Add integration tests for organization auth flow',
    'Set up Playwright E2E suite for critical paths',
    'Fix flaky test in payment webhook handler',
    'Add snapshot tests for analytics chart components',
    'Implement visual regression testing with Percy',
    'Write load tests for analytics endpoint',
    'Add contract tests for external API integrations',
    // Maintenance & Refactoring
    'Remove deprecated v1 API endpoints',
    'Update Prisma to latest minor version',
    'Refactor error handling to use typed Result pattern',
    'Clean up unused npm dependencies',
    'Standardize API response envelope format',
    'Migrate date utilities from moment.js to date-fns',
    'Refactor authentication middleware for testability',
    'Extract shared validation logic into reusable guards',
    'Update React dependencies to latest stable version',
    'Audit and resolve all TypeScript strict mode errors',
];

const TASK_DESCRIPTIONS = [
    'As requested in the last sprint planning. Needs to be done carefully to avoid breaking existing clients.',
    'Found this issue while reviewing Datadog logs. Priority is high.',
    'Standard technical debt cleanup.',
    'User complained about this on Twitter. Let\'s fix it before it scales.',
    'This is a stepping stone for the upcoming Monopoly feature release.',
    '' // Sometimes no description
];

// Utility to pick a random item from an array
const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Utility for sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Random integer between min and max (inclusive)
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate a random ID suffix (e.g., "TASK-A94D")
const generateReadableId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'T-';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

async function main() {
    console.log(`\n💓 Starting Kanban Heartbeat for organization: '${TARGET_ORG_NAME}'`);

    // 1. Find the target organization
    const org = await prisma.organizations.findFirst({
        where: { name: TARGET_ORG_NAME }
    });

    if (!org) {
        console.error(`❌ Organization '${TARGET_ORG_NAME}' not found in database. Exiting.`);
        process.exit(1);
    }

    // 2. Get members of this organization to assign tasks randomly
    const members = await prisma.user_organizations.findMany({
        where: { organization_id: org.id },
        include: { users: true }
    });

    if (members.length === 0) {
        console.error(`❌ No members found in organization '${TARGET_ORG_NAME}'. Exiting.`);
        process.exit(1);
    }

    const memberIds = members.map(m => m.user_id);

    console.log(`✅ Loaded ${memberIds.length} members. Engine is ready.\n`);

    // Infinite heartbeat loop
    while (true) {
        try {
            // Create between 1 and 3 tasks per cycle
            const tasksToCreate = randomInt(1, 3);
            console.log(`[${new Date().toISOString()}] Awaking... Creating ${tasksToCreate} new task(s).`);

            for (let i = 0; i < tasksToCreate; i++) {
                const title = sample(TASK_TITLES);
                const description = sample(TASK_DESCRIPTIONS);
                const assignee = sample(memberIds);

                // Randomize due date: Between 3 and 14 days in the future
                const daysOffset = randomInt(3, 14);
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + daysOffset);

                // Generate a random readable ID (Ensuring it doesn't collide, handled by DB unique constraint ideally, but keeping it simple)
                // Aether uses readable_ids like "DEV-123". We'll just generate random ones.
                const readableId = `${org.name.substring(0, 3).toUpperCase()}-${randomInt(1000, 9999)}`;

                // We use a transaction or just catch the unique constraint error if it collides
                const newTask = await prisma.tasks.create({
                    data: {
                        readable_id: readableId,
                        organization_id: org.id,
                        title: title + (randomInt(0, 10) > 8 ? ' (Auto)' : ''), // Tag some so you know they are fake easily
                        description: description,
                        status: 'todo', // Always start as todo
                        assignee_id: assignee,
                        due_date: dueDate,
                    }
                });

                // Event Sourcing hook: Aether CFD relies on task_history! We MUST log the creation event!
                await prisma.task_history.create({
                    data: {
                        task_id: newTask.id,
                        organization_id: org.id,
                        previous_status: null,
                        new_status: 'todo',
                        changed_by: assignee,
                    }
                });

                console.log(`  ➕ Injected task: ${newTask.readable_id} -> ${title}`);
            }

        } catch (error) {
            console.error('⚠️ Collision or error during creation, skipping cycle:', error);
        }

        // Hibernate for a random amount of time to make graphs look natural
        // Between 1 hour (3600000 ms) and 6 hours (21600000 ms)
        // For testing purposes, you might want to lower this. Let's set it to 10 - 45 minutes for noticeable pulse.
        const sleepMinutes = randomInt(15, 60);
        console.log(`💤 Pulses injected. Engine hibernating for ${sleepMinutes} minutes...\n`);
        await sleep(sleepMinutes * 60 * 1000);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
