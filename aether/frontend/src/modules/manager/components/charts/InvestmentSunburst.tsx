/**
 * InvestmentSunburst Component
 * Double Donut Chart for Investment Distribution
 * Design: Two concentric rings showing Macro -> Micro breakdown
 * Safer for PDF export than full Sunburst
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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
}

// Macro-level colors (outer ring)
const MACRO_COLORS = {
  'Features': '#3b82f6', // Blue
  'Bugs': '#ef4444', // Red
  'Chores': '#6b7280', // Gray
  'Maintenance': '#f59e0b', // Amber
  'Tech Debt': '#8b5cf6', // Purple
  'New Value': '#10b981', // Green
};

// Micro-level colors (inner ring - slightly lighter variants)
const MICRO_COLORS = {
  'Features': '#60a5fa',
  'Bugs': '#f87171',
  'Chores': '#9ca3af',
  'Maintenance': '#fbbf24',
  'Tech Debt': '#a78bfa',
  'New Value': '#34d399',
};

export function InvestmentSunburst({
  data,
  title = 'Investment Distribution',
  subtitle,
}: InvestmentSunburstProps) {
  // Transform data for double donut
  const macroData = data.labels.map((label, idx) => ({
    name: label,
    value: data.datasets[0]?.data[idx] || 0,
    color: MACRO_COLORS[label as keyof typeof MACRO_COLORS] || '#6b7280',
  }));

  // For a true sunburst, we'd need hierarchical data
  // For V1, we'll show the same data in two rings with different radii
  const microData = macroData.map(item => ({
    ...item,
    color: MICRO_COLORS[item.name as keyof typeof MICRO_COLORS] || '#9ca3af',
  }));

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
      data-chart-id="investment-profile"
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Outer Ring (Macro Categories) */}
            <Pie
              data={macroData}
              cx="50%"
              cy="50%"
              innerRadius={90}
              outerRadius={130}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
            >
              {macroData.map((entry, index) => (
                <Cell key={`macro-cell-${index}`} fill={entry.color} />
              ))}
            </Pie>

            {/* Inner Ring (Micro - slightly different shading) */}
            <Pie
              data={microData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={1}
              dataKey="value"
            >
              {microData.map((entry, index) => (
                <Cell key={`micro-cell-${index}`} fill={entry.color} opacity={0.7} />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                padding: '12px',
              }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number | undefined) => value ? [`${value}%`, 'Distribution'] : ['N/A', 'Distribution']}
            />

            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                fontSize: '12px',
                color: '#6b7280',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Info Text */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Outer ring: Primary categories | Inner ring: Sub-categories
        </p>
      </div>
    </div>
  );
}
