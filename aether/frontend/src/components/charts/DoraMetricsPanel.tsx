import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, Zap } from 'lucide-react';

interface DoraMetricsPanelProps {
  data: {
    deploymentFrequency: number;
    leadTimeAvg: number;
    sparklineData: number[];
  };
  className?: string;
}

export function DoraMetricsPanel({ data, className = '' }: DoraMetricsPanelProps) {
  const sparklineChartData = data.sparklineData.map((value, idx) => ({ value, index: idx }));

  const metrics = [
    {
      label: 'Deployment Frequency',
      value: data.deploymentFrequency,
      unit: 'deploys',
      icon: <Zap className="w-5 h-5" />,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
    {
      label: 'Lead Time Average',
      value: data.leadTimeAvg,
      unit: 'days',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      label: 'Throughput Trend',
      value: Math.round(data.sparklineData.reduce((a, b) => a + b, 0) / data.sparklineData.length),
      unit: 'avg/day',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
    },
  ];

  return (
    <div className={`p-6 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          DORA Metrics Lite
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Key performance indicators
        </p>
      </div>

      <div className="chart-container" data-chart-id="dora-metrics">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((metric, idx) => (
            <div
              key={metric.label}
              className={`p-5 rounded-xl border ${metric.borderColor} ${metric.bgColor}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-white dark:bg-zinc-900 ${metric.color}`}>
                  {metric.icon}
                </div>
                {idx === 2 && sparklineChartData.length > 0 && (
                  <div className="w-20 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineChartData}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                  {metric.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                    {metric.value}
                  </p>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {metric.unit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
