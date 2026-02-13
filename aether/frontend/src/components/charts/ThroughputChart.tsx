import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

interface ThroughputChartProps {
  data: {
    weeks: string[];
    completed: number[];
    movingAverage: number[];
  };
  className?: string;
}

export function ThroughputChart({ data, className = '' }: ThroughputChartProps) {
  // Transform data for line chart
  const chartData = data.weeks.map((week, idx) => ({
    week,
    completed: data.completed[idx] || 0,
    movingAvg: data.movingAverage[idx] || 0,
  }));

  return (
    <div className={`p-6 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Throughput Trend
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tasks completed per week with 3-week moving average
        </p>
      </div>

      <div className="chart-container" data-chart-id="throughput-trend" style={{ minHeight: '350px' }}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="week"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
              label={{ value: 'Tasks Completed', angle: -90, position: 'insideLeft', fill: '#71717a' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fafafa'
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 5, fill: '#3b82f6' }}
              name="Completed Tasks"
            />
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="3-Week Moving Avg"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            This Week
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {data.completed[data.completed.length - 1] || 0}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Average
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {Math.round(data.completed.reduce((a, b) => a + b, 0) / data.completed.length)}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Trend
          </p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {data.movingAverage[data.movingAverage.length - 1] || 0}
          </p>
        </div>
      </div>
    </div>
  );
}
