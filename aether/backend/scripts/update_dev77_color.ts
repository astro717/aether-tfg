import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'dev77';
    const newColor = 'orange'; // Distinct from blue/teal

    console.log(`Updating avatar color for user '${username}' to '${newColor}'...`);

    try {
        const user = await prisma.users.findFirst({
            where: { username: username },
        });

        if (!user) {
            console.log(`User '${username}' not found.`);
            return;
        }

        await prisma.users.update({
            where: { id: user.id },
            data: { avatar_color: newColor },
        });

        console.log(`Successfully updated ${username}'s avatar color to ${newColor}.`);
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
