/**
 * PredictiveBurndownChart Component
 * Burndown chart with AI-powered uncertainty cone
 * Design: Line (real) + Line (ideal) + Area (uncertainty range)
 */

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Info } from 'lucide-react';

interface BurndownData {
  real: Array<{ day: number; tasks: number }>;
  ideal: Array<{ day: number; tasks: number }>;
  projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
}

interface PredictiveBurndownChartProps {
  data: BurndownData;
  period?: 'today' | 'week' | 'month' | 'quarter' | 'all';
  title?: string;
  subtitle?: string;
}

export function PredictiveBurndownChart({
  data,
  period = 'week',
  title = 'Predictive Burndown',
  subtitle = 'Historical progress with AI projection',
}: PredictiveBurndownChartProps) {
  // Calculate periods based on selected time range (matching backend logic)
  const getPeriodConfig = () => {
    switch (period) {
      case 'today':
        return { historical: 12, projection: 12 }; // 24 hours total
      case 'week':
        return { historical: 7, projection: 7 }; // 14 days total
      case 'month':
        return { historical: 30, projection: 30 }; // 60 days total (30 historical + 30 projection)
      case 'quarter':
        return { historical: 13, projection: 13 }; // 26 weeks total
      case 'all':
        return { historical: 12, projection: 6 }; // 18 months total
      default:
        return { historical: 14, projection: 14 }; // Default fallback
    }
  };

  const { historical, projection } = getPeriodConfig();
  const totalDays = historical + projection;
  const todayIndex = historical - 1; // 0-based index for "Today"

  // Helper to generate date labels based on period and index relative to today
  const generateDateLabel = (index: number) => {
    const today = new Date();
    const diff = index - todayIndex;
    const targetDate = new Date(today);

    switch (period) {
      case 'today': // Hourly granularity
        targetDate.setHours(today.getHours() + diff);
        return targetDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
      case 'quarter': // Weekly granularity
        targetDate.setDate(today.getDate() + (diff * 7));
        return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'all': // Monthly granularity
        targetDate.setMonth(today.getMonth() + diff);
        return targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'week': // Daily granularity
      case 'month':
      default:
        targetDate.setDate(today.getDate() + diff);
        return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Combine all data points for the chart
  const allDays = Array.from({ length: totalDays }, (_, i) => i);

  const chartData = allDays.map((day) => {
    const realPoint = data.real.find((r) => r.day === day);
    const idealPoint = data.ideal.find((i) => i.day === day);
    const projectionPoint = data.projection.find((p) => p.day === day);

    return {
      day,
      dateLabel: generateDateLabel(day),
      real: realPoint?.tasks,
      ideal: idealPoint?.tasks,
      optimistic: projectionPoint?.optimistic,
      pessimistic: projectionPoint?.pessimistic,
      // For the area range
      projectionRange: projectionPoint
        ? [projectionPoint.optimistic, projectionPoint.pessimistic]
        : undefined,
    };
  });

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
      data-chart-id="burndown-predictive"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {/* Info Tooltip */}
        <div className="relative group">
          <button
            type="button"
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
            aria-label="Understanding Predictive Burndown"
          >
            <Info className="w-4 h-4" />
          </button>
          {/* Glassmorphism Popover */}
          <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
            <h4 className="text-sm font-semibold text-white mb-2">Understanding Predictive Burndown</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Aether's predictive model uses your team's historical velocity to plot the <span className="text-purple-400 font-medium">'Uncertainty Cone'</span> (shaded area). It represents the statistical deviation and most likely date range for sprint completion.
            </p>
            {/* Arrow */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-zinc-900/95 dark:bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50" />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            {/* Gradient for uncertainty cone */}
            <defs>
              <linearGradient id="uncertaintyCone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />

            <XAxis
              dataKey="dateLabel"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              interval={period === 'month' ? 5 : period === 'week' ? 1 : 0}
              angle={-45}
              textAnchor="end"
              height={60}
              tickFormatter={(value) => {
                // Shorten long labels to prevent overlap
                if (typeof value === 'string' && value.length > 8) {
                  return value.slice(0, 6);
                }
                return value;
              }}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              label={{ value: 'Tasks Remaining', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
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
              itemStyle={{ color: '#fff', fontSize: '12px', padding: '2px 0' }}
            />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
              wrapperStyle={{
                fontSize: '11px',
                paddingBottom: '10px',
              }}
            />

            {/* Vertical line separating historical from projection */}
            <ReferenceLine
              x={todayIndex}
              stroke="#6b7280"
              strokeDasharray="5 5"
              label={{ value: 'Today', position: 'top', fill: '#6b7280', fontSize: 10 }}
            />

            {/* Uncertainty Cone (Band between optimistic and pessimistic) */}
            <Area
              type="monotone"
              dataKey="projectionRange"
              stroke="none"
              fill="url(#uncertaintyCone)"
              name="Projection Range"
              isAnimationActive={true}
              connectNulls={false}
            />

            {/* Ideal Burndown Line (dashed) */}
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Ideal"
            />

            {/* Real Progress Line (solid, bold) */}
            <Line
              type="monotone"
              dataKey="real"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#10b981' }}
              name="Actual"
            />

            {/* Optimistic Projection Line */}
            <Line
              type="monotone"
              dataKey="optimistic"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              name="Optimistic"
            />

            {/* Pessimistic Projection Line */}
            <Line
              type="monotone"
              dataKey="pessimistic"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              name="Pessimistic"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
        <p className="text-xs text-purple-700 dark:text-purple-400">
          <span className="font-semibold">AI Prediction:</span> The shaded area represents the uncertainty
          cone, showing optimistic and pessimistic completion scenarios based on current velocity.
        </p>
      </div>
    </div>
  );
}
