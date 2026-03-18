import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { InfoTooltip } from './InfoTooltip';

interface VelocityWeek {
  week: string;
  completed: number;
  weekStart: string;
}

interface ThroughputHistogramProps {
  data: VelocityWeek[];
  className?: string;
}

interface HistogramBucket {
  range: string;
  weeks: number;
  midpoint: number;
}

function toHistogram(velocityData: VelocityWeek[]): HistogramBucket[] {
  const counts = velocityData.map(d => d.completed);
  if (counts.length === 0) return [];

  const min = Math.min(...counts);
  const max = Math.max(...counts);

  if (min === max) {
    return [{ range: `${min}`, weeks: counts.length, midpoint: min }];
  }

  const bucketSize = Math.max(1, Math.ceil((max - min + 1) / 6));
  const buckets: HistogramBucket[] = [];

  for (let start = min; start <= max; start += bucketSize) {
    const end = start + bucketSize - 1;
    const weeksInBucket = counts.filter(c => c >= start && c <= end).length;
    buckets.push({
      range: start === end ? `${start}` : `${start}–${end}`,
      weeks: weeksInBucket,
      midpoint: start,
    });
  }

  return buckets;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower));
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HistogramBucket }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/40 min-w-[140px]">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
        {d.range} tasks/week
      </p>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded bg-blue-400" />
          <span className="text-xs text-white/60">Weeks</span>
        </div>
        <span className="text-sm font-bold text-white tabular-nums">{d.weeks}</span>
      </div>
    </div>
  );
}

const GRADIENT_ID = 'histBarGradient';
const GRADIENT_ID_PEAK = 'histBarGradientPeak';

export function ThroughputHistogram({ data, className = '' }: ThroughputHistogramProps) {
  // Exclude the last element (current partial week) so the frequency distribution
  // only reflects complete weeks — a partial week would skew percentiles downward.
  const completeWeeks = data.slice(0, -1);

  if (completeWeeks.length < 4) {
    return (
      <div
        className={`bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm flex flex-col h-full ${className}`}
      >
        <div className="px-6 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              Throughput Histogram
            </p>
            <InfoTooltip
              size="sm"
              content={{
                title: 'Throughput Histogram',
                description: (
                <>
                  Shows how often your team completed a given number of tasks in a week. A narrow distribution means predictable delivery; a wide one signals variability. The{' '}
                  <span className="text-blue-400 font-medium">blue bars</span> mark the 85% confidence range — use it when making delivery commitments.
                </>
              ),
              }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Need at least 4 weeks of data. Currently have {completeWeeks.length} week{completeWeeks.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>
    );
  }

  const counts = completeWeeks.map(d => d.completed);
  const p15 = percentile(counts, 15);
  const p85 = percentile(counts, 85);
  const histogram = toHistogram(completeWeeks);
  const peakIdx = histogram.reduce((best, b, i) => b.weeks > histogram[best].weeks ? i : best, 0);

  return (
    <div
      className={`bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm overflow-hidden flex flex-col h-full ${className}`}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              Throughput Histogram
            </p>
            <InfoTooltip
              size="sm"
              content={{
                title: 'Throughput Histogram',
                description: (
                <>
                  Shows how often your team completed a given number of tasks in a week. A narrow distribution means predictable delivery; a wide one signals variability. The{' '}
                  <span className="text-blue-400 font-medium">blue bars</span> mark the 85% confidence range — use it when making delivery commitments.
                </>
              ),
              }}
            />
          </div>
        </div>

        {/* Forecast badge with tooltip */}
        <div className="relative group shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 tabular-nums whitespace-nowrap cursor-default select-none">
            {p15}–{p85} tasks
          </div>
          {/* Tooltip */}
          <div className="absolute right-0 top-full mt-2 z-50 w-56 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/40">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">85% confidence interval</p>
              <p className="text-xs text-white/80 leading-relaxed">
                Based on {completeWeeks.length} weeks of history, your team completes between{' '}
                <span className="font-semibold text-blue-300">{p15}</span> and{' '}
                <span className="font-semibold text-blue-300">{p85}</span> tasks per week 85% of the time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 flex-1 min-h-0" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histogram} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25} />
              </linearGradient>
              <linearGradient id={GRADIENT_ID_PEAK} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0"
              stroke="currentColor"
              className="text-gray-100 dark:text-white/[0.04]"
              vertical={false}
            />

            <XAxis
              dataKey="range"
              tick={{ fill: 'currentColor', fontSize: 11, className: 'text-gray-400 dark:text-zinc-500' }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              label={{ value: 'Tasks / week', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'currentColor', className: 'text-gray-400 dark:text-zinc-500' }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'currentColor', fontSize: 11, className: 'text-gray-400 dark:text-zinc-500' }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={28}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-gray-100/60 dark:text-white/[0.03]' }} />

            <Bar dataKey="weeks" name="Weeks" radius={[5, 5, 2, 2]} maxBarSize={48}>
              {histogram.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    index === peakIdx
                      ? `url(#${GRADIENT_ID_PEAK})`
                      : entry.midpoint >= p15 && entry.midpoint <= p85
                        ? `url(#${GRADIENT_ID})`
                        : '#6366f1'
                  }
                  fillOpacity={entry.midpoint >= p15 && entry.midpoint <= p85 || index === peakIdx ? 1 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer legend */}
      <div className="px-6 pb-5 pt-2 flex items-center justify-center gap-5 text-xs text-gray-400 dark:text-zinc-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-400/80" />
          <span>85% range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-indigo-400/50" />
          <span>Outside range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-300" />
          <span>Peak frequency</span>
        </div>
      </div>
    </div>
  );
}
