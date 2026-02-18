import type { DailyEffortDistribution } from '../../types/analytics';

interface DailyWorkloadDistributionProps {
  distribution: DailyEffortDistribution;
}

export function DailyWorkloadDistribution({ distribution }: DailyWorkloadDistributionProps) {
  const { plannedWorkload, unplannedWorkload, interruptionRate } = distribution;
  const total = plannedWorkload + unplannedWorkload;
  const plannedPct = total > 0 ? Math.round((plannedWorkload / total) * 100) : 100;
  const unplannedPct = 100 - plannedPct;

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div
        className="relative h-7 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-700/50"
        role="progressbar"
        aria-label={`Workload: ${plannedPct}% planned, ${unplannedPct}% unplanned`}
        aria-valuenow={plannedPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Planned segment */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700 ease-out"
          style={{ width: `${plannedPct}%` }}
        >
          <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-violet-500 opacity-90" />
        </div>

        {/* Unplanned segment */}
        {unplannedPct > 0 && (
          <div
            className="absolute top-0 h-full transition-all duration-700 ease-out"
            style={{ left: `${plannedPct}%`, width: `${unplannedPct}%` }}
          >
            <div className="h-full w-full bg-gradient-to-r from-rose-400 to-rose-600 opacity-90" />
          </div>
        )}

        {/* Divider line between segments */}
        {plannedPct > 0 && unplannedPct > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/70 dark:bg-zinc-900/70"
            style={{ left: `${plannedPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <LegendDot color="indigo" label={`Planned (${plannedPct}%)`} />
          <LegendDot color="rose" label={`Unplanned (${unplannedPct}%)`} />
        </div>
        <InterruptionBadge rate={interruptionRate} />
      </div>

      {/* Tooltip hint */}
      {interruptionRate > 30 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
          High interruption rate — {interruptionRate}% of today's work is reactive.
        </p>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: 'indigo' | 'rose'; label: string }) {
  const dotClass = color === 'indigo'
    ? 'bg-indigo-500'
    : 'bg-rose-500';
  return (
    <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
      <span className={`w-2.5 h-2.5 rounded-sm ${dotClass}`} />
      {label}
    </span>
  );
}

function InterruptionBadge({ rate }: { rate: number }) {
  if (rate <= 15) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium">
        Low interruption
      </span>
    );
  }
  if (rate <= 35) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
        {rate}% interrupted
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-medium">
      ⚠ {rate}% interrupted
    </span>
  );
}
