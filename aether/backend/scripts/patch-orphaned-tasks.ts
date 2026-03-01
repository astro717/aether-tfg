import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Data patch script: Assign orphaned tasks to their assignee's organization.
 *
 * Problem: Some tasks have organization_id = null, which causes them to be
 * excluded from Manager Zone KPI calculations (correct behavior by design).
 *
 * Solution: Link orphaned tasks to an organization based on the assignee's
 * membership in user_organizations.
 */
async function main() {
    console.log('🔧 Starting orphaned tasks patch...\n');

    // Step 1: Find all orphaned tasks (organization_id is null)
    const orphanedTasks = await prisma.tasks.findMany({
        where: { organization_id: null },
        select: {
            id: true,
            readable_id: true,
            title: true,
            assignee_id: true,
            status: true,
            due_date: true,
        },
    });

    console.log(`📊 Found ${orphanedTasks.length} orphaned tasks.\n`);

    if (orphanedTasks.length === 0) {
        console.log('✅ No orphaned tasks to patch. Exiting.');
        return;
    }

    // Step 2: Get a default organization (first one found) as fallback
    const defaultOrg = await prisma.organizations.findFirst({
        select: { id: true, name: true },
    });

    if (!defaultOrg) {
        console.error('❌ No organizations found in database. Cannot proceed.');
        process.exit(1);
    }

    console.log(`🏢 Default fallback organization: "${defaultOrg.name}" (${defaultOrg.id})\n`);

    let patchedCount = 0;
    let fallbackCount = 0;

    // Step 3: Process each orphaned task
    for (const task of orphanedTasks) {
        let targetOrgId: string | null = null;
        let source = '';

        // Try to find organization via assignee's membership
        if (task.assignee_id) {
            const userOrg = await prisma.user_organizations.findFirst({
                where: { user_id: task.assignee_id },
                select: { organization_id: true },
            });

            if (userOrg) {
                targetOrgId = userOrg.organization_id;
                source = 'assignee membership';
            }
        }

        // Fallback to default organization
        if (!targetOrgId) {
            targetOrgId = defaultOrg.id;
            source = 'default fallback';
            fallbackCount++;
        }

        // Update the task
        await prisma.tasks.update({
            where: { id: task.id },
            data: { organization_id: targetOrgId },
        });

        const statusEmoji = task.status === 'done' ? '✅' : task.status === 'in_progress' ? '🔄' : '📋';
        const deadlineInfo = task.due_date ? `due ${task.due_date.toISOString().split('T')[0]}` : 'no deadline';

        console.log(`  ${statusEmoji} ${task.readable_id}: "${task.title.slice(0, 40)}..." → org via ${source} (${deadlineInfo})`);
        patchedCount++;
    }

    console.log(`\n✅ Patch complete!`);
    console.log(`   - Total patched: ${patchedCount}`);
    console.log(`   - Via assignee org: ${patchedCount - fallbackCount}`);
    console.log(`   - Via fallback: ${fallbackCount}`);

    // Step 4: Verification - show new On-Time Rate breakdown
    console.log('\n📈 Post-patch verification...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completedTasks = await prisma.tasks.findMany({
        where: {
            status: 'done',
            organization_id: { not: null },
            updated_at: { gte: thirtyDaysAgo },
        },
        select: {
            readable_id: true,
            due_date: true,
            updated_at: true,
        },
    });

    const withDeadline = completedTasks.filter(t => t.due_date !== null);
    const onTime = withDeadline.filter(t => t.updated_at <= t.due_date!);

    console.log(`   - Completed tasks (last 30d, with org): ${completedTasks.length}`);
    console.log(`   - With deadline: ${withDeadline.length}`);
    console.log(`   - On-time: ${onTime.length}`);
    console.log(`   - On-Time Rate: ${withDeadline.length > 0 ? Math.round((onTime.length / withDeadline.length) * 100) : 0}%`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
