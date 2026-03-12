import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

const TARGET_ORG_NAME = 'Test Organization';

const TASK_TITLES = [
    'Refactor authentication middleware',
    'Fix race condition in payment webhook',
    'Update React dependencies to v19',
    'Optimize Postgres query in AnalyticsDashboard',
    'Implement Premium Modal glassmorphism',
    'Write E2E tests for user onboarding',
    'Resolve memory leak in WebSockets',
    'Draft API documentation for v2 endpoints',
    'Migrate legacy CSS to Tailwind',
    'Investigate 502 errors on production edge network',
    'Design new zero-state UI for empty projects',
    'Implement rate limiting on public API',
    'Upgrade Node.js Docker image',
    'Audit NPM packages for security vulnerabilities',
    'Implement Apple Calendar sync feature',
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
            const daysOffset = randomInt(1, 4);
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
        const nextInDays = randomInt(1, 4);
        this.nextFireAt = Date.now() + nextInDays * DAY_MS;
        this.logger.log(`💤 Next task injection in ${nextInDays} day(s).`);
    }
}
