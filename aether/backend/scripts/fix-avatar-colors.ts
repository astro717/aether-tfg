import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AVATAR_COLORS = [
    'blue', 'purple', 'green', 'orange', 'pink',
    'teal', 'indigo', 'rose', 'amber', 'cyan'
];

/**
 * Smart avatar color assignment script
 * Groups users by initial and tries to avoid color repetition within each initial group
 */
async function main() {
    console.log('🎨 Starting smart avatar color migration...\n');

    // Get all users
    const allUsers = await prisma.users.findMany({
        select: {
            id: true,
            username: true,
            avatar_color: true
        },
        orderBy: {
            username: 'asc'
        }
    });

    console.log(`📊 Found ${allUsers.length} total users.\n`);

    // Group users by their first letter (case-insensitive)
    const usersByInitial = new Map<string, typeof allUsers>();

    for (const user of allUsers) {
        const initial = user.username.charAt(0).toUpperCase();
        if (!usersByInitial.has(initial)) {
            usersByInitial.set(initial, []);
        }
        usersByInitial.get(initial)!.push(user);
    }

    console.log(`📝 Users grouped into ${usersByInitial.size} initial groups:\n`);

    let totalUpdated = 0;

    // Process each initial group
    for (const [initial, users] of Array.from(usersByInitial.entries()).sort()) {
        console.log(`\n🔤 Processing initial "${initial}" (${users.length} users):`);

        // Track which colors are already in use for this initial
        const usedColors = new Set<string>();
        for (const user of users) {
            if (user.avatar_color && user.avatar_color !== 'zinc') {
                usedColors.add(user.avatar_color);
            }
        }

        // Get available colors (not yet used by this initial group)
        let availableColors = AVATAR_COLORS.filter(c => !usedColors.has(c));

        // If all colors are used, reset to use all colors
        if (availableColors.length === 0) {
            availableColors = [...AVATAR_COLORS];
        }

        // Shuffle available colors for randomness
        const shuffledColors = availableColors.sort(() => Math.random() - 0.5);
        let colorIndex = 0;

        // Assign colors to users who need them
        for (const user of users) {
            // Only update users with null or 'zinc' color
            if (!user.avatar_color || user.avatar_color === 'zinc') {
                // Get next available color (cycle through if needed)
                const newColor = shuffledColors[colorIndex % shuffledColors.length];
                colorIndex++;

                await prisma.users.update({
                    where: { id: user.id },
                    data: { avatar_color: newColor }
                });

                console.log(`  ✓ ${user.username}: ${user.avatar_color || 'null'} → ${newColor}`);
                totalUpdated++;
            } else {
                console.log(`  ○ ${user.username}: keeping ${user.avatar_color}`);
            }
        }
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} users.`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
