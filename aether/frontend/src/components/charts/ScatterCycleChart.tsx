import { Scatter, ScatterChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis, Cell } from 'recharts';

interface ScatterCycleChartProps {
  data: Array<{ date: string; days: number; taskTitle: string }>;
  className?: string;
}

export function ScatterCycleChart({ data, className = '' }: ScatterCycleChartProps) {
  // Transform data for scatter chart
  const chartData = data.map((item, idx) => ({
    x: idx,
    y: item.days,
    z: 100, // Size of the dot
    taskTitle: item.taskTitle,
    date: item.date,
  }));

  // Color based on cycle time (green < 3 days, yellow 3-7, red > 7)
  const getColor = (days: number) => {
    if (days <= 3) return '#10b981';
    if (days <= 7) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className={`p-6 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Cycle Time Scatterplot
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Days to complete tasks - Last 50 completed tasks
        </p>
        <div className="flex gap-4 mt-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-zinc-600 dark:text-zinc-400">≤ 3 days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-zinc-600 dark:text-zinc-400">4-7 days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-zinc-600 dark:text-zinc-400">&gt; 7 days</span>
          </div>
        </div>
      </div>

      <div className="chart-container" data-chart-id="scatter-cycle" style={{ minHeight: '400px' }}>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              type="number"
              dataKey="x"
              name="Task Index"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
              label={{ value: 'Tasks (chronological)', position: 'insideBottom', offset: -5, fill: '#71717a' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Days"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
              label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', fill: '#71717a' }}
            />
            <ZAxis type="number" dataKey="z" range={[100, 100]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
                      <p className="font-semibold text-zinc-100 text-sm mb-1">
                        {data.taskTitle.substring(0, 40)}...
                      </p>
                      <p className="text-zinc-400 text-xs">Cycle Time: {data.y} days</p>
                      <p className="text-zinc-400 text-xs">Date: {data.date}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Tasks" data={chartData}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.y)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
