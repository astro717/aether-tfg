import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'zinc';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-500/20',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-500/20',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-500/20',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-100 dark:border-red-500/20',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-100 dark:border-purple-500/20',
  },
  zinc: {
    bg: 'bg-zinc-50 dark:bg-zinc-500/10',
    icon: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-zinc-100 dark:border-zinc-500/20',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'blue',
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`
      relative overflow-hidden rounded-2xl p-6
      bg-white/70 dark:bg-zinc-800/70
      backdrop-blur-xl
      border ${colors.border}
      shadow-sm hover:shadow-md
      transition-all duration-300
    `}>
      {/* Gradient overlay */}
      <div className={`absolute inset-0 opacity-30 ${colors.bg}`} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${colors.bg}`}>
            <div className={colors.icon}>{icon}</div>
          </div>
          {trend && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${trend === 'up' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : ''}
              ${trend === 'down' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : ''}
              ${trend === 'neutral' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400' : ''}
            `}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {trend === 'neutral' && <Minus className="w-3 h-3" />}
              {trendValue}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </span>
        </div>

        {/* Title & Subtitle */}
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
