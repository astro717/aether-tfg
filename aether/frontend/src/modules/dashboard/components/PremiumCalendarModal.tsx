import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, AlertCircle, Clock, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Task } from '../api/tasksApi';
import { getAvatarColorClasses } from '../../../lib/avatarColors';
import { generateICS, downloadICSFile, filterTasksForMonth, generateICSFilename } from '../../../utils/icsExport';
import { useToast } from '../../../components/ui/Toast';

// Micro Avatar for calendar cells - FAANG-level compact design
function MicroAvatar({
    username,
    avatarColor,
    isOverdue = false
}: {
    username?: string | null;
    avatarColor?: string | null;
    isOverdue?: boolean;
}) {
    const colors = getAvatarColorClasses(avatarColor, username || undefined);
    const initial = username?.charAt(0).toUpperCase() || '?';

    return (
        <div
            className={`
                w-5 h-5 rounded-full flex items-center justify-center
                text-[8px] font-bold
                ${colors.bg} ${colors.text}
                ring-[1.5px] ring-white dark:ring-zinc-900
                ${isOverdue ? 'ring-2 ring-red-500/70 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900' : ''}
                shadow-sm
            `}
        >
            {initial}
        </div>
    );
}

interface PremiumCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    viewMode: 'org' | 'personal';
}

// --- Calendar Helpers ---

function getMonthData(year: number, month: number): { days: Date[]; startPadding: number } {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start week on Monday (0 = Mon, 6 = Sun)
    let startPadding = firstDay.getDay() - 1;
    if (startPadding < 0) startPadding = 6;

    const days: Date[] = [];
    for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push(new Date(year, month, d));
    }

    return { days, startPadding };
}

function isSameDay(d1: Date, d2: Date): boolean {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

function getTasksForDay(tasks: Task[], day: Date): Task[] {
    return tasks.filter(t => {
        if (!t.due_date) return false;
        const taskDate = new Date(t.due_date);
        return isSameDay(taskDate, day);
    });
}

function formatTime(dateStr: string): string | null {
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // If time is 00:00, assume no specific time was set
    if (hours === 0 && minutes === 0) return null;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Aether color palette for assignees (stable, derived from ID)
const AETHER_ASSIGNEE_PALETTE = [
    { bg: 'bg-blue-500', shadow: 'shadow-blue-500/60' },
    { bg: 'bg-violet-500', shadow: 'shadow-violet-500/60' },
    { bg: 'bg-pink-500', shadow: 'shadow-pink-500/60' },
    { bg: 'bg-amber-500', shadow: 'shadow-amber-500/60' },
    { bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/60' },
    { bg: 'bg-cyan-500', shadow: 'shadow-cyan-500/60' },
    { bg: 'bg-rose-500', shadow: 'shadow-rose-500/60' },
    { bg: 'bg-indigo-500', shadow: 'shadow-indigo-500/60' },
];

// Status-based colors for Personal View
const STATUS_COLORS: Record<string, { bg: string; shadow: string }> = {
    todo: { bg: 'bg-gray-400 dark:bg-gray-500', shadow: 'shadow-gray-400/40' },
    pending: { bg: 'bg-gray-400 dark:bg-gray-500', shadow: 'shadow-gray-400/40' },
    in_progress: { bg: 'bg-blue-500', shadow: 'shadow-blue-500/60' },
    done: { bg: 'bg-green-500 dark:bg-green-600/70', shadow: 'shadow-green-500/40' },
};

// Hash a string to get a consistent index
function hashStringToIndex(str: string, max: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % max;
}

// Check if a task is overdue (past due date and not done)
function isOverdue(task: Task): boolean {
    if (!task.due_date || task.status === 'done') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < now;
}

// Get color for a task based on viewMode
function getTaskDotColor(task: Task, viewMode: 'org' | 'personal'): { bg: string; shadow: string } {
    if (viewMode === 'org') {
        // Organization view: color by assignee
        const assigneeId = task.assignee_id || task.id; // fallback to task id if no assignee
        const colorIndex = hashStringToIndex(assigneeId, AETHER_ASSIGNEE_PALETTE.length);
        return AETHER_ASSIGNEE_PALETTE[colorIndex];
    } else {
        // Personal view: color by status (exclude pending_validation from special treatment)
        if (task.status === 'pending_validation') {
            return STATUS_COLORS.todo; // treat as gray/silent
        }
        return STATUS_COLORS[task.status] || STATUS_COLORS.todo;
    }
}

export function PremiumCalendarModal({ isOpen, onClose, tasks, viewMode }: PremiumCalendarModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [showExportDialog, setShowExportDialog] = useState(false);
    const { showToast } = useToast();

    // Handle visibility animation
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    // Month navigation
    const goToPrevMonth = useCallback(() => {
        setCurrentMonth(prev => {
            const newMonth = prev.month - 1;
            if (newMonth < 0) {
                return { year: prev.year - 1, month: 11 };
            }
            return { ...prev, month: newMonth };
        });
        setSelectedDay(null);
    }, []);

    const goToNextMonth = useCallback(() => {
        setCurrentMonth(prev => {
            const newMonth = prev.month + 1;
            if (newMonth > 11) {
                return { year: prev.year + 1, month: 0 };
            }
            return { ...prev, month: newMonth };
        });
        setSelectedDay(null);
    }, []);

    const goToToday = useCallback(() => {
        const now = new Date();
        setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
        setSelectedDay(null);
    }, []);

    // Tasks for export (current month, with due dates, excluding done)
    const exportableTasks = useMemo(() => {
        return filterTasksForMonth(tasks, currentMonth.year, currentMonth.month)
            .filter(t => t.status !== 'done');
    }, [tasks, currentMonth]);

    // Handle export confirmation
    const handleExportConfirm = useCallback(() => {
        const icsContent = generateICS(exportableTasks);
        if (!icsContent) {
            showToast('No tasks with deadlines to export', 'warning');
            setShowExportDialog(false);
            return;
        }
        const filename = generateICSFilename(currentMonth.year, currentMonth.month);
        downloadICSFile(icsContent, filename);
        setShowExportDialog(false);
        showToast({
            type: 'success',
            title: 'Calendar exported',
            message: `${exportableTasks.length} deadline${exportableTasks.length !== 1 ? 's' : ''} exported successfully`,
        });
    }, [exportableTasks, currentMonth, showToast]);

    // Calendar data
    const monthData = useMemo(() => {
        return getMonthData(currentMonth.year, currentMonth.month);
    }, [currentMonth]);

    const monthLabel = useMemo(() => {
        const date = new Date(currentMonth.year, currentMonth.month, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [currentMonth]);

    // Tasks for selected day, sorted by time
    // Personal view excludes pending_validation (only confirmed milestones)
    const selectedDayTasks = useMemo(() => {
        if (!selectedDay) return [];
        return getTasksForDay(tasks, selectedDay)
            .filter(t => t.status !== 'done')
            .filter(t => viewMode === 'org' || t.status !== 'pending_validation')
            .sort((a, b) => {
                if (!a.due_date || !b.due_date) return 0;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            });
    }, [selectedDay, tasks, viewMode]);

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/50 backdrop-blur-md"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal */}
                    <motion.div
                        className="relative w-full max-w-5xl max-h-[85vh] mx-4 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex"
                        initial={{ scale: 0.95, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 20, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {/* Calendar Section */}
                        <div className="flex-1 flex flex-col p-8">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {monthLabel}
                                    </h2>
                                    <button
                                        onClick={goToToday}
                                        className="px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-colors"
                                    >
                                        Today
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={goToPrevMonth}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                        aria-label="Previous month"
                                    >
                                        <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
                                    </button>
                                    <button
                                        onClick={goToNextMonth}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                        aria-label="Next month"
                                    >
                                        <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
                                    </button>

                                    {/* Export Button */}
                                    <div className="relative group ml-2">
                                        <button
                                            onClick={() => setShowExportDialog(true)}
                                            disabled={exportableTasks.length === 0}
                                            className="p-2 rounded-full hover:bg-violet-100 dark:hover:bg-violet-500/20 text-gray-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            aria-label="Export to Calendar"
                                        >
                                            <Download size={20} />
                                        </button>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 dark:bg-zinc-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            Export to Calendar
                                        </div>
                                    </div>

                                    <button
                                        onClick={onClose}
                                        className="ml-2 p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                        aria-label="Close"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 mb-2">
                                {WEEKDAYS.map(day => (
                                    <div
                                        key={day}
                                        className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 flex-1">
                                {/* Empty cells for start padding */}
                                {Array.from({ length: monthData.startPadding }).map((_, i) => (
                                    <div key={`pad-${i}`} className="aspect-square" />
                                ))}

                                {/* Day cells */}
                                {monthData.days.map(day => {
                                    // Personal view excludes pending_validation (only confirmed milestones)
                                    const dayTasks = getTasksForDay(tasks, day)
                                        .filter(t => t.status !== 'done')
                                        .filter(t => viewMode === 'org' || t.status !== 'pending_validation');
                                    const isToday = isSameDay(day, today);
                                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                                    return (
                                        <motion.button
                                            key={day.toISOString()}
                                            onClick={() => setSelectedDay(isSelected ? null : day)}
                                            className={`
                                                relative aspect-square rounded-xl p-1.5 flex flex-col items-center justify-start
                                                transition-all duration-200 group
                                                ${isSelected
                                                    ? 'bg-violet-100 dark:bg-violet-500/30 ring-2 ring-violet-500 dark:ring-violet-400'
                                                    : isToday
                                                        ? 'bg-violet-50 dark:bg-violet-500/10'
                                                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                }
                                                ${isWeekend ? 'opacity-60' : ''}
                                            `}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            {/* Day number */}
                                            <span
                                                className={`
                                                    text-sm font-medium
                                                    ${isToday
                                                        ? 'w-7 h-7 flex items-center justify-center rounded-full bg-violet-500 text-white'
                                                        : isSelected
                                                            ? 'text-violet-700 dark:text-violet-300'
                                                            : 'text-gray-700 dark:text-gray-300'
                                                    }
                                                `}
                                            >
                                                {day.getDate()}
                                            </span>

                                            {/* Task indicators - Avatars (org) or Status Dots (personal) */}
                                            {dayTasks.length > 0 && viewMode === 'org' && (
                                                // ORG VIEW: Smart Avatar Grid (FAANG-level layout)
                                                // 1-2 tasks: horizontal stack | 3-4: 2x2 grid | 5+: grid with +N overlay
                                                <div className="relative mt-1.5 group/avatars">
                                                    {dayTasks.length <= 2 ? (
                                                        // Horizontal stack for 1-2 avatars
                                                        <div className="flex items-center -space-x-1">
                                                            {dayTasks.map((task, i) => (
                                                                <motion.div
                                                                    key={task.id}
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    transition={{ delay: i * 0.04 }}
                                                                    style={{ zIndex: 2 - i }}
                                                                >
                                                                    <MicroAvatar
                                                                        username={task.users_tasks_assignee_idTousers?.username}
                                                                        avatarColor={task.users_tasks_assignee_idTousers?.avatar_color}
                                                                        isOverdue={isOverdue(task)}
                                                                    />
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        // 2x2 Grid for 3+ avatars (Linear/Notion style)
                                                        <div className="grid grid-cols-2 gap-0.5 w-fit">
                                                            {dayTasks.slice(0, dayTasks.length > 4 ? 3 : 4).map((task, i) => (
                                                                <motion.div
                                                                    key={task.id}
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    transition={{ delay: i * 0.03 }}
                                                                >
                                                                    <MicroAvatar
                                                                        username={task.users_tasks_assignee_idTousers?.username}
                                                                        avatarColor={task.users_tasks_assignee_idTousers?.avatar_color}
                                                                        isOverdue={isOverdue(task)}
                                                                    />
                                                                </motion.div>
                                                            ))}
                                                            {dayTasks.length > 4 && (
                                                                <motion.div
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    transition={{ delay: 0.12 }}
                                                                    className="w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-600 flex items-center justify-center text-[7px] font-bold text-gray-600 dark:text-gray-300 ring-[1.5px] ring-white dark:ring-zinc-900"
                                                                >
                                                                    +{dayTasks.length - 3}
                                                                </motion.div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Hover tooltip showing all task titles */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900/95 dark:bg-zinc-800 backdrop-blur-sm text-white text-[10px] rounded-xl whitespace-nowrap opacity-0 group-hover/avatars:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl max-w-[180px]">
                                                        {dayTasks.slice(0, 5).map((t, i) => (
                                                            <div key={t.id} className={`truncate ${i > 0 ? 'mt-0.5' : ''} ${isOverdue(t) ? 'text-red-300' : ''}`}>
                                                                {t.users_tasks_assignee_idTousers?.username?.split(' ')[0] || '?'}: {t.title}
                                                            </div>
                                                        ))}
                                                        {dayTasks.length > 5 && (
                                                            <div className="mt-0.5 text-gray-400">+{dayTasks.length - 5} more...</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {dayTasks.length > 0 && viewMode === 'personal' && (
                                                // PERSONAL VIEW: Status-colored dots
                                                <div className="flex items-center gap-1 mt-2">
                                                    {dayTasks.slice(0, 3).map((task, i) => {
                                                        const dotColor = getTaskDotColor(task, viewMode);
                                                        const taskIsOverdue = isOverdue(task);

                                                        return (
                                                            <motion.div
                                                                key={task.id}
                                                                className={`
                                                                    w-2.5 h-2.5 rounded-full
                                                                    ${dotColor.bg} shadow-md ${dotColor.shadow}
                                                                    ${taskIsOverdue ? 'ring-2 ring-red-500/60' : ''}
                                                                `}
                                                                initial={{ scale: 0 }}
                                                                animate={{ scale: 1 }}
                                                                transition={{ delay: i * 0.05 }}
                                                            />
                                                        );
                                                    })}
                                                    {dayTasks.length > 3 && (
                                                        <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 ml-0.5 bg-gray-100 dark:bg-zinc-700 px-1 rounded">
                                                            +{dayTasks.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Ring of Fire - Glow effect for days with overdue tasks */}
                                            {dayTasks.some(t => isOverdue(t)) && (
                                                <div className="absolute inset-0 rounded-xl bg-red-500/10 dark:bg-red-500/20 ring-2 ring-red-500/60 pointer-events-none" />
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Details Panel (Apple Calendar style side panel) */}
                        <AnimatePresence mode="wait">
                            {selectedDay && (
                                <motion.div
                                    className="w-80 bg-gray-50 dark:bg-zinc-800/50 border-l border-gray-200 dark:border-zinc-700 flex flex-col"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 320, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                >
                                    <div className="p-6 flex-1 overflow-y-auto">
                                        {/* Selected date header */}
                                        <div className="mb-6">
                                            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                                                {selectedDay.toLocaleDateString('en-US', { weekday: 'long' })}
                                            </p>
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                            </h3>
                                        </div>

                                        {/* Tasks list */}
                                        {selectedDayTasks.length === 0 ? (
                                            <div className="text-center py-12">
                                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
                                                    <Clock size={24} className="text-gray-400 dark:text-gray-500" />
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                    No deadlines on this day
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedDayTasks.map((task, index) => {
                                                    const taskTime = task.due_date ? formatTime(task.due_date) : null;
                                                    const dotColor = getTaskDotColor(task, viewMode);
                                                    const taskIsOverdue = isOverdue(task);

                                                    return (
                                                        <motion.div
                                                            key={task.id}
                                                            initial={{ opacity: 0, x: 20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: index * 0.05 }}
                                                        >
                                                            <Link
                                                                to={`/tasks/${task.id}`}
                                                                onClick={onClose}
                                                                className={`
                                                                    block p-4 rounded-2xl transition-all duration-200
                                                                    bg-gray-50 dark:bg-zinc-800/50 border hover:bg-gray-100 dark:hover:bg-zinc-800
                                                                    ${taskIsOverdue
                                                                        ? 'border-red-300 dark:border-red-500/40'
                                                                        : 'border-gray-200 dark:border-zinc-700'
                                                                    }
                                                                `}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    {/* Color indicator - Assignee (org) or Status (personal) with overdue ring */}
                                                                    <div
                                                                        className={`
                                                                            mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0
                                                                            ${dotColor.bg}
                                                                            ${taskIsOverdue ? 'ring-2 ring-red-500/50' : ''}
                                                                        `}
                                                                    />

                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                                            {task.title}
                                                                        </h4>

                                                                        {/* Time display */}
                                                                        {taskTime && (
                                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                                                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                                                    {taskTime}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Status and Overdue badges */}
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            {taskIsOverdue && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                                                                    <AlertCircle size={10} />
                                                                                    Overdue
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                                                                                {task.status.replace('_', ' ')}
                                                                            </span>
                                                                        </div>

                                                                        {/* Assignee - prominent in org view */}
                                                                        {task.users_tasks_assignee_idTousers && (
                                                                            <div className="flex items-center gap-2 mt-3">
                                                                                <div
                                                                                    className={`
                                                                                        w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold
                                                                                        ${getAvatarColorClasses(task.users_tasks_assignee_idTousers.avatar_color || '').bg}
                                                                                        ${getAvatarColorClasses(task.users_tasks_assignee_idTousers.avatar_color || '').text}
                                                                                    `}
                                                                                >
                                                                                    {task.users_tasks_assignee_idTousers.username.charAt(0).toUpperCase()}
                                                                                </div>
                                                                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                                                                    {viewMode === 'org' ? 'Assigned to: ' : ''}{task.users_tasks_assignee_idTousers.username}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </Link>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer summary */}
                                    {selectedDayTasks.length > 0 && (
                                        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                    {selectedDayTasks.length}
                                                </span>{' '}
                                                {selectedDayTasks.length === 1 ? 'deadline' : 'deadlines'} on this day
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Export Confirmation Dialog */}
                    <AnimatePresence>
                        {showExportDialog && (
                            <motion.div
                                className="absolute inset-0 z-10 flex items-center justify-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {/* Dialog Backdrop */}
                                <motion.div
                                    className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-3xl"
                                    onClick={() => setShowExportDialog(false)}
                                />

                                {/* Dialog Content */}
                                <motion.div
                                    className="relative z-10 w-full max-w-md mx-8 p-6 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-zinc-700/50"
                                    initial={{ scale: 0.9, opacity: 0, y: 10 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 10 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                >
                                    {/* Icon */}
                                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                                        <Download size={24} className="text-violet-600 dark:text-violet-400" />
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">
                                        Export to Calendar
                                    </h3>

                                    {/* Message */}
                                    <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-6">
                                        You are about to export{' '}
                                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                                            {exportableTasks.length} task{exportableTasks.length !== 1 ? 's' : ''}
                                        </span>{' '}
                                        from{' '}
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {monthLabel}
                                        </span>{' '}
                                        to a standard .ics file. This snapshot can be imported into Apple Calendar, Google Calendar, or Outlook.
                                    </p>

                                    {/* Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowExportDialog(false)}
                                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleExportConfirm}
                                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/25"
                                        >
                                            Export now
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
