// Apple-like creamy/pastel colors for user avatars
// Backgrounds are 100/200, Text is neutral (gray-800/white) for clean look

export const AVATAR_COLORS = [
    { name: "blue", bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-gray-700 dark:text-blue-100", border: "border-blue-200 dark:border-blue-800" },
    { name: "purple", bg: "bg-purple-100 dark:bg-purple-500/20", text: "text-gray-700 dark:text-purple-100", border: "border-purple-200 dark:border-purple-800" },
    { name: "green", bg: "bg-green-100 dark:bg-green-500/20", text: "text-gray-700 dark:text-green-100", border: "border-green-200 dark:border-green-800" },
    { name: "orange", bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-gray-700 dark:text-orange-100", border: "border-orange-200 dark:border-orange-800" },
    { name: "pink", bg: "bg-pink-100 dark:bg-pink-500/20", text: "text-gray-700 dark:text-pink-100", border: "border-pink-200 dark:border-pink-800" },
    { name: "teal", bg: "bg-teal-100 dark:bg-teal-500/20", text: "text-gray-700 dark:text-teal-100", border: "border-teal-200 dark:border-teal-800" },
    { name: "indigo", bg: "bg-indigo-100 dark:bg-indigo-500/20", text: "text-gray-700 dark:text-indigo-100", border: "border-indigo-200 dark:border-indigo-800" },
    { name: "rose", bg: "bg-rose-100 dark:bg-rose-500/20", text: "text-gray-700 dark:text-rose-100", border: "border-rose-200 dark:border-rose-800" },
    { name: "amber", bg: "bg-amber-100 dark:bg-amber-500/20", text: "text-gray-700 dark:text-amber-100", border: "border-amber-200 dark:border-amber-800" },
    { name: "cyan", bg: "bg-cyan-100 dark:bg-cyan-500/20", text: "text-gray-700 dark:text-cyan-100", border: "border-cyan-200 dark:border-cyan-800" },
] as const;

export type AvatarColorName = typeof AVATAR_COLORS[number]['name'];

export function getRandomAvatarColor(): AvatarColorName {
    const randomIndex = Math.floor(Math.random() * AVATAR_COLORS.length);
    return AVATAR_COLORS[randomIndex].name;
}

export function getAvatarColorClasses(colorName?: string | null, fallbackString?: string) {
    // Try to find the color by name
    const color = AVATAR_COLORS.find(c => c.name === colorName);
    if (color) return color;

    // Fallback: Deterministic color based on username/email (or random if not provided)
    if (fallbackString) {
        let hash = 0;
        for (let i = 0; i < fallbackString.length; i++) {
            hash = fallbackString.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % AVATAR_COLORS.length;
        return AVATAR_COLORS[index];
    }

    // Ultimate fallback if nothing else works
    return AVATAR_COLORS[0];
}
