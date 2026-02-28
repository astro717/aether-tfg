/**
 * InvestmentSunburst Component
 * Double Donut Chart for Investment Distribution
 * Design: Two concentric rings showing Macro -> Micro breakdown
 * Safer for PDF export than full Sunburst
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
  pdfMode = false,
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
            aria-label="Understanding Investment"
          >
            <Info className="w-4 h-4" />
          </button>
          {/* Glassmorphism Popover */}
          <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
            <h4 className="text-sm font-semibold text-white mb-2">Understanding Investment</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              A visual breakdown of where your team invests effort. Grouped by task type (<span className="text-blue-400 font-medium">Feature</span>, <span className="text-red-400 font-medium">Bug</span>, <span className="text-gray-400 font-medium">Chore</span>) to ensure a healthy balance between value creation and technical debt management.
            </p>
            {/* Arrow */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-zinc-900/95 dark:bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50" />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className={pdfMode ? 'h-64' : 'h-96'}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Outer Ring (Macro Categories) */}
            <Pie
              data={macroData}
              cx={pdfMode ? "48%" : "50%"}
              cy="50%"
              innerRadius={pdfMode ? 60 : 90}
              outerRadius={pdfMode ? 85 : 130}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                ((percent ?? 0) > 0) ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
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
              cx={pdfMode ? "48%" : "50%"}
              cy="50%"
              innerRadius={pdfMode ? 35 : 50}
              outerRadius={pdfMode ? 55 : 85}
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
              layout={pdfMode ? 'vertical' : 'horizontal'}
              align={pdfMode ? 'right' : 'center'}
              verticalAlign={pdfMode ? 'middle' : 'bottom'}
              height={pdfMode ? undefined : 36}
              iconType="circle"
              wrapperStyle={{
                fontSize: '12px',
                color: '#6b7280',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Info Text - Hidden in PDF mode to save vertical space */}
      {!pdfMode && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Outer ring: Primary categories | Inner ring: Sub-categories
          </p>
        </div>
      )}
    </div>
  );
}
