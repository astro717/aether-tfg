import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding messages...\n');

  // 1. Find the testuser (test2@example.com) - we know its credentials: TestPass123
  let mainUser = await prisma.users.findFirst({
    where: { email: 'test2@example.com' },
  });

  if (!mainUser) {
    // Fallback to mainUser if testuser doesn't exist
    mainUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username: 'mainUser' },
          { email: 'mainUser@example.com' },
        ],
      },
    });
  }

  if (!mainUser) {
    // Create testuser if neither exists
    const password = await bcrypt.hash('TestPass123', 10);
    mainUser = await prisma.users.create({
      data: {
        email: 'test2@example.com',
        username: 'testuser',
        password_hash: password,
        role: 'user',
      },
    });
    console.log('✅ Created testuser:', mainUser.id);
  } else {
    console.log('✅ Found existing user:', mainUser.username, mainUser.id);
  }

  // 2. Create mock sender users (Apple executives for fun)
  const mockUsers = [
    { username: 'steve_jobs', email: 'steve@apple.mock', name: 'Steve Jobs' },
    { username: 'tim_cook', email: 'tim@apple.mock', name: 'Tim Cook' },
    { username: 'jony_ive', email: 'jony@apple.mock', name: 'Jony Ive' },
    { username: 'craig_federighi', email: 'craig@apple.mock', name: 'Craig Federighi' },
  ];

  const createdUsers: Record<string, typeof mainUser> = {};
  const mockPassword = await bcrypt.hash('MockPass123', 10);

  for (const mockUser of mockUsers) {
    let user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: mockUser.username },
          { email: mockUser.email },
        ],
      },
    });

    if (!user) {
      user = await prisma.users.create({
        data: {
          email: mockUser.email,
          username: mockUser.username,
          password_hash: mockPassword,
          role: 'user',
        },
      });
      console.log(`✅ Created mock user: ${mockUser.name}`);
    } else {
      console.log(`✅ Found existing mock user: ${mockUser.name}`);
    }

    createdUsers[mockUser.username] = user;
  }

  // 3. Insert messages
  const steve = createdUsers['steve_jobs'];
  const tim = createdUsers['tim_cook'];
  const jony = createdUsers['jony_ive'];
  const craig = createdUsers['craig_federighi'];

  // Clear existing messages for clean seeding (optional - comment out to keep existing)
  const existingMessages = await prisma.messages.count({
    where: {
      OR: [
        { sender_id: mainUser.id },
        { receiver_id: mainUser.id },
      ],
    },
  });

  if (existingMessages > 0) {
    console.log(`\n📧 Found ${existingMessages} existing messages. Skipping message creation.`);
    console.log('   (Delete existing messages manually if you want to re-seed)\n');
  } else {
    console.log('\n📧 Creating messages...\n');

    const now = new Date();

    // Conversation with Steve Jobs
    const steveMessages = [
      { from: steve, to: mainUser, content: 'Hey, I wanted to show you something incredible.', minutesAgo: 60, read: true },
      { from: mainUser, to: steve, content: 'Sure, what is it?', minutesAgo: 55, read: true },
      { from: steve, to: mainUser, content: "We've been working on something revolutionary. It's going to change everything.", minutesAgo: 50, read: true },
      { from: mainUser, to: steve, content: 'That sounds amazing! When can I see it?', minutesAgo: 45, read: true },
      { from: steve, to: mainUser, content: "Today. This is not just a product, it's a milestone.", minutesAgo: 40, read: true },
      { from: steve, to: mainUser, content: 'Remember: simplicity is the ultimate sophistication.', minutesAgo: 30, read: true },
      { from: mainUser, to: steve, content: "I can't wait to see what you've created.", minutesAgo: 20, read: true },
      { from: steve, to: mainUser, content: 'One more thing...', minutesAgo: 5, read: false }, // Unread!
    ];

    // Conversation with Tim Cook
    const timMessages = [
      { from: tim, to: mainUser, content: 'Good morning! Just reviewed the Q4 numbers.', minutesAgo: 180, read: true },
      { from: mainUser, to: tim, content: 'And? How do they look?', minutesAgo: 150, read: true },
      { from: tim, to: mainUser, content: 'The quarterly reports look great. Best quarter ever.', minutesAgo: 30, read: true },
    ];

    // Conversation with Jony Ive
    const jonyMessages = [
      { from: jony, to: mainUser, content: "I've been thinking about the new product line.", minutesAgo: 240, read: true },
      { from: mainUser, to: jony, content: 'What direction are you leaning?', minutesAgo: 210, read: true },
      { from: jony, to: mainUser, content: 'The new design is absolutely beautiful. Unapologetically so.', minutesAgo: 120, read: false }, // Unread!
    ];

    // Conversation with Craig Federighi
    const craigMessages = [
      { from: craig, to: mainUser, content: 'The new features are ready for the keynote.', minutesAgo: 360, read: true },
      { from: mainUser, to: craig, content: 'Perfect! Is the demo stable?', minutesAgo: 330, read: true },
      { from: craig, to: mainUser, content: 'Hair Force One is ready for WWDC!', minutesAgo: 300, read: true },
    ];

    const allMessages = [...steveMessages, ...timMessages, ...jonyMessages, ...craigMessages];

    for (const msg of allMessages) {
      const timestamp = new Date(now.getTime() - msg.minutesAgo * 60 * 1000);

      await prisma.messages.create({
        data: {
          sender_id: msg.from.id,
          receiver_id: msg.to.id,
          content: msg.content,
          created_at: timestamp,
          read_at: msg.read ? timestamp : null,
        },
      });
    }

    console.log(`✅ Created ${allMessages.length} messages`);
  }

  // 4. Summary
  console.log('\n📊 Summary:');
  console.log(`   Main user: ${mainUser.username} (${mainUser.id})`);
  console.log(`   Mock users: ${Object.keys(createdUsers).join(', ')}`);

  const totalMessages = await prisma.messages.count({
    where: {
      OR: [
        { sender_id: mainUser.id },
        { receiver_id: mainUser.id },
      ],
    },
  });

  const unreadCount = await prisma.messages.count({
    where: {
      receiver_id: mainUser.id,
      read_at: null,
    },
  });

  console.log(`   Total messages: ${totalMessages}`);
  console.log(`   Unread messages: ${unreadCount}`);

  console.log('\n✨ Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
