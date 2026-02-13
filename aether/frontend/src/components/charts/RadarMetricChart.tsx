import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarMetricChartProps {
  data: {
    user: string;
    metrics: {
      reviewSpeed: number;
      codeQuality: number;
      collaboration: number;
      throughput: number;
      consistency: number;
    };
  };
  className?: string;
}

export function RadarMetricChart({ data, className = '' }: RadarMetricChartProps) {
  // Transform data for recharts
  const chartData = [
    { metric: 'Review Speed', value: data.metrics.reviewSpeed, fullMark: 100 },
    { metric: 'Code Quality', value: data.metrics.codeQuality, fullMark: 100 },
    { metric: 'Collaboration', value: data.metrics.collaboration, fullMark: 100 },
    { metric: 'Throughput', value: data.metrics.throughput, fullMark: 100 },
    { metric: 'Consistency', value: data.metrics.consistency, fullMark: 100 },
  ];

  return (
    <div className={`p-6 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Code Review Metrics
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {data.user} - Performance Radar
        </p>
      </div>

      <div className="chart-container" data-chart-id="radar-metrics" style={{ minHeight: '400px' }}>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={chartData}>
            <PolarGrid stroke="#71717a" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: '#71717a', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#71717a', fontSize: 10 }}
            />
            <Radar
              name={data.user}
              dataKey="value"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.6}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#fafafa'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
