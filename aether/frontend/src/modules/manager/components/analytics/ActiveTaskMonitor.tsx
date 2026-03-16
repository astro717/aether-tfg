import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { DailyTaskHealth, TaskHealthStatus } from '../../types/analytics';
import { UserAvatar } from '../../../../components/ui/UserAvatar';
import { formatRelativeTime } from '../../../../utils/time';

// ── Health status config ────────────────────────────────────────────────────
// accent: absolutely-positioned 3px left strip (independent of card border)
// badge: secondary signal — only shown for non-healthy states
const HEALTH_CONFIG: Record<
  TaskHealthStatus,
  { accent: string; badge: string; label: string }
> = {
  healthy: {
    accent: 'bg-emerald-400 dark:bg-emerald-500',
    badge: '',
    label: '',
  },
  at_risk: {
    accent: 'bg-orange-400 dark:bg-orange-500',
    badge: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
    label: 'At Risk',
  },
  stagnant: {
    accent: 'bg-amber-400 dark:bg-amber-500',
    badge: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    label: 'Stagnant',
  },
  blocked: {
    accent: 'bg-red-400 dark:bg-red-500',
    badge: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    label: 'Blocked',
  },
};

// ── Task Health Card ────────────────────────────────────────────────────────
function HealthCard({ task }: { task: DailyTaskHealth }) {
  const navigate = useNavigate();
  const config = HEALTH_CONFIG[task.healthStatus];
  const isHealthy = task.healthStatus === 'healthy';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/tasks/${task.taskId}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/tasks/${task.taskId}`)}
      className="
        group relative flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-xl cursor-pointer
        bg-white/80 dark:bg-zinc-700/30
        border border-gray-100/60 dark:border-zinc-700/30
        hover:bg-white dark:hover:bg-zinc-700/50
        hover:border-gray-200/60 dark:hover:border-zinc-600/40
        active:scale-[0.995]
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0
      "
    >
      {/* Left health accent — 3px strip, independent of card border */}
      <div className={`absolute left-0 inset-y-0 w-[3px] rounded-l-xl ${config.accent}`} />

      {/* Avatar — xs so the title leads, avatar supports */}
      <UserAvatar
        username={task.assignee.username}
        avatarColor={task.assignee.avatarColor}
        size="xs"
        className="flex-shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* Row 1: title + badges (inline, no wrap) */}
        <div className="flex items-center gap-1.5 flex-nowrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {task.title}
          </p>
          {!isHealthy && config.badge && (
            <span className={`text-[10px] font-semibold px-1.5 py-px rounded-md flex-shrink-0 ${config.badge}`}>
              {config.label}
            </span>
          )}
          {task.isUnplanned && (
            <span className="text-[10px] font-semibold px-1.5 py-px rounded-md flex-shrink-0 bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
              new
            </span>
          )}
        </div>

        {/* Row 2: assignee · timestamp */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            {task.assignee.username}
          </span>
          <span className="text-gray-200 dark:text-zinc-700">·</span>
          <span className="text-xs text-gray-300 dark:text-zinc-600">
            {formatRelativeTime(task.lastActivity)}
          </span>
        </div>

        {/* Status hint — hidden at rest, revealed on hover via CSS grid trick */}
        {task.statusHint && (
          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out">
            <div className="overflow-hidden">
              <p className="pt-1 text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed italic">
                {task.statusHint}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function ActiveTaskMonitor({ tasks }: { tasks: DailyTaskHealth[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-500/20 mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All Clear</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          No active tasks to monitor right now. Enjoy the calm!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {tasks.map((task) => (
        <HealthCard key={task.taskId} task={task} />
      ))}
    </div>
  );
}
