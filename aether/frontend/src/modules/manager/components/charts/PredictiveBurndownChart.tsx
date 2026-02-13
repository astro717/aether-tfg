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
  title?: string;
  subtitle?: string;
}

export function PredictiveBurndownChart({
  data,
  title = 'Predictive Burndown',
  subtitle = 'Historical progress with AI projection',
}: PredictiveBurndownChartProps) {
  // Combine all data points for the chart
  // Days 0-13: Historical (real)
  // Days 14-28: Projection (ideal + uncertainty cone)
  const allDays = Array.from({ length: 29 }, (_, i) => i);

  const chartData = allDays.map((day) => {
    const realPoint = data.real.find((r) => r.day === day);
    const idealPoint = data.ideal.find((i) => i.day === day);
    const projectionPoint = data.projection.find((p) => p.day === day);

    return {
      day,
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
              dataKey="day"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151', opacity: 0.2 }}
              label={{ value: 'Sprint Day', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 12 }}
            />

            <YAxis
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
              labelFormatter={(day) => `Day ${day}`}
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
              x={14}
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
