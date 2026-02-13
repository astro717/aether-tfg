import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  CheckCircle,
  Clock,
  Users,
  AlertTriangle,
  TrendingUp,
  ListTodo,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi, type AnalyticsData } from '../api/managerApi';
import { StatCard } from './StatCard';

const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  gray: '#6b7280',
};

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

  const { kpis, velocityData, statusDistribution, individualPerformance } = analytics;

  return (
    <div className="space-y-6">
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={kpis.totalTasks}
          subtitle={PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label || 'All time'}
          icon={<ListTodo className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Completed"
          value={kpis.completedTasks}
          subtitle={`${kpis.completionRate}% completion rate`}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          trend={kpis.completionRate >= 70 ? 'up' : kpis.completionRate >= 40 ? 'neutral' : 'down'}
          trendValue={`${kpis.completionRate}%`}
        />
        <StatCard
          title="In Progress"
          value={kpis.inProgressTasks}
          subtitle="Active work"
          icon={<Clock className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Pending Validation"
          value={kpis.pendingValidation}
          subtitle="Needs review"
          icon={<ClipboardCheck className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Secondary KPIs */}
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
          title="Overdue"
          value={kpis.overdueTasks}
          subtitle="Needs attention"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          trend={kpis.overdueTasks > 0 ? 'down' : 'up'}
          trendValue={kpis.overdueTasks > 0 ? 'At risk' : 'On track'}
        />
        <StatCard
          title="Velocity"
          value={velocityData.length > 0 ? velocityData[velocityData.length - 1].completed : 0}
          subtitle="Tasks this week"
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Velocity Chart */}
        <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Team Velocity
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Tasks completed per week
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#374151', opacity: 0.2 }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#374151', opacity: 0.2 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke={CHART_COLORS.success}
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.success, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: CHART_COLORS.success }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Task Distribution
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            By current status
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#6b7280', strokeWidth: 1 }}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(24, 24, 27, 0.9)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                  labelStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Individual Performance */}
      <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm">
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
                fill={CHART_COLORS.success}
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="inProgress"
                name="In Progress"
                fill={CHART_COLORS.warning}
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
