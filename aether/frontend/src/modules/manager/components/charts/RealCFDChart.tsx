/**
 * RealCFDChart — Cumulative Flow Diagram powered by real daily_metrics data.
 * Identical visual style to SmoothCFDChart ("River" stacked areas) but:
 *  - Data comes directly from the API (no simulation).
 *  - Shows an informative empty state when < 2 data points are available.
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DatabaseZap, Info } from 'lucide-react';

interface CFDDataPoint {
  date: string;
  done: number;
  in_progress: number;
  todo: number;
}

interface RealCFDChartProps {
  data: CFDDataPoint[];
  period?: 'today' | 'week' | 'month' | 'quarter' | 'all';
  title?: string;
  subtitle?: string;
}

const CFD_LAYERS = [
  { dataKey: 'done',        name: 'Done',        color: '#10b981', gradientId: 'rCfdDone',       opacity: 0.8 },
  { dataKey: 'in_progress', name: 'In Progress', color: '#3b82f6', gradientId: 'rCfdInProgress', opacity: 0.7 },
  { dataKey: 'todo',        name: 'To Do',       color: '#6b7280', gradientId: 'rCfdTodo',       opacity: 0.6 },
];

function formatXAxisTick(value: string): string {
  try {
    const date = new Date(value + 'T00:00:00'); // force UTC-less parse
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return value;
  }
}

function formatTooltipLabel(value: string): string {
  try {
    const date = new Date(value + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

export function RealCFDChart({
  data,
  period: _period = 'month',
  title = 'Cumulative Flow Diagram',
  subtitle,
}: RealCFDChartProps) {
  // ── Empty state ──────────────────────────────────────────────────────────────
  if (data.length < 2) {
    return (
      <div
        className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
        data-chart-id="real-cfd-area"
      >
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="h-80 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-700/40">
            <DatabaseZap className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Not enough historical data
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
              Run the additive seeder to populate <code className="font-mono text-xs">daily_metrics</code>:
              <br />
              <code className="font-mono text-xs text-blue-500 dark:text-blue-400 mt-1 block">
                cd backend && npm run seed:additive
              </code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Chart ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
      data-chart-id="real-cfd-area"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Info Tooltip */}
          <div className="relative group">
            <button
              type="button"
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
              aria-label="Understanding CFD"
            >
              <Info className="w-4 h-4" />
            </button>
            {/* Glassmorphism Popover */}
            <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
              <h4 className="text-sm font-semibold text-white mb-2">Understanding CFD</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                A Cumulative Flow Diagram always grows over time. The true magic lies in the <span className="text-emerald-400 font-medium">thickness of the bands</span>—each band's width reveals your team's bottlenecks and true work-in-progress, not just daily static numbers.
              </p>
              {/* Arrow */}
              <div className="absolute -top-1.5 right-4 w-3 h-3 bg-zinc-900/95 dark:bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50" />
            </div>
          </div>
          {/* Live Badge */}
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live data
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              {CFD_LAYERS.map((layer) => (
                <linearGradient key={layer.gradientId} id={layer.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={layer.color} stopOpacity={layer.opacity} />
                  <stop offset="95%" stopColor={layer.color} stopOpacity={layer.opacity * 0.3} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />

            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              tickFormatter={formatXAxisTick}
              interval="preserveStartEnd"
            />

            <YAxis
              allowDecimals={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              label={{ value: 'Tasks', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                padding: '12px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '8px' }}
              itemStyle={{ color: '#fff', fontSize: '12px', padding: '4px 0' }}
              labelFormatter={(value) => formatTooltipLabel(String(value))}
            />

            {CFD_LAYERS.map((layer) => (
              <Area
                key={layer.dataKey}
                type="monotone"
                dataKey={layer.dataKey}
                stackId="1"
                stroke={layer.color}
                strokeWidth={2}
                fill={`url(#${layer.gradientId})`}
                name={layer.name}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
        {CFD_LAYERS.map((layer) => (
          <div key={layer.dataKey} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: layer.color, opacity: layer.opacity }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">{layer.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
