import { getAvatarColorClasses } from "../../lib/avatarColors";

interface UserAvatarProps {
    username?: string | null;
    email?: string | null;
    avatarColor?: string | null;
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    className?: string;
    showStatus?: boolean;
    statusColor?: string;
    displayInitials?: string;
}

export function UserAvatar({
    username,
    email,
    avatarColor,
    size = "md",
    className = "",
    showStatus = false,
    statusColor = "#22C55E", // Online green by default
    displayInitials,
}: UserAvatarProps) {
    // Helper to get initials: "Juan Perez" -> "JP", "Juan" -> "J"
    const getInitials = (name: string) => {
        const parts = name.trim().split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 1).toUpperCase();
    };

    const initials = displayInitials || getInitials(username || email || "?");

    const colors = getAvatarColorClasses(avatarColor);

    // Exact sizing from previous implementation
    const sizeClasses = {
        xs: "w-6 h-6 text-[9px]", // Matches TaskCard
        sm: "w-8 h-8 text-xs",     // Matches MessageItem
        md: "w-10 h-10 text-sm",   // Matches ChatHeader
        lg: "w-12 h-12 text-base",
        xl: "w-16 h-16 text-xl",
        "2xl": "w-32 h-32 text-4xl",
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                className={`
          ${sizeClasses[size]} 
          rounded-full 
          flex items-center justify-center 
          font-semibold
          shadow-sm 
          ${colors.bg} 
          ${colors.text}
          ${colors.border}
        `}
            >
                {initials}
            </div>

            {showStatus && (
                <div className="absolute bottom-0 right-0 p-[2px] bg-white dark:bg-[#18181B] rounded-full">
                    <div
                        className="w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#18181B]"
                        style={{ backgroundColor: statusColor }}
                    />
                </div>
            )}
        </div>
    );
}
