import { useId, useRef, useState, useEffect } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface VelocityWeek {
  week: string;
  completed: number;
  weekStart: string;
}

interface WipTrendChartProps {
  data: VelocityWeek[];
  className?: string;
}

// Partial moving average — uses available data for first window-1 points so the
// trend line starts from bar W1 rather than appearing mid-chart. W1 = 1-pt avg,
// W2 = 2-pt avg, W3+ = full 3-pt avg. Honest enough, far better visually.
function movingAvg(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });
}

function getTrend(data: VelocityWeek[]): 'up' | 'down' | 'flat' {
  if (data.length < 2) return 'flat';
  const recent = data.slice(-2).map(d => d.completed);
  const delta = recent[1] - recent[0];
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const completed = payload.find(p => p.dataKey === 'completed');
  const avg = payload.find(p => p.dataKey === 'avg');

  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/40 min-w-[140px]">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{label}</p>
      {completed && (
        <div className="flex items-center justify-between gap-6 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-blue-400" />
            <span className="text-xs text-white/60">Completed</span>
          </div>
          <span className="text-sm font-bold text-white tabular-nums">{completed.value}</span>
        </div>
      )}
      {avg && (
        <div className="flex items-center justify-between gap-6 pt-1 border-t border-white/10 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-px bg-violet-400" />
            <span className="text-xs text-white/60">3-wk avg</span>
          </div>
          <span className="text-xs font-semibold text-violet-300 tabular-nums">{avg.value}</span>
        </div>
      )}
    </div>
  );
}

// px per bar when the chart overflows and becomes scrollable
const BAR_PX = 52;
// bar count threshold above which we enable horizontal scroll
const SCROLL_AT = 14;

export function WipTrendChart({ data, className = '' }: WipTrendChartProps) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `throughputBarGradient-${uid}`;
  const gradientIdPeak = `throughputBarGradientPeak-${uid}`;

  // Measure the chart area so we can pass explicit dimensions to ComposedChart
  // (required once we drop ResponsiveContainer for the scrollable case)
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 200 });
  const [atStart, setAtStart] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        w: Math.round(entry.contentRect.width),
        h: Math.round(entry.contentRect.height),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length < 2) {
    return (
      <div className={`p-6 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm flex flex-col h-full ${className}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Throughput Trend</p>
          <InfoTooltip
            size="sm"
            content={{
              title: 'Throughput Trend',
              description: (
                <>
                  Tracks how many tasks your team completes each week. The{' '}
                  <span className="text-violet-400 font-medium">violet line</span> is a 3-week moving average that smooths short-term noise.{' '}
                  <span className="text-blue-400 font-medium">Bars above the average</span> signal acceleration; below it, investigate blockers before they compound.
                </>
              ),
            }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Not enough weekly data yet.</p>
      </div>
    );
  }

  // For long periods (quarter=24w, all=52w) the backend sends many weeks.
  // Show ALL of them in a scrollable view — the full history is the point.
  // For shorter periods (≤ SCROLL_AT weeks) trim leading zero-weeks so the
  // chart doesn't open with a wall of empty bars.
  const needsScroll = data.length > SCROLL_AT;

  let displayData: VelocityWeek[];
  if (needsScroll) {
    displayData = data; // full history — scroll handles the density
  } else {
    const firstActiveIdx = data.findIndex(d => d.completed > 0);
    const trimStart = firstActiveIdx > 1 ? firstActiveIdx - 1 : 0;
    const trimmedData = firstActiveIdx === -1 ? data : data.slice(trimStart);
    displayData = trimmedData.length >= 3 ? trimmedData : data.slice(-Math.max(3, trimmedData.length));
  }

  const avgs = movingAvg(displayData.map(d => d.completed));
  const peakIdx = displayData.reduce((best, d, i) => d.completed > displayData[best].completed ? i : best, 0);
  const chartData = displayData.map((d, i) => ({
    week: d.week,
    completed: d.completed,
    avg: avgs[i],
  }));

  const trend = getTrend(displayData);
  const avg = Math.round(displayData.reduce((s, d) => s + d.completed, 0) / displayData.length);
  const last = displayData[displayData.length - 1].completed;
  // In scrollable mode expand the chart beyond the container; otherwise fill it
  const chartW = needsScroll
    ? Math.max(size.w, chartData.length * BAR_PX)
    : (size.w || 400);
  // Reserve ~8px for the scrollbar track so it doesn't clip the axis labels
  const chartH = size.h > 8 ? (needsScroll ? size.h - 8 : size.h) : 200;

  // On mount / when scroll kicks in: jump to the rightmost (most recent) bars
  useEffect(() => {
    if (!needsScroll || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = el.scrollWidth;
    setAtStart(el.scrollLeft > 8);
    setAtEnd(true);
  }, [needsScroll, chartData.length, size.w]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtStart(el.scrollLeft > 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-emerald-400' :
    trend === 'down' ? 'text-red-400' :
    'text-zinc-400';
  const trendBg =
    trend === 'up' ? 'bg-emerald-500/10 border-emerald-500/20' :
    trend === 'down' ? 'bg-red-500/10 border-red-500/20' :
    'bg-zinc-500/10 border-zinc-500/20';
  const trendLabel = trend === 'up' ? 'Accelerating' : trend === 'down' ? 'Decelerating' : 'Steady';

  return (
    <div
      className={`bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm overflow-hidden flex flex-col h-full ${className}`}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              Throughput Trend
            </p>
            <InfoTooltip
              size="sm"
              content={{
                title: 'Throughput Trend',
                description: (
                  <>
                    Tracks how many tasks your team completes each week. The{' '}
                    <span className="text-violet-400 font-medium">violet line</span> is a 3-week moving average that smooths short-term noise.{' '}
                    <span className="text-blue-400 font-medium">Bars above the average</span> signal acceleration; below it, investigate blockers before they compound.
                  </>
                ),
              }}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
              {last}
            </span>
            <span className="text-sm text-gray-400 dark:text-zinc-500">tasks this week</span>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${trendColor} ${trendBg} shrink-0`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trendLabel}
        </div>
      </div>

      {/* Chart area */}
      <div className="px-2 flex-1 min-h-0 relative">
        {/* Sizing anchor — ResizeObserver measures this div */}
        <div ref={containerRef} className="w-full h-full">
          {/* Scroll wrapper — overflow-x-auto only when needed */}
          <div
            ref={scrollRef}
            onScroll={needsScroll ? handleScroll : undefined}
            className={`w-full h-full${needsScroll
              ? ' overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-800/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600'
              : ''}`}
          >
            {size.w > 0 && (
              <ComposedChart
                width={chartW}
                height={chartH}
                data={chartData}
                margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25} />
                  </linearGradient>
                  <linearGradient id={gradientIdPeak} x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="week"
                  tick={{ fill: 'currentColor', fontSize: 11, className: 'text-gray-400 dark:text-zinc-500' }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'currentColor', fontSize: 11, className: 'text-gray-400 dark:text-zinc-500' }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={34}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'currentColor', className: 'text-gray-100/60 dark:text-white/[0.03]' }}
                />

                <ReferenceLine
                  y={avg}
                  stroke="#6366f1"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />

                <Bar dataKey="completed" name="Completed" radius={[5, 5, 2, 2]} maxBarSize={40}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === peakIdx ? `url(#${gradientIdPeak})` : `url(#${gradientId})`}
                    />
                  ))}
                </Bar>

                <Line
                  type="monotone"
                  dataKey="avg"
                  name="3-wk avg"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#a78bfa', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            )}
          </div>
        </div>

        {/* Scroll edge fades — indicate more content in that direction */}
        {needsScroll && atStart && (
          <div className="absolute left-2 inset-y-0 w-8 pointer-events-none bg-gradient-to-r from-white/90 dark:from-zinc-800/90 to-transparent z-10" />
        )}
        {needsScroll && !atEnd && (
          <div className="absolute right-0 inset-y-0 w-8 pointer-events-none bg-gradient-to-l from-white/90 dark:from-zinc-800/90 to-transparent z-10" />
        )}
      </div>

      {/* Footer legend */}
      <div className="px-6 pb-5 pt-2 flex items-center justify-center gap-5 text-xs text-gray-400 dark:text-zinc-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-blue-400/80" />
          <span>Weekly completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-violet-400 rounded-full" />
          <span>3-wk moving avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-px border-t border-dashed border-indigo-400/50" />
          <span>Period avg</span>
        </div>
      </div>
    </div>
  );
}
