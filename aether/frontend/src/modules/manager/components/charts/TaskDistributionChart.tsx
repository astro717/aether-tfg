import { Info } from 'lucide-react';
import { useState, useEffect } from 'react';

interface InvestmentData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

interface TaskDistributionChartProps {
  data: InvestmentData;
  title?: string;
  subtitle?: string;
  pdfMode?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  Features: '#3b82f6', // blue 
  Bugs: '#ef4444', // red 
  Chores: '#f59e0b', // amber/orange 
  Maintenance: '#8b5cf6', // violet 
  'Tech Debt': '#6366f1', // indigo 
  'New Value': '#10b981', // emerald 
};

export function TaskDistributionChart({
  data,
  title = 'Task Distribution',
  subtitle,
  pdfMode = false,
}: TaskDistributionChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  useEffect(() => {
    // Small delay to ensure the mount animation triggers cleanly
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const segments = data.labels
    .map((label, idx) => ({
      name: label,
      value: data.datasets[0]?.data[idx] ?? 0,
      color: SEGMENT_COLORS[label] ?? '#6b7280',
    }))
    .filter(s => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const pct = (v: number) =>
    total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm transition-all"
      data-chart-id="task-distribution"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-none">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              {subtitle}
            </p>
          )}
        </div>

        {!pdfMode && (
          <div className="relative group ml-2">
            <button
              type="button"
              className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
              aria-label="Understanding Task Distribution"
            >
              <Info className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
              <h4 className="text-sm font-semibold text-white mb-2">Task Distribution</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                A visual breakdown of where your team invests effort. Grouped by task type (
                <span className="text-blue-400 font-medium">Feature</span>,{' '}
                <span className="text-red-400 font-medium">Bug</span>,{' '}
                <span className="text-amber-400 font-medium">Chore</span>
                ) to ensure a healthy balance between value creation and technical debt management.
              </p>
              <div className="absolute -top-1.5 right-4 w-3 h-3 bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50" />
            </div>
          </div>
        )}
      </div>

      {/* ── Total Tasks (Hero Metric) ── */}
      <div className="flex flex-col mb-4">
        <span className="text-3xl font-semibold tabular-nums text-gray-900 dark:text-white leading-none tracking-tight">
          {total}
        </span>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
          Total Tasks
        </span>
      </div>

      {/* ── The Bar (12px height) ── */}
      <div 
        className="h-3 w-full flex rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-700/50 shadow-inner mb-6 relative"
        onMouseLeave={() => setHoveredSegment(null)}
      >
        {segments.length === 0 && (
          <div className="w-full h-full bg-gray-200 dark:bg-zinc-700"></div>
        )}
        {segments.map((seg) => {
          const isHovered = hoveredSegment === seg.name;
          const isDimmed = hoveredSegment !== null && !isHovered;
          
          return (
            <div
              key={seg.name}
              onMouseEnter={() => setHoveredSegment(seg.name)}
              className={
                `h-full relative transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] border-r border-white/20 dark:border-zinc-900/40 last:border-r-0 cursor-default ` +
                (isDimmed ? 'opacity-40 saturate-[0.35] ' : 'opacity-100 ') +
                (isHovered ? 'brightness-110 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] ' : '')
              }
              style={{
                width: mounted ? `${pct(seg.value)}%` : '0%',
                backgroundColor: seg.color,
              }}
              title={`${seg.name}: ${seg.value} tasks (${pct(seg.value)}%)`}
            />
          );
        })}
      </div>

      {/* ── Legend (Scannable clean list) ── */}
      <div className="flex flex-col gap-1.5">
        {segments.map((seg) => {
          const isHovered = hoveredSegment === seg.name;
          const isDimmed = hoveredSegment !== null && !isHovered;
          
          return (
            <div 
              key={seg.name} 
              className={
                `flex items-center justify-between group/item cursor-default transition-all duration-300 rounded-lg px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-zinc-700/30 ` + 
                (isDimmed ? 'opacity-50 saturate-[0.35] ' : 'opacity-100 ')
              }
              onMouseEnter={() => setHoveredSegment(seg.name)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.1)] transition-transform duration-300 group-hover/item:scale-125"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {seg.name}
                </span>
              </div>
              
              <div className="flex items-baseline gap-4 text-right">
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {seg.value}
                </span>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums w-10 text-right">
                  {pct(seg.value)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
