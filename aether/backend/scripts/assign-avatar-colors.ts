import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AVATAR_COLORS = [
    'blue', 'purple', 'green', 'orange', 'pink',
    'teal', 'indigo', 'rose', 'amber', 'cyan'
];

async function main() {
    console.log('Starting avatar color migration...');

    // Get all users without an avatar color or with default 'zinc'
    const users = await prisma.users.findMany({
        where: {
            OR: [
                { avatar_color: null },
                { avatar_color: 'zinc' } // default in schema
            ]
        }
    });

    console.log(`Found ${users.length} users to update.`);

    let updatedCount = 0;

    for (const user of users) {
        const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

        await prisma.users.update({
            where: { id: user.id },
            data: { avatar_color: randomColor }
        });

        updatedCount++;
        if (updatedCount % 10 === 0) {
            console.log(`Updated ${updatedCount} users...`);
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} users.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
