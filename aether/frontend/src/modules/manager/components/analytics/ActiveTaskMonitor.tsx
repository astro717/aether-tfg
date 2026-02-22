import type { DailyTaskHealth, TaskHealthStatus } from '../../types/analytics';
import { UserAvatar } from '../../../../components/ui/UserAvatar';

interface ActiveTaskMonitorProps {
  tasks: DailyTaskHealth[];
}

// ── Relative time helper ────────────────────────────────────────────────────
function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// ── Health status config ────────────────────────────────────────────────────
const HEALTH_CONFIG: Record<
  TaskHealthStatus,
  { border: string; badge: string; dot: string; label: string }
> = {
  healthy: {
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Healthy',
  },
  at_risk: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'At Risk',
  },
  stagnant: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'Stagnant',
  },
  blocked: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Blocked',
  },
};

// ── Task Health Card ────────────────────────────────────────────────────────
function HealthCard({ task }: { task: DailyTaskHealth }) {
  const config = HEALTH_CONFIG[task.healthStatus];

  return (
    <div
      className={`
        group relative flex items-start gap-3 p-3 rounded-xl
        bg-white/50 dark:bg-zinc-800/50
        border border-l-4 border-gray-100 dark:border-zinc-700/50
        ${config.border}
        hover:bg-white/80 dark:hover:bg-zinc-800/80
        transition-all duration-200
        hover:shadow-sm
      `}
    >
      {/* Avatar */}
      <UserAvatar username={task.assignee.username} avatarColor={task.assignee.avatarColor} size="sm" className="flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {task.title}
          </p>
          {/* Health badge */}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${config.badge}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.dot} mr-1`} />
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {task.assignee.username}
          </span>
          <span className="text-gray-300 dark:text-zinc-600">·</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(task.lastActivity)}
          </span>
          {task.isUnplanned && (
            <>
              <span className="text-gray-300 dark:text-zinc-600">·</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                unplanned
              </span>
            </>
          )}
        </div>

        {/* AI Insight */}
        {task.aiInsight && (
          <p className="mt-1.5 text-xs italic text-gray-500 dark:text-gray-400 leading-relaxed">
            <span className="not-italic font-medium text-violet-500 dark:text-violet-400">AI: </span>
            {task.aiInsight}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function ActiveTaskMonitor({ tasks }: ActiveTaskMonitorProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All Clear</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          No active tasks to monitor right now. Enjoy the calm!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1 premium-scrollbar-hover">
      {tasks.map((task) => (
        <HealthCard key={task.taskId} task={task} />
      ))}
    </div>
  );
}
