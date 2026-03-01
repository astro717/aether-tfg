import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, AlertCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Task } from '../api/tasksApi';
import { getAvatarColorClasses } from '../../../lib/avatarColors';

interface PremiumCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
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

function isOverdue(dueDate: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
}

function isDueSoon(dueDate: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 2;
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

export function PremiumCalendarModal({ isOpen, onClose, tasks }: PremiumCalendarModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });

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

    // Calendar data
    const monthData = useMemo(() => {
        return getMonthData(currentMonth.year, currentMonth.month);
    }, [currentMonth]);

    const monthLabel = useMemo(() => {
        const date = new Date(currentMonth.year, currentMonth.month, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [currentMonth]);

    // Tasks for selected day, sorted by time
    const selectedDayTasks = useMemo(() => {
        if (!selectedDay) return [];
        return getTasksForDay(tasks, selectedDay)
            .filter(t => t.status !== 'done')
            .sort((a, b) => {
                if (!a.due_date || !b.due_date) return 0;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            });
    }, [selectedDay, tasks]);

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
                                    <button
                                        onClick={onClose}
                                        className="ml-4 p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
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
                                    const dayTasks = getTasksForDay(tasks, day).filter(t => t.status !== 'done');
                                    const isToday = isSameDay(day, today);
                                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                                    const hasOverdue = dayTasks.some(t => t.due_date && isOverdue(t.due_date));
                                    const hasDueSoon = dayTasks.some(t => t.due_date && isDueSoon(t.due_date) && !isOverdue(t.due_date));
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

                                            {/* Task indicators */}
                                            {dayTasks.length > 0 && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    {dayTasks.slice(0, 3).map((task, i) => {
                                                        const isTaskOverdue = task.due_date && isOverdue(task.due_date);
                                                        const isTaskSoon = task.due_date && isDueSoon(task.due_date) && !isTaskOverdue;

                                                        return (
                                                            <motion.div
                                                                key={task.id}
                                                                className={`
                                                                    w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900
                                                                    ${isTaskOverdue
                                                                        ? 'bg-red-500 shadow-md shadow-red-500/60'
                                                                        : isTaskSoon
                                                                            ? 'bg-amber-500 shadow-md shadow-amber-500/60'
                                                                            : 'bg-violet-500 shadow-md shadow-violet-500/40'
                                                                    }
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

                                            {/* Glow effect for urgent days */}
                                            {hasOverdue && (
                                                <div className="absolute inset-0 rounded-xl bg-red-500/10 dark:bg-red-500/20 pointer-events-none" />
                                            )}
                                            {!hasOverdue && hasDueSoon && (
                                                <div className="absolute inset-0 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 pointer-events-none" />
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
                                                    const isTaskOverdue = task.due_date && isOverdue(task.due_date);
                                                    const isTaskSoon = task.due_date && isDueSoon(task.due_date) && !isTaskOverdue;
                                                    const taskTime = task.due_date ? formatTime(task.due_date) : null;

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
                                                                    ${isTaskOverdue
                                                                        ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20'
                                                                        : isTaskSoon
                                                                            ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                                                                            : 'bg-white dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700'
                                                                    }
                                                                `}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    {/* Status indicator */}
                                                                    <div
                                                                        className={`
                                                                            mt-1 w-2 h-2 rounded-full flex-shrink-0
                                                                            ${isTaskOverdue
                                                                                ? 'bg-red-500'
                                                                                : isTaskSoon
                                                                                    ? 'bg-amber-500'
                                                                                    : 'bg-violet-500'
                                                                            }
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

                                                                        {/* Status badge */}
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            {isTaskOverdue && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                                                                    <AlertCircle size={10} />
                                                                                    Overdue
                                                                                </span>
                                                                            )}
                                                                            {isTaskSoon && !isTaskOverdue && (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                                                    <Clock size={10} />
                                                                                    Due Soon
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                                                                                {task.status.replace('_', ' ')}
                                                                            </span>
                                                                        </div>

                                                                        {/* Assignee */}
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
                                                                                    {task.users_tasks_assignee_idTousers.username}
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
                </motion.div>
            )}
        </AnimatePresence>
    );
}
