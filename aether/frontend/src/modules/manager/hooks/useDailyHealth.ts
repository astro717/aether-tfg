import { useState, useEffect } from 'react';
import { managerApi } from '../api/managerApi';
import type { DailyTaskHealth, DailyEffortDistribution, TaskHealthStatus } from '../types/analytics';

// ── Activity helper ──────────────────────────────────────────────────────────
// Picks the most recent timestamp across all real activity signals.
const getLastActivity = (task: {
  updated_at?: string;
  latestCommitDate?: string | null;
  latestCommentDate?: string | null;
}): Date => {
  const candidates = [
    task.updated_at ? new Date(task.updated_at).getTime() : 0,
    task.latestCommitDate ? new Date(task.latestCommitDate).getTime() : 0,
    task.latestCommentDate ? new Date(task.latestCommentDate).getTime() : 0,
  ];
  return new Date(Math.max(...candidates));
};

// ── Health rules (strict priority hierarchy) ────────────────────────────────
// 1. BLOCKED   — inactive for > 7 days (abandoned regardless of status)
// 2. AT_RISK   — deadline is today or tomorrow (urgency by time constraint)
// 3. STAGNANT  — in_progress but zero activity today (silent worker)
// 4. HEALTHY   — active today, done, or newly created
const computeHealthStatus = (task: {
  status: string;
  updated_at?: string;
  due_date?: string | null;
  latestCommitDate?: string | null;
  latestCommentDate?: string | null;
}): TaskHealthStatus => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date();
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const lastActivity = getLastActivity(task);
  const deadline = task.due_date ? new Date(task.due_date) : null;

  // 1. BLOCKED: no activity in > 7 days (epoch fallback also triggers this)
  if (task.status !== 'done' && lastActivity < oneWeekAgo) {
    return 'blocked';
  }

  // 2. AT RISK: deadline today or tomorrow (includes overdue) — regardless of activity
  if (deadline && deadline <= tomorrowEnd && task.status !== 'done') {
    return 'at_risk';
  }

  // 3. STAGNANT: in_progress but nothing happened today
  if (task.status === 'in_progress' && lastActivity < todayStart) {
    return 'stagnant';
  }

  // 4. HEALTHY: active today, done today, or recently created
  return 'healthy';
};

// ── AI insight generator ─────────────────────────────────────────────────────
const generateAiInsight = (
  healthStatus: TaskHealthStatus,
  task: {
    updated_at?: string;
    due_date?: string | null;
    latestCommitDate?: string | null;
    latestCommentDate?: string | null;
  },
): string => {
  const lastActivity = getLastActivity(task);
  const now = Date.now();
  const daysInactive = Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  const hoursInactive = Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60));

  switch (healthStatus) {
    case 'blocked':
      return `No activity for ${daysInactive > 0 ? `${daysInactive}d` : `${hoursInactive}h`} — likely blocked by a dependency.`;
    case 'stagnant':
      return 'Marked "In Progress" but no commits or updates today — check in with assignee.';
    case 'at_risk': {
      const deadline = task.due_date ? new Date(task.due_date) : null;
      const hoursUntilDue = deadline
        ? Math.round((deadline.getTime() - now) / (1000 * 60 * 60))
        : null;
      if (hoursUntilDue !== null && hoursUntilDue < 0) {
        return `Overdue by ${Math.abs(hoursUntilDue)}h — requires immediate attention.`;
      }
      return hoursUntilDue !== null
        ? `Deadline in ${hoursUntilDue}h — accelerate progress.`
        : 'Deadline approaching.';
    }
    default:
      return '';
  }
};

export interface UseDailyHealthResult {
  healthData: DailyTaskHealth[];
  distribution: DailyEffortDistribution;
  loading: boolean;
  error: string | null;
}

export const useDailyHealth = (organizationId: string): UseDailyHealthResult => {
  const [healthData, setHealthData] = useState<DailyTaskHealth[]>([]);
  const [distribution, setDistribution] = useState<DailyEffortDistribution>({
    plannedWorkload: 0,
    unplannedWorkload: 0,
    interruptionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use lightweight daily-pulse endpoint instead of heavy analytics
        const data = await managerApi.getDailyPulse(organizationId);

        if (cancelled) return;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const processed: DailyTaskHealth[] = data.recentTasks
          .filter((t) => t.status !== 'done')
          .map((task) => {
            const normalizedTask = { ...task, status: task.status ?? 'unknown' };
            const healthStatus = computeHealthStatus(normalizedTask);
            const lastActivity = getLastActivity(normalizedTask);
            const createdAt = new Date(task.created_at);
            const isUnplanned = createdAt >= todayStart;

            return {
              taskId: task.id,
              title: task.title,
              status: task.status ?? 'unknown',
              assignee: {
                id: task.assigneeId ?? task.assignee,
                username: task.assignee,
                avatarColor: task.assigneeAvatarColor,
              },
              healthStatus,
              lastActivity: lastActivity.getTime() > 0
                ? lastActivity.toISOString()
                : task.created_at,
              aiInsight: generateAiInsight(healthStatus, normalizedTask),
              isUnplanned,
            };
          });

        // Sort: blocked → at_risk → stagnant → healthy
        const PRIORITY: Record<TaskHealthStatus, number> = {
          blocked: 0,
          at_risk: 1,
          stagnant: 2,
          healthy: 3,
        };
        processed.sort((a, b) => PRIORITY[a.healthStatus] - PRIORITY[b.healthStatus]);

        const unplannedCount = processed.filter((t) => t.isUnplanned).length;
        const total = processed.length;
        const interruptionRate = total > 0 ? Math.round((unplannedCount / total) * 100) : 0;

        setHealthData(processed);
        setDistribution({
          plannedWorkload: total - unplannedCount,
          unplannedWorkload: unplannedCount,
          interruptionRate,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load daily health data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [organizationId]);

  return { healthData, distribution, loading, error };
};
