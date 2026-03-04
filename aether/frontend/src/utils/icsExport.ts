/**
 * ICS Calendar Export Utility
 * RFC 5545 compliant .ics file generator
 * Zero dependencies - pure template literals for maximum bundle efficiency
 */

import type { Task } from '../modules/dashboard/api/tasksApi';

interface ICSTask {
  id: string;
  title: string;
  due_date: string | null;
  description?: string | null;
  users_tasks_assignee_idTousers?: {
    username: string;
  } | null;
}

/**
 * Formats a Date to ICS date format (YYYYMMDD)
 */
function formatICSDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Formats a Date to ICS datetime format (YYYYMMDDTHHMMSS)
 */
function formatICSDateTime(date: Date): string {
  const dateStr = formatICSDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr}T${hours}${minutes}${seconds}`;
}

/**
 * Escapes special characters for ICS text fields
 * RFC 5545: backslash, semicolon, comma, and newlines must be escaped
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates a deterministic UID for calendar events
 * Format: task-{taskId}@aether.app
 */
function generateUID(taskId: string): string {
  return `task-${taskId}@aether.app`;
}

/**
 * Checks if a date has a specific time set (not midnight)
 */
function hasSpecificTime(date: Date): boolean {
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

/**
 * Generates a VEVENT block for a single task
 */
function generateVEvent(task: ICSTask): string {
  if (!task.due_date) return '';

  const dueDate = new Date(task.due_date);
  const hasTime = hasSpecificTime(dueDate);
  const assignee = task.users_tasks_assignee_idTousers?.username || 'Unassigned';
  const now = new Date();

  // Build description
  const description = `Downloaded from Aether. Assignee: ${assignee}`;

  // Event lines
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${generateUID(task.id)}`,
    `DTSTAMP:${formatICSDateTime(now)}`,
  ];

  // DTSTART/DTEND: all-day event vs timed event
  if (hasTime) {
    // Timed event: start at due time, end 1 hour later
    const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${formatICSDateTime(dueDate)}`);
    lines.push(`DTEND:${formatICSDateTime(endDate)}`);
  } else {
    // All-day event (VALUE=DATE format)
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(dueDate)}`);
    // For all-day events, DTEND should be the next day (exclusive)
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${formatICSDate(nextDay)}`);
  }

  lines.push(
    `SUMMARY:${escapeICSText(task.title)} (Aether)`,
    `DESCRIPTION:${escapeICSText(description)}`,
    'END:VEVENT'
  );

  return lines.join('\r\n');
}

/**
 * Generates a complete ICS file content from an array of tasks
 * @param tasks - Array of tasks with due dates
 * @returns Raw ICS file content as string
 */
export function generateICS(tasks: Task[]): string {
  // Filter tasks with valid due dates
  const validTasks = tasks.filter((t): t is Task & { due_date: string } =>
    t.due_date !== null && t.due_date !== undefined
  );

  if (validTasks.length === 0) {
    return '';
  }

  // Generate VEVENT blocks
  const events = validTasks.map(generateVEvent).filter(Boolean);

  // Build complete ICS file
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aether//Deadline Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Aether Deadlines',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return icsContent;
}

/**
 * Downloads an ICS file to the user's device
 * @param content - Raw ICS file content
 * @param filename - Name for the downloaded file
 */
export function downloadICSFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Create invisible anchor and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Filters tasks for a specific month
 * @param tasks - Array of all tasks
 * @param year - Target year
 * @param month - Target month (0-indexed)
 * @returns Tasks with due dates within the specified month
 */
export function filterTasksForMonth(tasks: Task[], year: number, month: number): Task[] {
  return tasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    return dueDate.getFullYear() === year && dueDate.getMonth() === month;
  });
}

/**
 * Generates a formatted filename for the ICS export
 * @param year - Year of the export
 * @param month - Month (0-indexed)
 * @returns Formatted filename like "aether-deadlines-march-2026.ics"
 */
export function generateICSFilename(year: number, month: number): string {
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
  return `aether-deadlines-${monthName}-${year}.ics`;
}
