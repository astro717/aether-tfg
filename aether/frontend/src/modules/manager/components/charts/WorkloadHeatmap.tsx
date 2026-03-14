/**
 * WorkloadHeatmap Component — Premium redesign
 * GitHub-style matrix heatmap for team activity
 * Design: Y-axis = Users, X-axis = Days, Color = Intensity
 */

import { UserAvatar } from '../../../../components/ui/UserAvatar';
import { InfoTooltip } from './InfoTooltip';

interface HeatmapData {
  users: string[];
  days: string[];
  data: number[][]; // 2D array: data[userIndex][dayIndex] = activity score
}

interface WorkloadHeatmapProps {
  data: HeatmapData;
  userColors?: Record<string, string>;
  title?: string;
  subtitle?: string;
}

// Color intensity scale (indigo ramp — matches app accent)
const getHeatmapColor = (value: number): string => {
  if (value === 0) return 'bg-gray-100/80 dark:bg-zinc-800/60';
  if (value <= 3) return 'bg-indigo-100 dark:bg-indigo-950/80';
  if (value <= 6) return 'bg-indigo-300 dark:bg-indigo-700/70';
  if (value <= 9) return 'bg-indigo-500 dark:bg-indigo-500';
  return 'bg-indigo-700 dark:bg-indigo-400';
};

const getHeatmapGlow = (value: number): string => {
  if (value > 9) return 'shadow-[0_0_8px_rgba(99,102,241,0.5)]';
  if (value > 6) return 'shadow-[0_0_4px_rgba(99,102,241,0.3)]';
  return '';
};


const LEGEND_STEPS = [
  { label: '0', color: 'bg-gray-100/80 dark:bg-zinc-800/60' },
  { label: '1–3', color: 'bg-indigo-100 dark:bg-indigo-950/80' },
  { label: '4–6', color: 'bg-indigo-300 dark:bg-indigo-700/70' },
  { label: '7–9', color: 'bg-indigo-500 dark:bg-indigo-500' },
  { label: '10+', color: 'bg-indigo-700 dark:bg-indigo-400' },
];

export function WorkloadHeatmap({
  data,
  userColors = {},
  title = 'Team Workload',
  subtitle = 'Activity intensity per user per day',
}: WorkloadHeatmapProps) {
  // Per-user totals for the summary column
  const userTotals = data.users.map((_, i) =>
    (data.data[i] ?? []).reduce((sum, v) => sum + v, 0)
  );
  const maxTotal = Math.max(...userTotals, 1);

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm overflow-hidden"
      data-chart-id="workload-heatmap"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{title}</p>
            <InfoTooltip
              size="sm"
              content={{
                title: 'Team Workload Heatmap',
                description: (
                <>
                  Each cell represents one person&apos;s activity on a given day — tasks created, moved, or completed.{' '}
                  <span className="text-indigo-400 font-medium">More vivid indigo cells</span> mean higher intensity. Scan vertically to spot overloaded individuals, and horizontally to find idle days or delivery bottlenecks.
                </>
              ),
              }}
            />
          </div>
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
              {userTotals.reduce((a, b) => a + b, 0)}
            </span>
            <span className="text-sm text-gray-400 dark:text-zinc-500">total actions</span>
          </div>
        </div>
        {/* Activity badge */}
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Grid area — three-column layout: left fixed | center scrollable | right fixed */}
      {/* Outer wrapper handles vertical scroll (scrollbar appears at far right, after totals) */}
      <div className="px-5 pb-5 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
      <div className="flex">

        {/* LEFT: fixed user column */}
        <div className="flex-shrink-0 w-36">
          {/* Header spacer */}
          <div className="h-8 mb-2" />
          {/* User rows */}
          {data.users.map((user, userIdx) => (
            <div key={userIdx} className="h-8 mb-2 flex items-center gap-1.5 pr-3">
              <span className="text-xs text-gray-300 dark:text-white/20 w-4 text-right tabular-nums shrink-0">
                {userIdx + 1}
              </span>
              <UserAvatar
                username={user}
                avatarColor={userColors[user]}
                size="xs"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate leading-none">
                {user}
              </span>
            </div>
          ))}
        </div>

        {/* CENTER: horizontal-only scrollable cells */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 pl-0.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
          <div className="inline-block">
            {/* Day headers */}
            <div className="flex gap-1.5 mb-2">
              {data.days.map((day, idx) => {
                let label: string | number = day;
                if (day.includes(':')) {
                  const hour = parseInt(day.split(':')[0], 10);
                  label = isNaN(hour) ? day : hour;
                } else if (day.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const date = new Date(day + 'T00:00:00');
                  const dayNum = date.getDate();
                  label = isNaN(dayNum) ? day : dayNum;
                } else if (day.startsWith('W') || day.length <= 3) {
                  label = day;
                } else {
                  const date = new Date(day);
                  const dayNum = date.getDate();
                  label = isNaN(dayNum) ? day : dayNum;
                }
                return (
                  <div
                    key={idx}
                    className="w-8 h-8 flex items-center justify-center text-[11px] font-medium text-gray-400 dark:text-zinc-500"
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Cell rows */}
            {data.users.map((user, userIdx) => {
              const peakDay = (data.data[userIdx] ?? []).indexOf(
                Math.max(...(data.data[userIdx] ?? [0]))
              );
              return (
                <div key={userIdx} className="flex gap-1.5 mb-2">
                  {(data.data[userIdx] ?? []).map((value, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`
                        w-8 h-8 rounded-[5px]
                        ${getHeatmapColor(value)}
                        ${getHeatmapGlow(value)}
                        transition-all duration-150
                        hover:scale-125 hover:z-10 hover:ring-2 hover:ring-indigo-400/70 hover:ring-offset-1 hover:ring-offset-white dark:hover:ring-offset-zinc-900
                        cursor-pointer relative group/cell
                        ${dayIdx === peakDay && value > 0 ? 'ring-1 ring-indigo-400/50 dark:ring-indigo-500/40' : ''}
                      `}
                    >
                      {/* Tooltip */}
                      <div className="absolute hidden group-hover/cell:flex bottom-full mb-2 left-1/2 -translate-x-1/2 flex-col items-center z-20 pointer-events-none">
                        <div className="bg-gray-900/95 dark:bg-zinc-800 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10">
                          <span className="text-gray-400">{data.days[dayIdx]}</span>
                          <span className="mx-1.5 text-gray-600">·</span>
                          <span className="text-indigo-300">{value}</span>
                          <span className="text-gray-400 ml-1">{value === 1 ? 'task' : 'tasks'}</span>
                        </div>
                        <div className="w-1.5 h-1.5 bg-gray-900/95 dark:bg-zinc-800 rotate-45 -mt-1 border-b border-r border-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: fixed totals column */}
        <div className="flex-shrink-0 w-24 ml-4">
          {/* Header */}
          <div className="h-8 mb-2 flex items-center justify-end text-[10px] font-medium text-gray-400 dark:text-zinc-500">
            Total
          </div>
          {/* Total bars */}
          {data.users.map((_, userIdx) => {
            const total = userTotals[userIdx];
            return (
              <div key={userIdx} className="h-8 mb-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-400 dark:bg-indigo-500 transition-all duration-500"
                    style={{ width: `${(total / maxTotal) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300 tabular-nums w-6 text-right">
                  {total}
                </span>
              </div>
            );
          })}
        </div>

      </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 dark:border-zinc-800">
        <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">Less</span>
        <div className="flex items-center gap-1">
          {LEGEND_STEPS.map((step) => (
            <div key={step.label} className="relative group/legend">
              <div className={`w-4 h-4 rounded-[3px] ${step.color} cursor-default`} />
              <div className="absolute hidden group-hover/legend:block bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-white bg-gray-900/95 px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {step.label}
              </div>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">More</span>
        <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-[2px] ring-1 ring-indigo-400/50" />
          peak day
        </div>
      </div>
    </div>
  );
}
