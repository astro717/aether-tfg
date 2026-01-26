import { Check, Flame, AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useKanbanData } from "../hooks/useKanbanData";
import { useOrganization } from "../../organization/context/OrganizationContext";
import type { Task } from "../api/tasksApi";

export function OrganizationView() {
  const { currentOrganization } = useOrganization();
  const { data, loading, error, refetch } = useKanbanData(currentOrganization?.id);

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
            onClick={refetch}
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
    <div className="flex-1 w-full overflow-x-auto overflow-y-hidden flex flex-col h-full">
      <div className="flex items-stretch px-8 pb-8 pt-12 flex-1 h-full">

        {/* To Do Column */}
        <div className="relative z-10 flex-1 min-w-[350px] flex flex-col">
          <KanbanColumn
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
            title="Done"
            total={data.totals.done}
            width="w-full"
            contentOffset="pl-[120px]"
            tasks={data.done}
          />
        </div>

      </div>
    </div>
  );
}

// Update KanbanColumn component
function KanbanColumn({
  title,
  tasks,
  total,
  width = "w-[350px]",
  contentOffset = "",
}: {
  title: string;
  tasks: Task[];
  total: number;
  width?: string;
  contentOffset?: string;
}) {
  return (
    <div className={`flex flex-col ${width} bg-white/40 backdrop-blur-xl rounded-[40px] p-4 border border-white/40 shadow-xl transition-all hover:z-40 h-full`}>

      <h3 className={`text-gray-500 font-medium mb-3 text-lg tracking-wide flex items-center justify-between ${contentOffset}`}>
        {title}
      </h3>

      <div className={`flex-1 space-y-3 overflow-y-auto ${contentOffset}`}>
        {tasks.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <Link to={`/tasks/${task.id}`} key={task.id} className="block group">
              <TaskCard task={task} />
            </Link>
          ))
        )}
      </div>

      <div className={`mt-4 text-gray-400 text-sm font-medium ${contentOffset}`}>
        total <span className="text-gray-500 ml-1">{total}</span>
      </div>
    </div>
  );
}

// Update TaskCard component
function TaskCard({ task }: { task: Task }) {
  const priority = calculatePriority(task.due_date);

  const formattedDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'No deadline';

  const userInitials = task.users_tasks_assignee_idTousers?.username
    ? task.users_tasks_assignee_idTousers.username.substring(0, 1).toUpperCase()
    : '?';

  const userName = task.users_tasks_assignee_idTousers?.username || 'Unassigned';

  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/50 rounded-[24px] p-3 shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-pointer hover:bg-white/95 w-full">

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-bold shadow-sm">
            {userInitials}
          </div>
          <span className="text-xs font-bold text-gray-800 tracking-tight">
            {userName}
          </span>
        </div>

        <div className="text-gray-400">
          {task.status === 'done' && <Check size={14} className="text-gray-400" />}
          {task.status !== 'done' && priority === 'high' && <AlertTriangle size={14} className="text-red-400 fill-red-400/10" />}
          {task.status !== 'done' && priority === 'medium' && <Flame size={14} className="text-yellow-400 fill-yellow-400" />}
          {task.status !== 'done' && priority === 'low' && <MessageCircle size={14} className="text-green-500 fill-green-500" />}
        </div>
      </div>

      <h4 className="text-gray-600 text-[13px] font-medium mb-2 leading-tight pl-1">
        {task.title}
      </h4>

      <div className="flex items-center justify-between pl-1">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
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
