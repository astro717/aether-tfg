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
    'Implement Apple Calendar sync feature'
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

                // Randomize due date: Between 1 and 4 days in the future
                const daysOffset = randomInt(1, 4);
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
