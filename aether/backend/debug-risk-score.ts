import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function isTaskStatus(task: any, status: string) {
    return task.status === status;
}

async function main() {
    const org = await prisma.organizations.findFirst({
        orderBy: { created_at: 'asc' },
    });
    if (!org) {
        console.log('No organization found');
        return;
    }

    // Query only active tasks (same as the actual code)
    const tasks = await prisma.tasks.findMany({
        where: {
            organization_id: org.id,
            is_archived: false,
            status: { in: ['todo', 'in_progress'] },
        },
    });

    console.log('=== RISK SCORE DEBUG ===');
    console.log('Organization:', org.name);
    console.log('Total Active Tasks:', tasks.length);

    if (tasks.length === 0) {
        console.log('Risk Score: 0 (no active tasks)');
        return;
    }

    const now = Date.now();

    // Factor 1: Overdue Tasks
    const tasksWithDueDate = tasks.filter(t => t.due_date);
    const overdueTasks = tasksWithDueDate.filter(t => new Date(t.due_date!).getTime() < now);
    const overdueCount = overdueTasks.length;

    let overdueScore = 0;
    if (overdueCount > 0) {
        const tier1 = Math.min(overdueCount, 2);
        overdueScore += tier1 * 15;
        const tier2 = Math.min(Math.max(overdueCount - 2, 0), 3);
        overdueScore += tier2 * 10;
        const tier3 = Math.max(overdueCount - 5, 0);
        overdueScore += tier3 * 5;
    }
    overdueScore = Math.min(overdueScore, 60);

    // Factor 2: Approaching Deadlines
    const approachingDeadline = tasksWithDueDate.filter(t => {
        const daysUntilDue = (new Date(t.due_date!).getTime() - now) / (1000 * 60 * 60 * 24);
        return daysUntilDue > 0 && daysUntilDue <= 7;
    });
    const approachingScore = Math.min(approachingDeadline.length * 5, 25);

    // Factor 3: WIP Saturation
    const inProgressCount = tasks.filter(t => isTaskStatus(t, 'in_progress')).length;
    const wipRatio = inProgressCount / tasks.length;
    let wipScore = 0;
    if (wipRatio > 0.5) {
        wipScore = Math.round(((wipRatio - 0.5) / 0.5) * 25);
    }

    // Factor 4: Missing Due Dates
    const missingDueDateCount = tasks.filter(t => !t.due_date).length;
    const missingDueDateScore = Math.min(missingDueDateCount * 3, 15);

    const totalScore = Math.min(100, Math.round(overdueScore + approachingScore + wipScore + missingDueDateScore));

    console.log('\n--- BREAKDOWN ---');
    console.log('Tasks with due date:', tasksWithDueDate.length);
    console.log('Overdue Tasks:', overdueCount, '→ Score:', overdueScore);
    console.log('Approaching (≤7 days):', approachingDeadline.length, '→ Score:', approachingScore);
    console.log('In Progress:', inProgressCount, `(${(wipRatio * 100).toFixed(1)}%)`, '→ Score:', wipScore);
    console.log('Missing Due Dates:', missingDueDateCount, '→ Score:', missingDueDateScore);
    console.log('\n=== FINAL RISK SCORE:', totalScore, '===');

    if (totalScore <= 20) {
        console.log('Status: Healthy (green)');
    } else if (totalScore <= 40) {
        console.log('Status: Low risk (green)');
    } else if (totalScore <= 70) {
        console.log('Status: Moderate (amber)');
    } else {
        console.log('Status: High risk (red)');
    }
}

main().finally(() => prisma.$disconnect());
