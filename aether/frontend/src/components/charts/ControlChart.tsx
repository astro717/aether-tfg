import { useNavigate } from 'react-router-dom';
import { Scatter, ScatterChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { InfoTooltip } from '../../modules/manager/components/charts/InfoTooltip';

interface ControlChartProps {
  data: Array<{ date: string; days: number; taskTitle: string; taskId?: string }>;
  className?: string;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

const getColor = (days: number) => {
  if (days <= 3) return '#10b981';
  if (days <= 7) return '#f59e0b';
  return '#ef4444';
};

function GlowDot(props: { cx?: number; cy?: number; payload?: { y: number; taskId?: string }; onNavigate?: (taskId: string) => void }) {
  const { cx, cy, payload, onNavigate } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = getColor(payload.y);
  const clickable = !!payload.taskId;
  return (
    <g
      onClick={() => payload.taskId && onNavigate?.(payload.taskId)}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.1} />
      <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.9} />
    </g>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { taskTitle: string; y: number; date: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/40 min-w-[160px]">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 max-w-[180px] truncate">
        {d.taskTitle}
      </p>
      <div className="flex items-center justify-between gap-6 mb-1">
        <span className="text-xs text-white/60">Cycle time</span>
        <span className="text-sm font-bold text-white tabular-nums">{d.y}d</span>
      </div>
      <div className="flex items-center justify-between gap-6 pt-1 border-t border-white/10 mt-1">
        <span className="text-xs text-white/60">Completed</span>
        <span className="text-xs font-semibold text-zinc-300 tabular-nums">{d.date}</span>
      </div>
    </div>
  );
}

export function ControlChart({ data, className = '' }: ControlChartProps) {
  const navigate = useNavigate();
  const chartData = data.map((item, idx) => ({
    x: idx,
    y: item.days,
    taskTitle: item.taskTitle,
    taskId: item.taskId,
    date: item.date,
  }));

  const values = data.map(d => d.days);
  const p50 = Math.round(percentile(values, 50) * 10) / 10;
  const p85 = Math.round(percentile(values, 85) * 10) / 10;
  const p95 = Math.round(percentile(values, 95) * 10) / 10;

  if (data.length === 0) {
    return (
      <div className={`p-6 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm ${className}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Control Chart</p>
          <InfoTooltip
            size="sm"
            content={{
              title: 'Control Chart',
              description: (
                <>
                  Each dot is a completed task plotted by completion date and its cycle time. Dashed lines mark statistical percentiles —{' '}
                  <span className="text-blue-400 font-medium">p50</span> is your median pace,{' '}
                  <span className="text-amber-400 font-medium">p85</span> your realistic commitment line, and{' '}
                  <span className="text-red-400 font-medium">p95</span> flags outliers. Dots consistently above p85 indicate a process bottleneck.
                </>
              ),
            }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-zinc-500">No completed tasks to display.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-8 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
            Control Chart
          </p>
          <InfoTooltip
            size="sm"
            content={{
              title: 'Control Chart',
              description: (
                <>
                  Each dot is a completed task plotted by completion date and its cycle time. Dashed lines mark statistical percentiles —{' '}
                  <span className="text-blue-400 font-medium">p50</span> is your median pace,{' '}
                  <span className="text-amber-400 font-medium">p85</span> your realistic commitment line, and{' '}
                  <span className="text-red-400 font-medium">p95</span> flags outliers. Dots consistently above p85 indicate a process bottleneck.
                </>
              ),
            }}
          />
        </div>
      </div>

      {/* Chart + Footer — grouped and centered so chart sits balanced in variable-height containers */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="px-4">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 24, bottom: 20, left: 0 }}>
              <CartesianGrid
                strokeDasharray="0"
                stroke="currentColor"
                className="text-gray-100 dark:text-white/[0.04]"
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="x"
                name="Task Index"
                tick={{ fill: 'currentColor', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                label={{ value: 'tasks →', position: 'insideBottomRight', offset: 0, fontSize: 9, fill: 'currentColor', className: 'text-zinc-400 dark:text-zinc-600' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Days"
                unit="d"
                tick={{ fill: 'currentColor', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={36}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: 'rgba(148,163,184,0.2)' }}
                content={<CustomTooltip />}
              />
              <ReferenceLine y={p50} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.6} />
              <ReferenceLine y={p85} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.6} />
              <ReferenceLine y={p95} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.6} />
              <Scatter name="Tasks" data={chartData} shape={(props) => <GlowDot {...(props as Parameters<typeof GlowDot>[0])} onNavigate={(id) => navigate(`/tasks/${id}`)} />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Footer legend */}
        <div className="px-8 pb-7 pt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-400 dark:text-zinc-500 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>≤ 3 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>4–7 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>&gt; 7 days</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-dashed border-blue-400/60" />
          <span>p50 · {p50}d</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-dashed border-amber-400/60" />
          <span>p85 · {p85}d</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-dashed border-red-400/60" />
          <span>p95 · {p95}d</span>
        </div>
      </div>
      </div>{/* end flex-1 justify-end wrapper */}
    </div>
  );
}
