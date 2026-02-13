import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

interface CFDAreaChartProps {
  data: {
    dates: string[];
    todo: number[];
    in_progress: number[];
    pending_validation: number[];
    done: number[];
  };
  className?: string;
}

export function CFDAreaChart({ data, className = '' }: CFDAreaChartProps) {
  // Transform data for stacked area chart
  const chartData = data.dates.map((date, idx) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    todo: data.todo[idx] || 0,
    'In Progress': data.in_progress[idx] || 0,
    'Pending Validation': data.pending_validation[idx] || 0,
    done: data.done[idx] || 0,
  }));

  return (
    <div className={`p-6 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Cumulative Flow Diagram
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Task distribution over time (Last 30 days)
        </p>
      </div>

      <div className="chart-container" data-chart-id="cfd-area" style={{ minHeight: '400px' }}>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorTodo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#71717a" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#71717a" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorPendingValidation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
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
              iconType="square"
            />
            <Area
              type="monotone"
              dataKey="done"
              stackId="1"
              stroke="#10b981"
              fill="url(#colorDone)"
              name="Done"
            />
            <Area
              type="monotone"
              dataKey="Pending Validation"
              stackId="1"
              stroke="#f59e0b"
              fill="url(#colorPendingValidation)"
            />
            <Area
              type="monotone"
              dataKey="In Progress"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#colorInProgress)"
            />
            <Area
              type="monotone"
              dataKey="todo"
              stackId="1"
              stroke="#71717a"
              fill="url(#colorTodo)"
              name="To Do"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
