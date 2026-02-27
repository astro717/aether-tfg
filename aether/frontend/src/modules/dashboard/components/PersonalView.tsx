import { useEffect, useState } from 'react';
import {
    Maximize2,
    Siren,
    Goal,
    Check,
    Coffee
} from "lucide-react";
import { tasksApi, type Task } from '../api/tasksApi';
import { useAuth } from '../../auth/context/AuthContext';
import { getAvatarColorClasses } from '../../../lib/avatarColors';

// --- Helper Utilities ---

function getCurrentWeekDays() {
    const curr = new Date();
    const week: Date[] = [];
    // Start from Monday
    curr.setDate(curr.getDate() - curr.getDay() + 1);
    for (let i = 0; i < 5; i++) {
        week.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }
    return week;
}

function isDateInCurrentWeek(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const weekDays = getCurrentWeekDays();
    const start = weekDays[0];
    const end = weekDays[4];
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
}

function getTaskPriority(dateStr: string | null): 'urgent' | 'important' | 'far-deadline' {
    if (!dateStr) return 'far-deadline';
    const daysUntil = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 3600 * 24));
    if (daysUntil <= 2) return 'urgent';
    if (daysUntil <= 5) return 'important';
    return 'far-deadline';
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getTimelineColor(dateStr: string | null): string {
    const priority = getTaskPriority(dateStr);
    if (priority === 'urgent') return 'border-red-400';
    if (priority === 'important') return 'border-yellow-400';
    return 'border-gray-300';
}

// --- Main Component ---

export function PersonalView() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTasks() {
            try {
                const data = await tasksApi.getMyTasks();
                setTasks(data);
            } catch (error) {
                console.error("Failed to load personal tasks", error);
            } finally {
                setLoading(false);
            }
        }
        loadTasks();
    }, []);

    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const assignedTasks = tasks.filter(t => t.status === 'pending');
    const doneTasks = tasks.filter(t => t.status === 'done');
    const timelineTasks = tasks
        .filter(t => t.due_date && isDateInCurrentWeek(t.due_date))
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

    const weekDays = getCurrentWeekDays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (loading) {
        return (
            <div className="p-8 h-full w-full flex items-center justify-center">
                <span className="text-gray-400 text-lg">Loading...</span>
            </div>
        );
    }

    return (
        <div className="p-8 h-full w-full overflow-hidden flex flex-col">
            <div className="grid grid-cols-12 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-8 h-full w-full">

                {/* --- In Progress Section (Top Left) --- */}
                <section className="col-span-8 row-start-1 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col min-h-0 h-full">
                    <div className="flex items-center justify-between mb-6 flex-shrink-0">
                        <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg">In Progress</h2>
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <Maximize2 size={18} />
                        </button>
                    </div>

                    <div className="space-y-4 overflow-y-auto pr-2 -mr-2 flex-1 min-h-0">
                        {inProgressTasks.length === 0 && (
                            <p className="text-gray-400 text-sm">No tasks in progress</p>
                        )}
                        {inProgressTasks.map((task, idx) => (
                            <InProgressCard
                                key={task.id}
                                task={task}
                                isLast={idx === inProgressTasks.length - 1}
                            />
                        ))}
                    </div>
                </section>

                {/* --- Deadlines Section (Bottom Left) --- */}
                <section className="col-span-8 row-start-2 pt-4 flex flex-col min-h-0 h-full">
                    <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg mb-8 pl-2 flex-shrink-0">Deadlines</h2>

                    {/* Timeline Visualization */}
                    <div className="relative w-full flex-1">
                        {/* Dates Row */}
                        <div className="flex justify-between px-4 text-xs font-medium text-gray-400 dark:text-gray-500 mb-4">
                            {weekDays.map((day) => {
                                const dayDate = new Date(day);
                                dayDate.setHours(0, 0, 0, 0);
                                const isCurrent = dayDate.getTime() === today.getTime();
                                const label = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                return (
                                    <span
                                        key={label}
                                        className={`${isCurrent ? 'bg-red-500 rounded-full px-2 py-1 text-white font-bold shadow-sm' : ''}`}
                                    >
                                        {label}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Timeline Grid Lines */}
                        <div className="absolute top-8 left-0 w-full h-full flex justify-between px-6 pointer-events-none">
                            {weekDays.map((day, index) => {
                                const dayDate = new Date(day);
                                dayDate.setHours(0, 0, 0, 0);
                                const isCurrent = dayDate.getTime() === today.getTime();
                                return (
                                    <div
                                        key={`line-${index}`}
                                        className={`h-full ${isCurrent ? 'border-l-2 border-red-500 w-px z-10' : 'border-l border-dashed border-gray-200 opacity-0'}`}
                                    ></div>
                                );
                            })}
                        </div>

                        {/* Floating Cards */}
                        {timelineTasks.length === 0 && (
                            <p className="text-gray-400 dark:text-gray-500 text-sm pl-4 pt-4">No deadlines this week</p>
                        )}
                        {timelineTasks.map((task, index) => {
                            const date = new Date(task.due_date!);
                            const day = date.getDay(); // 1=Mon, 5=Fri

                            let style: React.CSSProperties = {};
                            if (day <= 2) style = { left: '0' };
                            else if (day === 3) style = { left: '38%' };
                            else style = { right: '0', left: 'auto' };

                            const topOffset = `${3 + (index * 5)}rem`;
                            const colorClass = getTimelineColor(task.due_date);

                            return (
                                <div
                                    key={task.id}
                                    className="absolute"
                                    style={{ top: topOffset, ...style }}
                                >
                                    <div className={`bg-white/80 dark:bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border-l-4 ${colorClass} w-40 flex items-start justify-between gap-2`}>
                                        <span className="text-[10px] text-gray-800 dark:text-gray-200 font-medium leading-tight block">
                                            {task.title}
                                        </span>
                                        {task.status === 'done' && (
                                            <Check size={14} className="text-gray-400 stroke-[2.5px] flex-shrink-0" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* --- Assigned Section (Top Right) --- */}
                <section className="col-span-4 row-start-1 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 dark:border-white/10 shadow-sm flex flex-col min-h-0 h-full">
                    <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg mb-6 flex-shrink-0">Assigned</h2>

                    <div className="space-y-4 overflow-y-auto pr-7 -mr-7 flex-1 min-h-0">
                        {assignedTasks.length === 0 && (
                            <p className="text-gray-400 text-sm">No assigned tasks</p>
                        )}
                        {assignedTasks.map(task => (
                            <AssignedCard key={task.id} task={task} />
                        ))}
                    </div>
                </section>

                {/* --- Awaiting Review Section (Bottom Right) --- */}
                <section className="col-span-4 row-start-2 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 dark:border-white/10 shadow-sm flex flex-col min-h-0 h-full">
                    <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg mb-6 flex-shrink-0">Awaiting Review</h2>

                    <div className="space-y-4 overflow-y-auto pr-2 -mr-2 flex-1 min-h-0">
                        {doneTasks.length === 0 && (
                            <p className="text-gray-400 text-sm">No tasks awaiting review</p>
                        )}
                        {doneTasks.map(task => (
                            <AwaitingReviewCard key={task.id} task={task} />
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}

// --- Sub Components ---

function InProgressCard({ task, isLast }: { task: Task; isLast?: boolean }) {
    const tag = getTaskPriority(task.due_date);
    const date = formatDate(task.due_date);

    const tagStyles = {
        urgent: { bg: "bg-red-100", text: "text-red-500", icon: Siren, label: "urgent" },
        important: { bg: "bg-orange-100", text: "text-orange-500", icon: Goal, label: "important" },
        "far-deadline": { bg: "bg-green-100", text: "text-green-600", icon: Coffee, label: "far deadline" }
    };

    const style = tagStyles[tag];
    const Icon = style.icon;
    const initial = task.users_tasks_assignee_idTousers?.username?.charAt(0).toUpperCase() || 'U';
    const avatarColors = getAvatarColorClasses(task.users_tasks_assignee_idTousers?.avatar_color);

    return (
        <div className={`bg-white/60 dark:bg-white/10 backdrop-blur-lg rounded-[28px] p-4 px-6 flex items-center justify-between shadow-sm border border-white/50 dark:border-white/10 hover:scale-[1.01] transition-transform duration-200 group ${isLast ? '' : ''}`}>
            <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full ${avatarColors.bg} ${avatarColors.text} ${avatarColors.border} flex items-center justify-center text-[10px] font-bold shadow-md`}>
                    {initial}
                </div>
                <span className="text-gray-800 dark:text-gray-200 font-semibold text-sm tracking-tight">{task.title}</span>
            </div>

            <div className="flex items-center gap-6">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${style.bg} ${style.text}`}>
                    <Icon size={12} className="opacity-80 stroke-[2.5px]" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{style.label}</span>
                </div>
                {date && <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{date}</span>}
            </div>
        </div>
    );
}

function AssignedCard({ task }: { task: Task }) {
    const { user } = useAuth();
    const date = formatDate(task.due_date);
    const name = task.users_tasks_assignee_idTousers?.username || 'Me';
    const initial = name.charAt(0).toUpperCase();
    const isAssignedToMe = user && task.assignee_id === user.id;
    const displayName = isAssignedToMe ? `${name} (You)` : name;
    const avatarColors = getAvatarColorClasses(task.users_tasks_assignee_idTousers?.avatar_color);

    return (
        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-lg rounded-[28px] p-4 px-5 shadow-sm border border-white/50 dark:border-white/10 hover:scale-[1.02] transition-all duration-200">
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full ${avatarColors.bg} ${avatarColors.text} ${avatarColors.border} flex items-center justify-center text-[8px] font-bold shadow-sm`}>
                    {initial}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    by <span className="text-gray-800 dark:text-gray-200 font-bold">{displayName}</span>
                </span>
            </div>

            <div className="pl-7">
                <p className="text-gray-600 dark:text-gray-300 text-[13px] font-medium leading-relaxed mb-2">
                    {task.title}
                </p>
                <div className="flex justify-end">
                    {date && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{date}</span>}
                </div>
            </div>
        </div>
    );
}

function AwaitingReviewCard({ task }: { task: Task }) {
    const date = formatDate(task.due_date);

    return (
        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md rounded-[28px] p-4 px-6 shadow-sm border border-white/50 dark:border-white/10 flex items-center justify-between hover:scale-[1.01] transition-transform duration-200 group">
            <div className="flex flex-col justify-center">
                <h3 className="text-gray-800 dark:text-gray-200 font-semibold text-sm tracking-tight leading-snug">{task.title}</h3>
                <div className="mt-1">
                    {date && <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{date}</span>}
                </div>
            </div>

            <button className="w-8 h-8 rounded-full bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-gray-400 hover:text-green-500 transition-colors flex-shrink-0 ml-4">
                <Check size={14} />
            </button>
        </div>
    );
}
