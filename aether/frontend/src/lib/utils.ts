import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date as a human-readable "time ago" string
 * @param date - Date object or ISO string
 * @returns Formatted string like "2 hours ago", "Just now", "Generated on Oct 24"
 */
export function formatTimeAgo(date: Date | string | undefined | null): string {
  if (!date) return "Unknown";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Check if date is valid
  if (isNaN(dateObj.getTime())) return "Unknown";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  // Less than 1 minute
  if (diffInSeconds < 60) {
    return "Just now";
  }

  // Less than 24 hours - use relative time
  if (diffInSeconds < 86400) {
    return formatDistanceToNow(dateObj, { addSuffix: true });
  }

  // Yesterday
  if (isYesterday(dateObj)) {
    return "Yesterday";
  }

  // Today (edge case)
  if (isToday(dateObj)) {
    return formatDistanceToNow(dateObj, { addSuffix: true });
  }

  // Older - show date
  return `on ${format(dateObj, "MMM d")}`;
}
