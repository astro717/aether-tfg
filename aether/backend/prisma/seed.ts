import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('TestPass123', 10);

  // 1. Upsert User
  const user = await prisma.users.upsert({
    where: { email: 'test2@example.com' },
    update: {
      username: 'testuser',
      password_hash: password,
      role: 'user',
    },
    create: {
      email: 'test2@example.com',
      username: 'testuser',
      password_hash: password,
      role: 'user',
    },
  });
  console.log('User upserted:', user.id);

  // 1b. Upsert Manager User
  const managerPassword = await bcrypt.hash('ManagerPass123', 10);
  const manager = await prisma.users.upsert({
    where: { email: 'manager@example.com' },
    update: {
      username: 'manager',
      password_hash: managerPassword,
      role: 'manager',
    },
    create: {
      email: 'manager@example.com',
      username: 'manager',
      password_hash: managerPassword,
      role: 'manager',
    },
  });
  console.log('Manager upserted:', manager.id);

  // 2. Find or create Organization (name is not unique, so we query first)
  let org = await prisma.organizations.findFirst({
    where: { name: 'Test Organization' },
  });
  if (!org) {
    org = await prisma.organizations.create({
      data: { name: 'Test Organization' },
    });
    console.log('Organization created:', org.id);
  } else {
    console.log('Organization already exists:', org.id);
  }

  // 3. Link User to Organization
  await prisma.user_organizations.upsert({
    where: {
      user_id_organization_id: {
        user_id: user.id,
        organization_id: org.id,
      },
    },
    update: {},
    create: {
      user_id: user.id,
      organization_id: org.id,
      role_in_org: 'admin',
    },
  });
  console.log('User linked to organization');

  // 3b. Link Manager to Organization
  await prisma.user_organizations.upsert({
    where: {
      user_id_organization_id: {
        user_id: manager.id,
        organization_id: org.id,
      },
    },
    update: {},
    create: {
      user_id: manager.id,
      organization_id: org.id,
      role_in_org: 'manager',
    },
  });
  console.log('Manager linked to organization');

  // 4. Create Repo (find existing first to avoid duplicates on re-run)
  let repo = await prisma.repos.findFirst({
    where: { name: 'Test Repo', organization_id: org.id },
  });
  if (!repo) {
    repo = await prisma.repos.create({
      data: {
        name: 'Test Repo',
        url: 'http://github.com/test/test-repo',
        provider: 'github',
        organization_id: org.id,
      },
    });
    console.log('Repo created:', repo.id);
  } else {
    console.log('Repo already exists:', repo.id);
  }

  // 5. Create multiple tasks across Kanban columns, all assigned to test user
  const seedTasks = [
    { title: 'Test Task', description: 'This is a test task', status: 'pending', due_date: null },
    { title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated builds and deploys', status: 'pending', due_date: new Date(Date.now() + 2 * 86400000) },
    { title: 'Write API documentation', description: 'Document all REST endpoints with examples', status: 'pending', due_date: new Date(Date.now() + 5 * 86400000) },
    { title: 'Fix login redirect bug', description: 'Users are not redirected after login on expired sessions', status: 'in_progress', due_date: new Date(Date.now() + 1 * 86400000) },
    { title: 'Refactor task service', description: 'Extract validation logic into reusable helpers', status: 'in_progress', due_date: new Date(Date.now() + 7 * 86400000) },
    { title: 'Add unit tests for auth', description: 'Cover login, register, and JWT validation flows', status: 'pending', due_date: new Date(Date.now() + 10 * 86400000) },
    { title: 'Design settings page', description: 'Create wireframes for user settings and preferences', status: 'done', due_date: null },
    { title: 'Database schema review', description: 'Review indexes and constraints for performance', status: 'done', due_date: null },
  ];

  for (const t of seedTasks) {
    const existing = await prisma.tasks.findFirst({
      where: { title: t.title, repo_id: repo.id },
    });
    if (!existing) {
      await prisma.tasks.create({
        data: {
          title: t.title,
          description: t.description,
          status: t.status,
          due_date: t.due_date,
          repo_id: repo.id,
          assignee_id: user.id,
        },
      });
      console.log(`Task created: ${t.title}`);
    } else {
      console.log(`Task already exists: ${t.title}`);
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
