/**
 * WorkloadHeatmap Component
 * GitHub-style matrix heatmap for team activity
 * Design: Y-axis = Users, X-axis = Days, Color = Intensity
 */

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface HeatmapData {
  users: string[];
  days: string[];
  data: number[][]; // 2D array: data[userIndex][dayIndex] = activity score
}

interface WorkloadHeatmapProps {
  data: HeatmapData;
  title?: string;
  subtitle?: string;
  showPrivacy?: boolean;
}

// Color intensity scale (GitHub-inspired)
const getHeatmapColor = (value: number): string => {
  if (value === 0) return 'bg-gray-100 dark:bg-zinc-800';
  if (value <= 3) return 'bg-emerald-200 dark:bg-emerald-900/40';
  if (value <= 6) return 'bg-emerald-400 dark:bg-emerald-700/60';
  if (value <= 9) return 'bg-emerald-600 dark:bg-emerald-600/80';
  return 'bg-emerald-700 dark:bg-emerald-500';
};

const anonymizeUsername = (_username: string, index: number): string => {
  return `User ${String.fromCharCode(65 + index)}`; // A, B, C, etc.
};

export function WorkloadHeatmap({
  data,
  title = 'Team Workload Heatmap',
  subtitle = 'Activity intensity per user per day',
  showPrivacy = true,
}: WorkloadHeatmapProps) {
  const [isAnonymized, setIsAnonymized] = useState(false);

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
      data-chart-id="workload-heatmap"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>

        {/* Privacy Toggle */}
        {showPrivacy && (
          <button
            onClick={() => setIsAnonymized(!isAnonymized)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {isAnonymized ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Anonymized
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Show Names
              </>
            )}
          </button>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Days Header */}
          <div className="flex items-center mb-2">
            <div className="w-24 flex-shrink-0" /> {/* Spacer for user column */}
            <div className="flex gap-1">
              {data.days.map((day, idx) => {
                // Handle time labels (HH:mm) for 'today' period - show simple hour numbers (9, 10, 11)
                const isTime = day.includes(':');
                const label = isTime ? parseInt(day.split(':')[0], 10) : new Date(day).getDate();

                return (
                  <div
                    key={idx}
                    className="w-8 h-8 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400"
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Rows */}
          {data.users.map((user, userIdx) => (
            <div key={userIdx} className="flex items-center mb-1 group">
              {/* User Label */}
              <div className="w-24 flex-shrink-0 pr-2 text-xs text-gray-700 dark:text-gray-300 font-medium truncate">
                {isAnonymized ? anonymizeUsername(user, userIdx) : user}
              </div>

              {/* Activity Cells */}
              <div className="flex gap-1">
                {data.data[userIdx]?.map((value, dayIdx) => (
                  <div
                    key={dayIdx}
                    className={`w-8 h-8 rounded ${getHeatmapColor(value)} transition-all duration-200 hover:ring-2 hover:ring-blue-400 cursor-pointer relative group/cell`}
                    title={`${isAnonymized ? anonymizeUsername(user, userIdx) : user} - ${data.days[dayIdx]}: ${value} activities`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute hidden group-hover/cell:block bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                      {value} {value === 1 ? 'activity' : 'activities'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-gray-100 dark:bg-zinc-800" />
          <div className="w-4 h-4 rounded bg-emerald-200 dark:bg-emerald-900/40" />
          <div className="w-4 h-4 rounded bg-emerald-400 dark:bg-emerald-700/60" />
          <div className="w-4 h-4 rounded bg-emerald-600 dark:bg-emerald-600/80" />
          <div className="w-4 h-4 rounded bg-emerald-700 dark:bg-emerald-500" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">More</span>
      </div>
    </div>
  );
}
