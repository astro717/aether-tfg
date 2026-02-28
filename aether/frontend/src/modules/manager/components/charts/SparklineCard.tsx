/**
 * SparklineCard Component
 * Premium KPI card with inline sparkline visualization
 * Design: Big Number + Mini trend graph (no axes, minimal style)
 *
 * Supports velocity rate formatting with arrows (e.g., ↑ 12%, ↓ 5%, - 0%)
 */

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { InfoTooltip, type InfoTooltipContent } from './InfoTooltip';

interface SparklineCardProps {
  title: string;
  value: number | string;
  unit?: string;
  sparklineData: number[];
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  /** When true, formats value as a velocity rate with arrows (↑/↓) */
  isVelocityRate?: boolean;
  infoTooltip?: InfoTooltipContent;
}

const COLOR_MAP = {
  blue: {
    gradient: 'from-blue-500 to-cyan-500',
    line: '#3b82f6',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    gradient: 'from-emerald-500 to-green-500',
    line: '#10b981',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    gradient: 'from-amber-500 to-orange-500',
    line: '#f59e0b',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    gradient: 'from-red-500 to-pink-500',
    line: '#ef4444',
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
  },
  purple: {
    gradient: 'from-purple-500 to-indigo-500',
    line: '#8b5cf6',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
  },
};

export function SparklineCard({
  title,
  value,
  unit,
  sparklineData,
  color = 'blue',
  trend,
  subtitle,
  isVelocityRate = false,
  infoTooltip,
}: SparklineCardProps) {
  // Transform data for Recharts
  const chartData = sparklineData.map((val, idx) => ({ value: val, index: idx }));

  // For velocity rate, determine color and icon based on value
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

  // Determine dynamic color for velocity rate
  const velocityColor = isVelocityRate
    ? numericValue > 0
      ? 'green'
      : numericValue < 0
        ? 'amber'
        : 'blue'
    : color;

  const effectiveColors = COLOR_MAP[velocityColor];

  // Calculate trend if not provided
  const calculatedTrend = trend || (() => {
    if (isVelocityRate) {
      if (numericValue > 0) return 'up';
      if (numericValue < 0) return 'down';
      return 'neutral';
    }
    if (sparklineData.length < 2) return 'neutral';
    const first = sparklineData[0];
    const last = sparklineData[sparklineData.length - 1];
    if (last > first) return 'up';
    if (last < first) return 'down';
    return 'neutral';
  })();

  const TrendIcon = calculatedTrend === 'up' ? TrendingUp : calculatedTrend === 'down' ? TrendingDown : Minus;

  // Format velocity rate display with arrows
  const displayValue = isVelocityRate
    ? numericValue > 0
      ? `↑ ${numericValue}`
      : numericValue < 0
        ? `↓ ${Math.abs(numericValue)}`
        : `- ${numericValue}`
    : value;

  return (
    <div
      className="relative rounded-2xl bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl border border-gray-100 dark:border-zinc-700/50 p-6 shadow-sm hover:shadow-md transition-all duration-300"
      data-chart-id={`sparkline-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Gradient Overlay (subtle) */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${effectiveColors.gradient} opacity-5`} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
            {/* Info Tooltip (Portal-based) */}
            {infoTooltip && <InfoTooltip content={infoTooltip} />}
          </div>
          <div className={`p-1.5 rounded-lg ${effectiveColors.bg}`}>
            <TrendIcon className={`w-4 h-4 ${effectiveColors.text}`} />
          </div>
        </div>

        {/* Big Number */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-3xl font-bold ${isVelocityRate ? effectiveColors.text : 'text-gray-900 dark:text-white'}`}>
            {displayValue}
          </span>
          {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
        </div>

        {/* Sparkline */}
        {sparklineData.length > 0 && (
          <div className="h-12 -mx-2 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={effectiveColors.line}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
