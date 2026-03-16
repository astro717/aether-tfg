import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useDailyHealth } from '../../hooks/useDailyHealth';
import { DailyWorkloadDistribution } from './DailyWorkloadDistribution';
import { ActiveTaskMonitor } from './ActiveTaskMonitor';
import { UserAvatar } from '../../../../components/ui/UserAvatar';
import { formatRelativeTime } from '../../../../utils/time';
import type { DailyTaskHealth } from '../../types/analytics';

interface DailyHealthDashboardProps {
  organizationId: string;
}

// ── Completed Today section ───────────────────────────────────────────────────
function CompletedTodaySection({ tasks }: { tasks: DailyTaskHealth[] }) {
  const navigate = useNavigate();

  if (tasks.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
        Completed Today — {tasks.length} delivered
      </p>
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div
            key={task.taskId}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/tasks/${task.taskId}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/tasks/${task.taskId}`)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer
              bg-emerald-50/60 dark:bg-emerald-500/[0.06]
              border border-emerald-100 dark:border-emerald-500/20
              hover:bg-emerald-50 dark:hover:bg-emerald-500/10
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <UserAvatar
              username={task.assignee.username}
              avatarColor={task.assignee.avatarColor}
              size="xs"
              className="shrink-0"
            />
            <p className="flex-1 text-sm font-medium text-gray-800 dark:text-white/80 truncate">
              {task.title}
            </p>
            <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">
              {task.assignee.username}
            </span>
            <span className="text-gray-200 dark:text-zinc-700 shrink-0">·</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">
              {formatRelativeTime(task.lastActivity)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DailyHealthDashboard({ organizationId }: DailyHealthDashboardProps) {
  const { healthData, completedToday, distribution, loading, error } = useDailyHealth(organizationId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Analyzing team pulse…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="p-3 rounded-full bg-red-100 dark:bg-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-violet-500 dark:text-violet-400 hover:underline"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Completed Today ── */}
      {completedToday.length > 0 && (
        <>
          <CompletedTodaySection tasks={completedToday} />
          <div className="border-t border-gray-100 dark:border-zinc-700/50" />
        </>
      )}

      {/* ── Active Work Monitor ── */}
      <ActiveTaskMonitor tasks={healthData} />

      {/* ── Effort Distribution — compact, at bottom ── */}
      <div className="border-t border-gray-100 dark:border-zinc-700/50 pt-5">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3">
          Effort distribution
        </p>
        <DailyWorkloadDistribution distribution={distribution} />
      </div>
    </div>
  );
}
