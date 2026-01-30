import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Dashboard Repair ---');

  // 1. Fix Statuses
  console.log('1. Normalizing Statuses...');
  await prisma.tasks.updateMany({ where: { status: { mode: 'insensitive', equals: 'to do' } }, data: { status: 'pending' } });
  await prisma.tasks.updateMany({ where: { status: { mode: 'insensitive', equals: 'in progress' } }, data: { status: 'in_progress' } });
  await prisma.tasks.updateMany({ where: { status: { mode: 'insensitive', equals: 'done' } }, data: { status: 'done' } });

  // 2. Adopt Orphans (Fix Missing Tasks via Repo ID)
  console.log('2. Adopting Orphaned Tasks...');
  // Find a valid repo (any rep) to dump orphans into
  const defaultRepo = await prisma.repos.findFirst();
  if (defaultRepo) {
      const result = await prisma.tasks.updateMany({
          where: { repo_id: null },
          data: { repo_id: defaultRepo.id }
      });
      console.log(`   Assigned ${result.count} orphaned tasks to repo: ${defaultRepo.name}`);
  } else {
      console.warn('   No repos found! Cannot adopt orphans. Please create a repo first.');
  }

  console.log('--- Repair Complete ---');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
