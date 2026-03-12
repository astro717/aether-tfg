/**
 * InvestmentArcGauge Component
 * Replaces the double-donut with a premium semi-circular arc gauge.
 * Inspired by high-end dashboard UIs where each segment occupies arc
 * space proportional to its value, with a legend table below.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Info } from 'lucide-react';

interface InvestmentData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

interface InvestmentSunburstProps {
  data: InvestmentData;
  title?: string;
  subtitle?: string;
  pdfMode?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  'Features':    '#3b82f6',
  'Bugs':        '#ef4444',
  'Chores':      '#6b7280',
  'Maintenance': '#f59e0b',
  'Tech Debt':   '#8b5cf6',
  'New Value':   '#10b981',
};

export function InvestmentSunburst({
  data,
  title = 'Investment Distribution',
  subtitle,
  pdfMode = false,
}: InvestmentSunburstProps) {
  const segments = data.labels.map((label, idx) => ({
    name: label,
    value: data.datasets[0]?.data[idx] || 0,
    color: SEGMENT_COLORS[label] ?? '#6b7280',
  })).filter(s => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Arc: 220° sweep — opens from lower-left to lower-right
  const START_ANGLE = 200;
  const END_ANGLE   = -20;

  const innerR = pdfMode ? 55 : 70;
  const outerR = pdfMode ? 80 : 105;

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm flex flex-col"
      data-chart-id="investment-profile"
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="relative group">
          <button
            type="button"
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
            aria-label="Understanding Investment"
          >
            <Info className="w-4 h-4" />
          </button>
          <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
            <h4 className="text-sm font-semibold text-white mb-2">Understanding Investment</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              A visual breakdown of where your team invests effort. Grouped by task type (
              <span className="text-blue-400 font-medium">Feature</span>,{' '}
              <span className="text-red-400 font-medium">Bug</span>,{' '}
              <span className="text-gray-400 font-medium">Chore</span>) to ensure a healthy balance between value creation and technical debt management.
            </p>
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50" />
          </div>
        </div>
      </div>

      {/* Arc Chart */}
      <div className="relative" style={{ height: pdfMode ? 140 : 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              cx="50%"
              cy="88%"
              startAngle={START_ANGLE}
              endAngle={END_ANGLE}
              innerRadius={innerR}
              outerRadius={outerR}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive={!pdfMode}
            >
              {segments.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(24,24,27,0.95)',
                border: 'none',
                borderRadius: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                padding: '10px 14px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`${value}%`, 'Share']}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center value */}
        <div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ bottom: pdfMode ? 2 : 6 }}
        >
          <span className={`font-bold tabular-nums text-gray-900 dark:text-white ${pdfMode ? 'text-xl' : 'text-2xl'}`}>
            {total}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 tracking-wide uppercase">
            tasks
          </span>
        </div>
      </div>

      {/* Legend table */}
      <div className="mt-4 space-y-2">
        {segments.map((seg) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={seg.name} className="flex items-center gap-2">
              {/* Dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              {/* Name */}
              <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">
                {seg.name}
              </span>
              {/* Value */}
              <span className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums w-8 text-right">
                {seg.value}
              </span>
              {/* Percentage badge */}
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-10 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
