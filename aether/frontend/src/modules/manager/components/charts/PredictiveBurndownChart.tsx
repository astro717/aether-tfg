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
  // Period-aware axis label
  const getAxisLabel = () => {
    switch (period) {
      case 'today':
        return 'Hour';
      case 'week':
        return 'Day';
      case 'month':
        return 'Day';
      case 'quarter':
        return 'Week';
      case 'all':
        return 'Month';
      default:
        return 'Period';
    }
  };
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
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
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
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              interval={period === 'month' ? 5 : 0} // Show every 6th tick for month (60 points → ~10 labels)
              label={{ value: getAxisLabel(), position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 12 }}
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

            {/* Uncertainty Cone (Area between optimistic and pessimistic) */}
            <Area
              type="monotone"
              dataKey="optimistic"
              stroke="none"
              fill="url(#uncertaintyCone)"
              name="Projection Range"
              isAnimationActive={true}
            />
            <Area
              type="monotone"
              dataKey="pessimistic"
              stroke="none"
              fill="url(#uncertaintyCone)"
              isAnimationActive={true}
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
