import { useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  Users,
  AlertTriangle,
  ListTodo,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi, type AnalyticsData } from '../api/managerApi';
import { StatCard } from './StatCard';
import {
  SparklineCard,
  SmoothCFDChart,
  InvestmentSunburst,
  WorkloadHeatmap,
  PredictiveBurndownChart,
} from './charts';

interface AnalyticsDashboardProps {
  onOpenAIReport: () => void;
}

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'all';

const PERIOD_OPTIONS: { value: PeriodType; label: string; shortLabel: string }[] = [
  { value: 'today', label: 'Today', shortLabel: 'Today' },
  { value: 'week', label: 'This Week', shortLabel: 'Week' },
  { value: 'month', label: 'This Month', shortLabel: 'Month' },
  { value: 'quarter', label: 'Last 3 Months', shortLabel: '3M' },
  { value: 'all', label: 'All Time', shortLabel: 'All' },
];

export function AnalyticsDashboard({ onOpenAIReport }: AnalyticsDashboardProps) {
  const { currentOrganization } = useOrganization();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');

  const fetchAnalytics = async (period: PeriodType = selectedPeriod) => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    setError(null);
    try {
      const data = await managerApi.getAnalytics(currentOrganization.id, period);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: PeriodType) => {
    setSelectedPeriod(period);
    fetchAnalytics(period);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [currentOrganization?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="p-4 rounded-full bg-red-100 dark:bg-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={() => fetchAnalytics()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) return null;

  const { kpis, velocityData, individualPerformance } = analytics;

  return (
    <div className="space-y-8">
      {/* Header with Period Selector and AI Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Team Analytics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time insights for your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePeriodChange(option.value)}
                className={`
                  px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${selectedPeriod === option.value
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }
                `}
                title={option.label}
              >
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.shortLabel}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchAnalytics()}
            className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenAIReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Generate AI Report</span>
            <span className="sm:hidden">AI Report</span>
          </button>
        </div>
      </div>

      {/* Hero KPIs with Sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SparklineCard
          title="Completed Tasks"
          value={kpis.completedTasks}
          sparklineData={analytics.premiumCharts?.sparklines?.completionRate || []}
          color="green"
          trend={kpis.completionRate >= 70 ? 'up' : kpis.completionRate >= 40 ? 'neutral' : 'down'}
          subtitle={`${kpis.completionRate}% completion rate`}
        />
        <SparklineCard
          title="Velocity"
          value={velocityData.length > 0 ? velocityData[velocityData.length - 1].completed : 0}
          unit="tasks/week"
          sparklineData={analytics.premiumCharts?.sparklines?.velocity || []}
          color="blue"
          subtitle="Weekly throughput"
        />
        <SparklineCard
          title="Cycle Time"
          value={analytics.premiumCharts?.sparklines?.cycleTime?.[analytics.premiumCharts.sparklines.cycleTime.length - 1]
            ? Math.round(analytics.premiumCharts.sparklines.cycleTime[analytics.premiumCharts.sparklines.cycleTime.length - 1])
            : 0}
          unit="days"
          sparklineData={analytics.premiumCharts?.sparklines?.cycleTime || []}
          color="amber"
          subtitle="Time to complete"
        />
        <SparklineCard
          title="Risk Score"
          value={analytics.premiumCharts?.sparklines?.riskScore?.[0] || 0}
          sparklineData={[]}
          color={
            (analytics.premiumCharts?.sparklines?.riskScore?.[0] || 0) > 70 ? 'red' :
              (analytics.premiumCharts?.sparklines?.riskScore?.[0] || 0) > 40 ? 'amber' : 'green'
          }
          trend={
            (analytics.premiumCharts?.sparklines?.riskScore?.[0] || 0) < 30 ? 'up' :
              (analytics.premiumCharts?.sparklines?.riskScore?.[0] || 0) < 70 ? 'neutral' : 'down'
          }
          subtitle={kpis.overdueTasks > 0 ? `${kpis.overdueTasks} overdue` : 'On track'}
        />
      </div>

      {/* Supporting KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Team Size"
          value={kpis.teamSize}
          subtitle="Active members"
          icon={<Users className="w-5 h-5" />}
          color="zinc"
        />
        <StatCard
          title="To Do"
          value={kpis.todoTasks}
          subtitle="Backlog items"
          icon={<ListTodo className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Pending Validation"
          value={kpis.pendingValidation}
          subtitle="Needs review"
          icon={<ClipboardCheck className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Overdue"
          value={kpis.overdueTasks}
          subtitle="Needs attention"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          trend={kpis.overdueTasks > 0 ? 'down' : 'up'}
          trendValue={kpis.overdueTasks > 0 ? 'At risk' : 'On track'}
        />
      </div>

      {/* Primary Charts: Flow + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-[50_50%] gap-6">
        {analytics.premiumCharts?.cfd && (
          <SmoothCFDChart data={analytics.premiumCharts.cfd} period={selectedPeriod} />
        )}
        {analytics.premiumCharts?.investment && (
          <InvestmentSunburst data={analytics.premiumCharts.investment} />
        )}
      </div>

      {/* Secondary Charts: Heatmap + Burndown */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {analytics.premiumCharts?.heatmap && (
          <WorkloadHeatmap data={analytics.premiumCharts.heatmap} />
        )}
        {analytics.premiumCharts?.burndown && (
          <PredictiveBurndownChart data={analytics.premiumCharts.burndown} period={selectedPeriod} />
        )}
      </div>

      {/* Individual Performance - Enhanced with Gradients */}
      <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-all">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Individual Performance
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Top contributors by completed tasks
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={individualPerformance}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="colorInProgress" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="username"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(24, 24, 27, 0.9)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar
                dataKey="completed"
                name="Completed"
                fill="url(#colorCompleted)"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="inProgress"
                name="In Progress"
                fill="url(#colorInProgress)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          {analytics.recentTasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-700/30"
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-2 h-2 rounded-full
                  ${task.status === 'done' ? 'bg-emerald-500' : ''}
                  ${task.status === 'in_progress' ? 'bg-blue-500' : ''}
                  ${task.status === 'todo' ? 'bg-gray-400' : ''}
                  ${task.status === 'pending_validation' ? 'bg-amber-500' : ''}
                `} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                    {task.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {task.assignee}
                  </p>
                </div>
              </div>
              <span className={`
                text-xs px-2 py-1 rounded-full
                ${task.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : ''}
                ${task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : ''}
                ${task.status === 'todo' ? 'bg-gray-100 text-gray-700 dark:bg-zinc-600/30 dark:text-gray-400' : ''}
                ${task.status === 'pending_validation' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : ''}
              `}>
                {task.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
