import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

function movingAvg(values: number[], window = 3): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / window) * 10) / 10;
  });
}

const GRADIENT_ID = 'throughputBarGradient';
const GRADIENT_ID_PEAK = 'throughputBarGradientPeak';

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
  payload?: Array<{ dataKey: string; value: number | null; name: string }>;
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
      {avg && avg.value !== null && (
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

export function WipTrendChart({ data, className = '' }: WipTrendChartProps) {
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

  const avgs = movingAvg(data.map(d => d.completed));
  const peakIdx = data.reduce((best, d, i) => d.completed > data[best].completed ? i : best, 0);
  const chartData = data.map((d, i) => ({
    week: d.week,
    completed: d.completed,
    avg: avgs[i],
  }));

  const trend = getTrend(data);
  const avg = Math.round(data.reduce((s, d) => s + d.completed, 0) / data.length);
  const last = data[data.length - 1].completed;
  const lastAvg = avgs[avgs.length - 1];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
        ? 'text-red-400'
        : 'text-zinc-400';
  const trendBg =
    trend === 'up'
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : trend === 'down'
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-zinc-500/10 border-zinc-500/20';
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
          {/* Hero metric */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
              {last}
            </span>
            <span className="text-sm text-gray-400 dark:text-zinc-500">tasks this week</span>
          </div>
        </div>

        {/* Trend badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${trendColor} ${trendBg} shrink-0`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trendLabel}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
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
              width={28}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'currentColor', className: 'text-gray-100/60 dark:text-white/[0.03]' }}
            />

            {/* Period average reference line */}
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
                  fill={index === peakIdx ? `url(#${GRADIENT_ID_PEAK})` : `url(#${GRADIENT_ID})`}
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
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
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
