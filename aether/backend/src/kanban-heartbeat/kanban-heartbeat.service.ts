import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

const TARGET_ORG_NAME = 'Test Organization';

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
    "User complained about this on Twitter. Let's fix it before it scales.",
    'This is a stepping stone for the upcoming feature release.',
    '',
];

const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class KanbanHeartbeatService implements OnModuleInit {
    private readonly logger = new Logger(KanbanHeartbeatService.name);
    private orgId: string | null = null;
    private memberIds: string[] = [];
    private orgPrefix: string = 'TES';
    private nextFireAt: number = 0;

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        const org = await this.prisma.organizations.findFirst({
            where: { name: TARGET_ORG_NAME },
        });

        if (!org) {
            this.logger.warn(`Organization '${TARGET_ORG_NAME}' not found — heartbeat disabled.`);
            return;
        }

        const members = await this.prisma.user_organizations.findMany({
            where: { organization_id: org.id },
        });

        if (members.length === 0) {
            this.logger.warn(`No members in '${TARGET_ORG_NAME}' — heartbeat disabled.`);
            return;
        }

        this.orgId = org.id;
        this.orgPrefix = org.name.substring(0, 3).toUpperCase();
        this.memberIds = members.map((m) => m.user_id);
        this.nextFireAt = Date.now(); // inject one task immediately on startup
        this.logger.log(`💓 Kanban Heartbeat ready — ${this.memberIds.length} members loaded.`);
    }

    // Checks every hour whether it's time to inject a task.
    // Actual injection happens every 1–4 days (randomized).
    @Interval(60 * 60 * 1000)
    async tick() {
        if (!this.orgId || Date.now() < this.nextFireAt) return;

        try {
            const title = sample(TASK_TITLES);
            const description = sample(TASK_DESCRIPTIONS);
            const assignee = sample(this.memberIds);
            const daysOffset = randomInt(3, 14);
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + daysOffset);
            const readableId = `${this.orgPrefix}-${randomInt(1000, 9999)}`;

            const newTask = await this.prisma.tasks.create({
                data: {
                    readable_id: readableId,
                    organization_id: this.orgId,
                    title,
                    description,
                    status: 'todo',
                    assignee_id: assignee,
                    due_date: dueDate,
                },
            });

            await this.prisma.task_history.create({
                data: {
                    task_id: newTask.id,
                    organization_id: this.orgId,
                    previous_status: null,
                    new_status: 'todo',
                    changed_by: assignee,
                },
            });

            this.logger.log(`➕ Injected: ${newTask.readable_id} — ${title}`);
        } catch (err) {
            this.logger.warn(`Error injecting task: ${err}`);
        }

        // Schedule next injection: random between 1 and 4 days
        const nextInDays = randomInt(1, 3);
        this.nextFireAt = Date.now() + nextInDays * DAY_MS;
        this.logger.log(`💤 Next task injection in ${nextInDays} day(s).`);
    }
}
