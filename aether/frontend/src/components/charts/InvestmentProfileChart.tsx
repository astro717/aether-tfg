import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from 'recharts';

interface InvestmentProfileChartProps {
  data: {
    labels: string[];
    datasets: Array<{ label: string; data: number[]; color: string }>;
  };
  className?: string;
}

export function InvestmentProfileChart({ data, className = '' }: InvestmentProfileChartProps) {
  // Transform data for stacked bar chart (100%)
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    value: data.datasets[0]?.data[idx] || 0,
  }));

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981'];

  return (
    <div className={`p-6 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Investment Profile
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Task distribution by type (%)
        </p>
      </div>

      <div className="chart-container" data-chart-id="investment-profile" style={{ minHeight: '350px' }}>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickMargin={8}
              label={{ value: 'Percentage (%)', position: 'insideBottom', offset: -5, fill: '#71717a' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#71717a', fontSize: 12 }}
              tickMargin={8}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fafafa'
              }}
              formatter={(value) => `${value}%`}
            />
            <Legend />
            <Bar dataKey="value" name="Distribution" radius={[0, 8, 8, 0]}>
              {chartData.map((_item, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary cards below */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {chartData.map((item, idx) => (
          <div
            key={item.name}
            className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              ></div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {item.name}
              </span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {item.value}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
