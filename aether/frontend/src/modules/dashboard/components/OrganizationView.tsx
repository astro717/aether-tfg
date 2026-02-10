import { useState, useEffect } from "react";
import { Check, Flame, AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useKanbanData } from "../hooks/useKanbanData";
import { useOrganization } from "../../organization/context/OrganizationContext";
import { useAuth } from "../../auth/context/AuthContext";
import { tasksApi, type Task } from "../api/tasksApi";
import { taskEvents } from "../../../lib/taskEvents";

type ColumnId = 'pending' | 'in_progress' | 'done';

export function OrganizationView() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { data, loading, error, refetch, setData } = useKanbanData(currentOrganization?.id);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Listen for task creation events to refresh Kanban
  useEffect(() => {
    const unsubscribe = taskEvents.onTaskCreated(() => {
      refetch(true); // Silent refetch
    });
    return unsubscribe;
  }, [refetch]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;

    // Find the task across all columns
    const allTasks = [...(data?.pending || []), ...(data?.in_progress || []), ...(data?.done || [])];
    const task = allTasks.find(t => t.id === taskId);

    if (task) {
      setActiveTask(task);
    }
    setPermissionError(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || !data || !user) return;

    const taskId = active.id as string;

    // CRITICAL FIX: Determine target column safely
    const overId = over.id as string;
    let targetColumn: ColumnId | undefined;

    // 1. Is 'over' a Column?
    if (['pending', 'in_progress', 'done'].includes(overId)) {
      targetColumn = overId as ColumnId;
    } else {
      // 2. Is 'over' a Task? Find its column
      if (data.pending.some(t => t.id === overId)) targetColumn = 'pending';
      else if (data.in_progress.some(t => t.id === overId)) targetColumn = 'in_progress';
      else if (data.done.some(t => t.id === overId)) targetColumn = 'done';
    }

    // If we still don't know the column, abort
    if (!targetColumn) return;

    // Find the task
    const allTasks = [...data.pending, ...data.in_progress, ...data.done];
    const task = allTasks.find(t => t.id === taskId);

    if (!task) return;

    // Find current column
    let currentColumn: ColumnId = 'pending';
    if (data.in_progress.some(t => t.id === taskId)) currentColumn = 'in_progress';
    else if (data.done.some(t => t.id === taskId)) currentColumn = 'done';

    // If dropped in the same column, do nothing
    if (currentColumn === targetColumn) return;

    // Permission check: allow move if user is manager OR user is the assignee
    const canMove = user.role === 'manager' || task.assignee_id === user.id;
    if (!canMove) {
      setPermissionError("You can only move tasks assigned to you.");
      setTimeout(() => setPermissionError(null), 3000);
      return;
    }

    // Optimistic update: move task in local state immediately
    const previousData = { ...data };
    const movedTask = { ...task, status: targetColumn };

    setData({
      ...data,
      [currentColumn]: data[currentColumn].filter(t => t.id !== taskId),
      [targetColumn]: [...data[targetColumn], movedTask],
      totals: {
        ...data.totals,
        [currentColumn]: data.totals[currentColumn] - 1,
        [targetColumn]: data.totals[targetColumn] + 1,
      },
    });

    // Sync with backend, revert on failure
    try {
      await tasksApi.updateTask(taskId, { status: targetColumn });
      const newData = await tasksApi.getKanbanData(currentOrganization!.id);

      // Safety net: Check if the moved task is still present in the refetched data
      const allNewTasks = [...newData.pending, ...newData.in_progress, ...newData.done];
      const taskStillExists = allNewTasks.some(t => t.id === taskId);

      if (!taskStillExists) {
        // Task disappeared after refetch - this is a bug, log it and keep optimistic state
        console.error('[OrganizationView] Task disappeared after move!', {
          taskId,
          taskTitle: task.title,
          targetColumn,
          refetchedData: newData
        });
        setPermissionError('Task may not have been saved correctly. Click refresh to reload.');
        setTimeout(() => setPermissionError(null), 5000);
        // Keep the optimistic state since the backend might have actually saved it
        return;
      }

      setData(newData);
    } catch (err) {
      console.error('Failed to update task:', err);
      setData(previousData);
      setPermissionError('Failed to move task. Please try again.');
      setTimeout(() => setPermissionError(null), 3000);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading tasks: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No organization selected
  if (!data) {
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center">
        <p className="text-gray-400">No organization selected</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 w-full overflow-x-auto overflow-y-hidden flex flex-col h-full relative">
        {/* Permission Error Toast */}
        {permissionError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
            {permissionError}
          </div>
        )}

        <div className="flex items-stretch px-8 pb-8 pt-12 flex-1 h-full">
          {/* To Do Column */}
          <div className="relative z-10 flex-1 min-w-[350px] flex flex-col">
            <KanbanColumn
              id="pending"
              title="To Do"
              total={data.totals.pending}
              width="w-full"
              contentOffset="pr-[140px]"
              tasks={data.pending}
            />
          </div>

          {/* In Progress Column */}
          <div className="relative z-30 -ml-[100px] flex-1 min-w-[390px] flex flex-col">
            <KanbanColumn
              id="in_progress"
              title="In Progress"
              total={data.totals.in_progress}
              width="w-full"
              contentOffset="pl-5"
              tasks={data.in_progress}
            />
          </div>

          {/* Done Column */}
          <div className="relative z-10 -ml-[100px] flex-1 min-w-[350px] flex flex-col">
            <KanbanColumn
              id="done"
              title="Done"
              total={data.totals.done}
              width="w-full"
              contentOffset="pl-[120px]"
              tasks={data.done}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Droppable Kanban Column
function KanbanColumn({
  id,
  title,
  tasks,
  total,
  width = "w-[350px]",
  contentOffset = "",
}: {
  id: ColumnId;
  title: string;
  tasks: Task[];
  total: number;
  width?: string;
  contentOffset?: string;
}) {
  return (
    <SortableContext
      id={id}
      items={tasks.map(t => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div
        className={`flex flex-col ${width} bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] p-4 border border-white/40 dark:border-white/10 shadow-xl transition-all hover:z-40 h-full`}
        data-column-id={id}
      >
        <h3 className={`text-gray-500 dark:text-gray-300 font-medium mb-3 text-lg tracking-wide flex items-center justify-between ${contentOffset}`}>
          {title}
        </h3>

        <DroppableArea id={id} contentOffset={contentOffset}>
          {tasks.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              No tasks
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} />
            ))
          )}
        </DroppableArea>

        <div className={`mt-4 text-gray-400 dark:text-gray-500 text-sm font-medium ${contentOffset}`}>
          total <span className="text-gray-500 dark:text-gray-400 ml-1">{total}</span>
        </div>
      </div>
    </SortableContext>
  );
}

// Droppable area component
function DroppableArea({
  id,
  children,
  contentOffset
}: {
  id: ColumnId;
  children: React.ReactNode;
  contentOffset: string;
}) {
  const { setNodeRef, isOver } = useSortable({
    id,
    data: { type: 'column' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 space-y-3 overflow-y-auto ${contentOffset} min-h-[100px] transition-colors ${
        isOver ? 'bg-blue-50/30 dark:bg-blue-500/10 rounded-2xl' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Sortable Task Card wrapper
function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link to={`/tasks/${task.id}`} className="block group">
        <TaskCard task={task} />
      </Link>
    </div>
  );
}

// Task Card component - Clean design: Title, Avatar, Date, Priority only
function TaskCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  const { user } = useAuth();
  const priority = calculatePriority(task.due_date);

  const formattedDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'No deadline';

  const userInitials = task.users_tasks_assignee_idTousers?.username
    ? task.users_tasks_assignee_idTousers.username.substring(0, 1).toUpperCase()
    : '?';

  const userName = task.users_tasks_assignee_idTousers?.username || 'Unassigned';
  const isAssignedToMe = user && task.assignee_id === user.id;
  const displayName = isAssignedToMe ? `${userName} (You)` : userName;

  return (
    <div className={`bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[24px] p-3 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-pointer hover:bg-white/95 dark:hover:bg-white/15 w-full ${
      isDragging ? 'shadow-xl scale-105 rotate-2' : ''
    }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[9px] font-bold shadow-sm">
            {userInitials}
          </div>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 tracking-tight">
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority/Status indicator only - Task ID removed for cleaner Kanban view */}
          <div className="text-gray-400">
            {task.status === 'done' && <Check size={14} className="text-gray-400" />}
            {task.status !== 'done' && priority === 'high' && <AlertTriangle size={14} className="text-red-400 fill-red-400/10" />}
            {task.status !== 'done' && priority === 'medium' && <Flame size={14} className="text-yellow-400 fill-yellow-400" />}
            {task.status !== 'done' && priority === 'low' && <MessageCircle size={14} className="text-green-500 fill-green-500" />}
          </div>
        </div>
      </div>

      <h4 className="text-gray-600 dark:text-gray-300 text-[13px] font-medium mb-2 leading-tight pl-1">
        {task.title}
      </h4>

      <div className="flex items-center justify-between pl-1">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
          {formattedDate}
        </span>
      </div>
    </div>
  );
}

// Priority calculation helper
function calculatePriority(dueDate: string | null): 'high' | 'medium' | 'low' {
  if (!dueDate) return 'low';

  const now = new Date();
  const deadline = new Date(dueDate);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'high'; // Overdue
  if (diffDays <= 3) return 'high';
  if (diffDays <= 7) return 'medium';
  return 'low';
}
