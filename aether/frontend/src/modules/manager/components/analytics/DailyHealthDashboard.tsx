import { Loader2, AlertTriangle, Brain } from 'lucide-react';
import { useDailyHealth } from '../../hooks/useDailyHealth';
import { DailyWorkloadDistribution } from './DailyWorkloadDistribution';
import { ActiveTaskMonitor } from './ActiveTaskMonitor';
import { InfoTooltip, type InfoTooltipContent } from '../charts';

interface DailyHealthDashboardProps {
  organizationId: string;
}

// Summary stat for the header row
function PulseStat({
  label,
  value,
  color,
  infoTooltip,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'red' | 'violet';
  infoTooltip?: InfoTooltipContent;
}) {
  const colorMap = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    violet: 'text-violet-600 dark:text-violet-400',
  };
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold tabular-nums ${colorMap[color]}`}>{value}</p>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        {infoTooltip && <InfoTooltip content={infoTooltip} size="sm" />}
      </div>
    </div>
  );
}

export function DailyHealthDashboard({ organizationId }: DailyHealthDashboardProps) {
  const { healthData, distribution, loading, error } = useDailyHealth(organizationId);

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
      </div>
    );
  }

  const healthy = healthData.filter((t) => t.healthStatus === 'healthy').length;
  const atRisk = healthData.filter((t) => t.healthStatus === 'at_risk').length;
  const blocked = healthData.filter((t) => t.healthStatus === 'blocked').length;
  const stagnant = healthData.filter((t) => t.healthStatus === 'stagnant').length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Daily Team Pulse
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time health of active work today
          </p>
        </div>
        {/* AI badge */}
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300">
          <Brain className="w-3 h-3" />
          AI Real-time Analysis
        </span>
      </div>

      {/* ── Pulse Stats ── */}
      {healthData.length > 0 && (
        <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-700/50">
          <PulseStat
            label="Healthy"
            value={healthy}
            color="emerald"
            infoTooltip={{
              title: 'Healthy Tasks',
              description: 'Tasks progressing at a good pace with recent activity (commits, comments, or status changes) and sufficient margin before their deadline.',
            }}
          />
          <PulseStat
            label="Stagnant"
            value={stagnant}
            color="amber"
            infoTooltip={{
              title: 'Stagnant Tasks',
              description: 'Tasks that remain assigned or in progress but have not recorded any advancement or interaction in the last 3 business days.',
            }}
          />
          <PulseStat
            label="At Risk"
            value={atRisk}
            color="red"
            infoTooltip={{
              title: 'At Risk',
              description: 'Tasks whose deadline expires in less than 48 hours or that present a high complexity level relative to the team\'s usual cycle time.',
            }}
          />
          <PulseStat
            label="Blocked"
            value={blocked}
            color="red"
            infoTooltip={{
              title: 'Blocked Tasks',
              description: 'Tasks explicitly marked as blocked by the assignee due to external dependencies, lack of definition, or insurmountable technical impediments.',
            }}
          />
        </div>
      )}

      {/* ── Workload Distribution ── */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Today's Effort Distribution
        </p>
        <DailyWorkloadDistribution distribution={distribution} />
      </div>

      {/* ── Active Task Monitor ── */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Active Work Monitor
        </p>
        <ActiveTaskMonitor tasks={healthData} />
      </div>
    </div>
  );
}
