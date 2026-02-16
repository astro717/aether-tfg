/**
 * SmoothCFDChart Component
 * Cumulative Flow Diagram with smooth curves and gradients
 * Design: Stacked Area Chart with monotone interpolation ("River" style)
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CFDDataPoint {
  date: string;
  done: number;
  review: number;
  in_progress: number;
  todo: number;
}

interface SmoothCFDChartProps {
  data: CFDDataPoint[];
  period?: 'today' | 'week' | 'month' | 'quarter' | 'all';
  title?: string;
  subtitle?: string;
}

// Aether color palette with gradients
const CFD_LAYERS = [
  {
    dataKey: 'done',
    name: 'Done',
    color: '#10b981', // Emerald
    gradientId: 'gradientDone',
    opacity: 0.8,
  },
  {
    dataKey: 'review',
    name: 'Review',
    color: '#8b5cf6', // Purple
    gradientId: 'gradientReview',
    opacity: 0.7,
  },
  {
    dataKey: 'in_progress',
    name: 'In Progress',
    color: '#3b82f6', // Blue
    gradientId: 'gradientInProgress',
    opacity: 0.7,
  },
  {
    dataKey: 'todo',
    name: 'To Do',
    color: '#6b7280', // Gray
    gradientId: 'gradientTodo',
    opacity: 0.6,
  },
];

export function SmoothCFDChart({ data, period = 'week', title = 'Cumulative Flow Diagram', subtitle }: SmoothCFDChartProps) {
  // Period-aware XAxis formatter
  const formatXAxis = (value: string) => {
    try {
      const date = new Date(value);

      switch (period) {
        case 'today':
          // Show hours: "09:00", "14:00"
          return `${date.getHours().toString().padStart(2, '0')}:00`;

        case 'week':
          // Show days: "Mon", "Tue"
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return dayNames[date.getDay()];

        case 'month':
          // Show date: "2/15"
          return `${date.getMonth() + 1}/${date.getDate()}`;

        case 'quarter':
          // Show week number: "W1", "W2"
          const weekOfQuarter = Math.ceil((date.getDate() + 1) / 7);
          return `W${weekOfQuarter}`;

        case 'all':
          // Show month: "Jan", "Feb"
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return monthNames[date.getMonth()];

        default:
          return `${date.getMonth() + 1}/${date.getDate()}`;
      }
    } catch {
      return value;
    }
  };

  // Period-aware tooltip label formatter
  const formatTooltipLabel = (value: any) => {
    try {
      const dateValue = String(value);
      const date = new Date(dateValue);

      if (period === 'today') {
        // Full date with time: "Feb 15, 09:00 AM"
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      }

      // Full date: "February 15, 2026"
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return String(value);
    }
  };

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
      data-chart-id="cfd-area"
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            {/* Gradient Definitions */}
            <defs>
              {CFD_LAYERS.map((layer) => (
                <linearGradient key={layer.gradientId} id={layer.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={layer.color} stopOpacity={layer.opacity} />
                  <stop offset="95%" stopColor={layer.color} stopOpacity={layer.opacity * 0.3} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />

            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              tickFormatter={formatXAxis}
            />

            <YAxis
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
              labelFormatter={formatTooltipLabel}
            />

            {/* Stacked Areas (bottom to top: Done -> Review -> In Progress -> To Do) */}
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
