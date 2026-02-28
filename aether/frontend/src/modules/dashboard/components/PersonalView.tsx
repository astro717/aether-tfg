import { useEffect, useState, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    useDroppable,
    useDraggable,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    Siren,
    Goal,
    Coffee
} from "lucide-react";
import { Link } from 'react-router-dom';
import { tasksApi, type Task } from '../api/tasksApi';
import { useAuth } from '../../auth/context/AuthContext';
import { getAvatarColorClasses } from '../../../lib/avatarColors';
import { PersonalPulse } from './PersonalPulse';

// --- Helper Utilities ---

function getCurrentWeekDays() {
    const curr = new Date();
    const week: Date[] = [];
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

// --- Droppable Wrapper ---

interface DroppableProps {
    id: string;
    children: React.ReactNode;
    className?: string;
    activeClassName?: string;
}

function Droppable({ id, children, className = '', activeClassName = '' }: DroppableProps) {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`${className} ${isOver ? activeClassName : ''} transition-all duration-300`}
        >
            {children}
        </div>
    );
}

// --- Draggable Task Card Wrapper ---

interface DraggableTaskProps {
    id: string;
    children: React.ReactNode;
    disabled?: boolean;
}

function DraggableTask({ id, children, disabled = false }: DraggableTaskProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        disabled,
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {children}
        </div>
    );
}

// --- Main Component ---

export function PersonalView() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [pulseKey, setPulseKey] = useState(0); // Key to force pulse refresh

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px drag before activating
            },
        })
    );

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

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const task = tasks.find(t => t.id === active.id);
        if (task) {
            setActiveTask(task);
        }
    }, [tasks]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);

        if (!over) return;

        const taskId = active.id as string;
        const targetStatus = over.id as string;
        const task = tasks.find(t => t.id === taskId);

        if (!task) return;

        // Map droppable IDs to task statuses
        const statusMap: Record<string, Task['status']> = {
            'in_progress': 'in_progress',
            'pending': 'pending',
            'done': 'done',
        };

        const newStatus = statusMap[targetStatus];
        if (!newStatus) return;

        // Check if status actually changed
        const currentStatus = task.status;
        const normalizedCurrent = (currentStatus === 'todo' || currentStatus === 'pending') ? 'pending' : currentStatus;
        if (normalizedCurrent === targetStatus) return;

        // Optimistic update
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
        ));

        try {
            // API call
            await tasksApi.updateTask(taskId, { status: newStatus });

            // If moved to done, refresh pulse KPIs
            if (newStatus === 'done') {
                setPulseKey(k => k + 1);
            }
        } catch (error) {
            console.error('Failed to update task status', error);
            // Rollback on error
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, status: currentStatus } : t
            ));
        }
    }, [tasks]);

    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const assignedTasks = tasks.filter(t => t.status === 'pending' || t.status === 'todo');
    const timelineTasks = tasks
        .filter(t => t.due_date && isDateInCurrentWeek(t.due_date) && t.status !== 'done')
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
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="p-8 h-full w-full overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-8 h-full w-full">

                    {/* --- In Progress Section (Top Left) --- */}
                    <Droppable
                        id="in_progress"
                        className="col-span-8 row-start-1 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col min-h-0 h-full"
                        activeClassName="ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent bg-blue-50/20 dark:bg-blue-500/10"
                    >
                        <div className="flex items-center justify-between mb-6 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg">In Progress</h2>
                                <span className="bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full ring-1 ring-black/5 dark:ring-white/10">
                                    {inProgressTasks.length}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4 overflow-y-auto px-2 -mx-2 pb-4 -mb-4 flex-1 min-h-0">
                            {inProgressTasks.length === 0 && (
                                <p className="text-gray-400 text-sm">No tasks in progress</p>
                            )}
                            {inProgressTasks.map((task, idx) => (
                                <DraggableTask key={task.id} id={task.id}>
                                    <Link to={`/tasks/${task.id}`} className="block outline-none">
                                        <InProgressCard
                                            task={task}
                                            isLast={idx === inProgressTasks.length - 1}
                                        />
                                    </Link>
                                </DraggableTask>
                            ))}
                        </div>
                    </Droppable>

                    {/* --- Deadlines Section (Bottom Left) --- */}
                    <section className="col-span-8 row-start-2 pt-4 flex flex-col min-h-0 h-full">
                        <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg mb-8 pl-2 flex-shrink-0">Deadlines</h2>

                        {/* Timeline Visualization */}
                        <div className="relative w-full flex-1">
                            {/* Dates Row */}
                            <div className="grid grid-cols-5 text-xs font-medium text-gray-400 dark:text-gray-500 mb-4">
                                {weekDays.map((day) => {
                                    const dayDate = new Date(day);
                                    dayDate.setHours(0, 0, 0, 0);
                                    const isCurrent = dayDate.getTime() === today.getTime();
                                    const label = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                    return (
                                        <div key={label} className="flex justify-center">
                                            <span
                                                className={`${isCurrent ? 'bg-red-500 rounded-full px-2 py-1 text-white font-bold shadow-sm' : ''}`}
                                            >
                                                {label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Timeline Grid Lines */}
                            <div className="absolute top-8 left-0 w-full h-full grid grid-cols-5 pointer-events-none">
                                {weekDays.map((day, index) => {
                                    const dayDate = new Date(day);
                                    dayDate.setHours(0, 0, 0, 0);
                                    const isCurrent = dayDate.getTime() === today.getTime();
                                    return (
                                        <div
                                            key={`line-${index}`}
                                            className="flex justify-center"
                                        >
                                            <div
                                                className={`h-full ${isCurrent ? 'border-l-2 border-red-500/80' : 'border-l border-dashed border-gray-200 opacity-0'}`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Floating Cards */}
                            {timelineTasks.length === 0 && (
                                <p className="text-gray-400 dark:text-gray-500 text-sm pl-4 pt-4">No deadlines this week</p>
                            )}
                            {timelineTasks.map((task, index) => {
                                const date = new Date(task.due_date!);
                                const day = date.getDay();

                                let style: React.CSSProperties = {};
                                if (day <= 2) style = { left: '0' };
                                else if (day === 3) style = { left: '38%' };
                                else style = { right: '0', left: 'auto' };

                                const topOffset = `${3 + (index * 5)}rem`;
                                const colorClass = getTimelineColor(task.due_date);

                                return (
                                    <DraggableTask key={task.id} id={task.id}>
                                        <div
                                            className="absolute"
                                            style={{ top: topOffset, ...style }}
                                        >
                                            <Link to={`/tasks/${task.id}`} className="block outline-none">
                                                <div className={`bg-white/80 dark:bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border-l-4 ${colorClass} w-40 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing`}>
                                                    <span className="text-[10px] text-gray-800 dark:text-gray-200 font-medium leading-tight block">
                                                        {task.title}
                                                    </span>
                                                </div>
                                            </Link>
                                        </div>
                                    </DraggableTask>
                                );
                            })}
                        </div>
                    </section>

                    {/* --- Assigned Section (Top Right) --- */}
                    <Droppable
                        id="pending"
                        className="col-span-4 row-start-1 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 dark:border-white/10 shadow-sm flex flex-col min-h-0 h-full"
                        activeClassName="ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent bg-violet-50/20 dark:bg-violet-500/10"
                    >
                        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                            <h2 className="text-gray-500 dark:text-gray-300 font-medium text-lg">Assigned</h2>
                            <span className="bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full ring-1 ring-black/5 dark:ring-white/10">
                                {assignedTasks.length}
                            </span>
                        </div>

                        <div className="space-y-4 overflow-y-auto px-2 -mx-2 pb-4 -mb-4 flex-1 min-h-0">
                            {assignedTasks.length === 0 && (
                                <p className="text-gray-400 text-sm">No assigned tasks</p>
                            )}
                            {assignedTasks.map(task => (
                                <DraggableTask key={task.id} id={task.id}>
                                    <Link to={`/tasks/${task.id}`} className="block outline-none">
                                        <AssignedCard task={task} />
                                    </Link>
                                </DraggableTask>
                            ))}
                        </div>
                    </Droppable>

                    {/* --- Personal Pulse Section (Bottom Right) - THE DONE DROP ZONE --- */}
                    <Droppable
                        id="done"
                        className="col-span-4 row-start-2 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 dark:border-white/10 shadow-sm flex flex-col min-h-0 h-full"
                        activeClassName="ring-4 ring-emerald-400 ring-offset-4 ring-offset-transparent bg-emerald-50/30 dark:bg-emerald-500/20 scale-[1.02] shadow-lg shadow-emerald-500/20"
                    >
                        <PersonalPulse key={pulseKey} />
                    </Droppable>

                </div>
            </div>

            {/* Drag Overlay - floating preview while dragging */}
            <DragOverlay>
                {activeTask ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl border-2 border-violet-400 transform rotate-3 scale-105">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {activeTask.title}
                        </span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
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
        <div className={`bg-white/60 dark:bg-white/10 backdrop-blur-lg rounded-[28px] p-4 px-6 flex items-center justify-between shadow-sm border border-white/50 dark:border-white/10 hover:scale-[1.01] hover:shadow-md transition-all duration-200 group cursor-grab active:cursor-grabbing ${isLast ? '' : ''}`}>
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
        <div className="bg-white/60 dark:bg-white/10 backdrop-blur-lg rounded-[28px] p-4 px-5 shadow-sm border border-white/50 dark:border-white/10 hover:scale-[1.02] hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing group">
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
