/**
 * Analytics V3 — Experimental redesign of Live Pulse + Period KPIs + Signals
 * Everything below "Flow" is intentionally excluded — this is a focused A/B view.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, FlaskConical, RefreshCw, Sparkles, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Gauge, Clock, BarChart3, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi, type AnalyticsData } from '../api/managerApi';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { AIReportModal } from '../components/AIReportModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'all';

const PERIOD_OPTIONS: { value: PeriodType; label: string; shortLabel: string }[] = [
  { value: 'today',   label: 'Today',         shortLabel: 'Today' },
  { value: 'week',    label: 'Last 7 Days',   shortLabel: '7d'    },
  { value: 'month',   label: 'Last 30 Days',  shortLabel: '30d'   },
  { value: 'quarter', label: 'Last 3 Months', shortLabel: '3M'    },
  { value: 'all',     label: 'All Time',      shortLabel: 'All'   },
];

// ── Color tokens (Tailwind-only, no inline style hex) ─────────────────────────

type PulseColor = 'blue' | 'amber' | 'red' | 'green' | 'violet';

const PULSE_VALUE_CLS: Record<PulseColor, string> = {
  blue:   'text-blue-500 dark:text-blue-400',
  amber:  'text-amber-500 dark:text-amber-400',
  red:    'text-red-500 dark:text-red-400',
  green:  'text-emerald-500 dark:text-emerald-400',
  violet: 'text-violet-500 dark:text-violet-400',
};

const PULSE_DOT_CLS: Record<PulseColor, string> = {
  blue:   'bg-blue-500',
  amber:  'bg-amber-500',
  red:    'bg-red-500',
  green:  'bg-emerald-500',
  violet: 'bg-violet-500',
};

// Signal severity → Tailwind-only tokens (no hex)
const SIG = {
  critical: {
    dotCls:    'bg-red-500',
    textCls:   'text-red-500 dark:text-red-400',
    squareCls: 'bg-red-500',
    labelCls:  'text-red-600 dark:text-red-400 border border-red-500/30 bg-red-500/10',
    badgeCls:  'text-red-500 dark:text-red-400 bg-red-500/[0.08] border border-red-500/20',
  },
  warning: {
    dotCls:    'bg-amber-500',
    textCls:   'text-amber-500 dark:text-amber-400',
    squareCls: 'bg-amber-500',
    labelCls:  'text-amber-600 dark:text-amber-400 border border-amber-500/30 bg-amber-500/10',
    badgeCls:  'text-amber-500 dark:text-amber-400 bg-amber-500/[0.08] border border-amber-500/20',
  },
  info: {
    dotCls:    'bg-blue-500',
    textCls:   'text-blue-500 dark:text-blue-400',
    squareCls: 'bg-blue-500',
    labelCls:  'text-blue-600 dark:text-blue-400 border border-blue-500/30 bg-blue-500/10',
    badgeCls:  'text-blue-500 dark:text-blue-400 bg-blue-500/[0.08] border border-blue-500/20',
  },
} as const;

// ── Derived Insights ───────────────────────────────────────────────────────────

interface DerivedInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  icon: React.ReactNode;
  headline: string;
  context: string;
  badge?: string;
}

function deriveInsights(
  kpis: AnalyticsData['kpis'],
  velocityData: AnalyticsData['velocityData'],
  individualPerformance: AnalyticsData['individualPerformance'],
  workItemAge: Array<{ ageInDays: number; title: string }>,
  p85CycleTime: number | undefined,
  realCFDData: Array<{ done: number; in_progress: number; todo: number }>,
  isToday: boolean,
): DerivedInsight[] {
  const insights: DerivedInsight[] = [];
  const recent = velocityData.slice(-3);
  const avgThroughput = recent.length > 0
    ? recent.reduce((s, w) => s + w.completed, 0) / recent.length : 0;

  if (!isToday && avgThroughput > 0 && kpis.inProgressTasks >= 2) {
    const waitWeeks = kpis.inProgressTasks / avgThroughput;
    if (waitWeeks >= 1.5)
      insights.push({
        id: 'littles-law',
        severity: waitWeeks >= 3 ? 'critical' : 'warning',
        icon: <Gauge className="w-3 h-3" />,
        headline: `WIP load implies ~${waitWeeks.toFixed(1)}-week delivery wait`,
        context: `${kpis.inProgressTasks} in flight · ${avgThroughput.toFixed(1)} tasks/week avg — Little's Law`,
        badge: `~${waitWeeks.toFixed(1)}w`,
      });
  }

  if (p85CycleTime && workItemAge.length > 0) {
    const outliers = workItemAge.filter(t => t.ageInDays > p85CycleTime);
    if (outliers.length > 0) {
      const pct = Math.round((outliers.length / workItemAge.length) * 100);
      insights.push({
        id: 'age-outliers',
        severity: pct >= 50 ? 'critical' : 'warning',
        icon: <Clock className="w-3 h-3" />,
        headline: `${outliers.length} active task${outliers.length > 1 ? 's' : ''} past the p85 cycle time`,
        context: `${pct}% of WIP exceeds ${p85CycleTime}d threshold — pulling delivery averages up`,
        badge: `p85: ${p85CycleTime}d`,
      });
    }
  }

  if (individualPerformance.length >= 2) {
    const totalWIP = individualPerformance.reduce((s, m) => s + m.inProgress, 0);
    const avg = totalWIP / individualPerformance.length;
    const heavy = [...individualPerformance]
      .sort((a, b) => b.inProgress - a.inProgress)
      .find(m => m.inProgress > Math.max(avg * 2, 3));
    if (heavy && avg > 0) {
      const mult = (heavy.inProgress / avg).toFixed(1);
      insights.push({
        id: 'load-imbalance',
        severity: 'warning',
        icon: <Users className="w-3 h-3" />,
        headline: `${heavy.username} carries ${mult}× the team average WIP`,
        context: `${heavy.inProgress} active tasks vs team avg of ${avg.toFixed(1)} — bottleneck risk`,
        badge: `${heavy.inProgress} tasks`,
      });
    }
  }

  if (!isToday && realCFDData.length >= 2) {
    const first = realCFDData[0];
    const last  = realCFDData[realCFDData.length - 1];
    const netCreated = (last.todo + last.in_progress + last.done) - (first.todo + first.in_progress + first.done);
    const completed  = last.done - first.done;
    const growth = netCreated - completed;
    if (growth >= 3)
      insights.push({
        id: 'scope-creep',
        severity: growth >= 8 ? 'warning' : 'info',
        icon: <BarChart3 className="w-3 h-3" />,
        headline: `Backlog grew by ${growth} task${growth !== 1 ? 's' : ''} this period`,
        context: `${netCreated} created, ${completed} completed — input outpacing output`,
        badge: `+${growth}`,
      });
  }

  if (!isToday && avgThroughput > 0 && recent.length >= 2)
    insights.push({
      id: 'forecast',
      severity: 'info',
      icon: <TrendingUp className="w-3 h-3" />,
      headline: `Forecast: ~${Math.round(avgThroughput)} completion${Math.round(avgThroughput) !== 1 ? 's' : ''} expected this week`,
      context: `${recent.length}-week rolling avg — use as baseline for capacity planning`,
      badge: `${avgThroughput.toFixed(1)}/wk`,
    });

  const order = ['critical', 'warning', 'info'] as const;
  return insights.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)).slice(0, 4);
}

// ── Signal Feed ────────────────────────────────────────────────────────────────
// Clean card, no colored backgrounds. Tailwind-only colors.

function SignalFeed({ insights }: { insights: DerivedInsight[] }) {
  if (insights.length === 0) return null;
  const dominant = insights[0].severity;
  const cfg = SIG[dominant];

  return (
    <motion.div
      role={dominant === 'info' ? 'status' : 'alert'}
      aria-label={`${insights.length} ${dominant} signal${insights.length > 1 ? 's' : ''}`}
      aria-live={dominant !== 'info' ? 'assertive' : 'polite'}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl border border-gray-100 dark:border-zinc-700/50 rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full relative z-10 ${cfg.dotCls}`} />
            {dominant !== 'info' && (
              <div className={`absolute inset-0 rounded-full opacity-25 motion-safe:animate-ping ${cfg.dotCls}`} />
            )}
          </div>
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gray-400 dark:text-zinc-500">
            Signals
          </span>
          <span className="text-[10px] text-gray-300 dark:text-zinc-700">·</span>
          <span className={`text-[10px] font-mono font-semibold ${cfg.textCls}`}>
            {insights.length}
          </span>
        </div>
        <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md ${cfg.labelCls}`}>
          {dominant}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
        {insights.map((insight, i) => {
          const rowCfg = SIG[insight.severity];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.04 + i * 0.045 }}
              className="flex items-center gap-3.5 px-5 py-3"
            >
              {/* Status square */}
              <div className={`shrink-0 w-[5px] h-[5px] rounded-[2px] ${rowCfg.squareCls}`} />

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white/85 leading-snug truncate">
                  {insight.headline}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 leading-snug mt-0.5 truncate">
                  {insight.context}
                </p>
              </div>

              {/* Badge */}
              {insight.badge && (
                <span className={`shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${rowCfg.badgeCls}`}>
                  {insight.badge}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Live Pulse Rail ────────────────────────────────────────────────────────────
// One unified horizontal card. Tailwind color keys — no inline hex.

interface PulseMetric {
  label: string;
  sub: string;
  value: string | number;
  colorKey: PulseColor;
}

function LivePulseRail({ metrics }: { metrics: PulseMetric[] }) {
  return (
    <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl border border-gray-100 dark:border-zinc-700/50 rounded-2xl shadow-sm overflow-hidden">
      {/* Label */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 dark:border-white/[0.04]">
        <div className="relative w-3 h-3 flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative z-10" />
          <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-25 motion-safe:animate-ping" />
        </div>
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gray-400 dark:text-zinc-500">
          Live Pulse
        </span>
        <span className="text-[10px] text-gray-300 dark:text-zinc-700">·</span>
        <span className="text-[10px] text-gray-400 dark:text-zinc-500">Current organization state</span>
      </div>

      {/* Metrics grid — 2 cols on mobile, 3 on sm, 5 on lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-gray-100 dark:divide-zinc-700/40">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-col px-5 py-4 gap-0.5">
            <span className={`text-2xl font-mono font-bold leading-none ${PULSE_VALUE_CLS[m.colorKey]}`}>
              {m.value}
            </span>
            <span className="text-xs font-medium text-gray-600 dark:text-zinc-300 mt-1.5">
              {m.label}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">
              {m.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
// Number-forward. 2px accent top border. Sparkline flush to bottom.
// accentHex is kept as hex because Recharts <Line stroke> requires it.

interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  accentHex: string;
  sparklineData?: number[];
  trend?: 'up' | 'down' | 'neutral';
}

function KpiCard({ label, value, unit, subtitle, accentHex, sparklineData = [], trend }: KpiCardProps) {
  const chartData = sparklineData.map((v, i) => ({ v, i }));
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'   ? 'text-emerald-500 dark:text-emerald-400'
    : trend === 'down' ? 'text-red-400'
    : 'text-gray-300 dark:text-zinc-600';

  return (
    <div className="relative bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl border border-gray-100 dark:border-zinc-700/50 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200">
      {/* 2px accent stripe — color communicates metric health */}
      <div className="h-[2px] w-full shrink-0" style={{ background: accentHex }} />

      {/* Content */}
      <div className="flex flex-col flex-1 px-4 pt-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-gray-400 dark:text-zinc-500">
            {label}
          </span>
          {trend && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-[28px] font-mono font-bold text-gray-900 dark:text-white leading-none tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-mono text-gray-400 dark:text-zinc-500 mb-0.5">
              {unit}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 pb-3">{subtitle}</p>
        )}
        {!subtitle && <div className="pb-3" />}
      </div>

      {/* Sparkline — full-width, flush to bottom */}
      {chartData.length > 0 ? (
        <div className="h-9 -mx-px shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={accentHex}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                opacity={0.65}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        // Placeholder for cards with no sparkline data — maintains visual rhythm
        <div className="h-9 shrink-0 flex items-end px-2 pb-2">
          <div className="w-full h-px bg-gray-100 dark:bg-zinc-700/50" />
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function AnalyticsDashboardV3Page() {
  const { currentOrganization } = useOrganization();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [realCFDData, setRealCFDData] = useState<
    Array<{ date: string; done: number; in_progress: number; todo: number }>
  >([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [showAIModal, setShowAIModal] = useState(false);

  const fetchAnalytics = async (period: PeriodType = selectedPeriod) => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const cfdRange = period === 'quarter' ? '90d' : period === 'all' ? 'all' : period === 'week' ? '7d' : '30d';
      const [data, cfdData] = await Promise.all([
        managerApi.getAnalytics(currentOrganization.id, period),
        managerApi.getCFD(currentOrganization.id, cfdRange).catch(() => []),
      ]);
      setAnalytics(data);
      setRealCFDData(cfdData);
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

  useEffect(() => { fetchAnalytics(); }, [currentOrganization?.id]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const isToday = selectedPeriod === 'today';
  const workItemAge      = analytics?.premiumCharts?.workItemAge ?? [];
  const cycleTimeScatter = analytics?.premiumCharts?.cycleTimeScatter ?? [];
  const staleCount = workItemAge.filter(t => t.ageInDays > 7).length;

  const p85CycleTime = (() => {
    if (cycleTimeScatter.length === 0) return undefined;
    const sorted = [...cycleTimeScatter.map(d => d.days)].sort((a, b) => a - b);
    const idx = 0.85 * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return Math.round(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
  })();

  const insights = analytics ? deriveInsights(
    analytics.kpis, analytics.velocityData, analytics.individualPerformance,
    workItemAge, p85CycleTime, realCFDData, isToday,
  ) : [];

  const kpis = analytics?.kpis;

  // Live Pulse metrics — color keys instead of hex
  const pulseMetrics: PulseMetric[] = kpis ? [
    {
      label: 'In Progress', sub: 'Active work',
      value: kpis.inProgressTasks, colorKey: 'blue',
    },
    {
      label: 'Stale', sub: 'Age > 7 days',
      value: staleCount,
      colorKey: staleCount > 0 ? 'amber' : 'green',
    },
    {
      label: 'Overdue', sub: 'Past deadline',
      value: kpis.overdueTasks,
      colorKey: kpis.overdueTasks > 0 ? 'red' : 'green',
    },
    {
      label: 'Risk Score',
      sub: kpis.riskScore > 70 ? 'High risk' : kpis.riskScore > 40 ? 'Moderate' : 'Low risk',
      value: kpis.riskScore,
      colorKey: kpis.riskScore > 70 ? 'red' : kpis.riskScore > 40 ? 'amber' : 'green',
    },
    {
      label: 'Team Friction',
      sub: kpis.teamFriction.frictionTrend === 'up' ? 'Tension detected' : kpis.teamFriction.isStable ? 'Team stable' : 'Smooth flow',
      value: kpis.teamFriction.frictionTrend === 'up' ? 'High' : kpis.teamFriction.isStable ? 'Stable' : 'Low',
      colorKey: kpis.teamFriction.frictionTrend === 'up' ? 'red' : kpis.teamFriction.frictionTrend === 'down' ? 'green' : 'violet',
    },
  ] : [];

  const sp = analytics?.premiumCharts?.sparklines;
  const cfr = (sp as Record<string, unknown>)?.changeFailureRate as
    | { value: number; sparkline: number[] } | undefined;

  // KPI cards — accentHex is DYNAMIC: reflects actual metric health, not a fixed brand color.
  // This ensures the 2px stripe and trend arrow always agree semantically.
  const kpiCards: KpiCardProps[] = analytics ? [
    {
      label: 'Completed Tasks',
      value: kpis!.completedTasks,
      subtitle: `${kpis!.completionRate}% completion rate`,
      accentHex: kpis!.completionRate >= 70 ? '#10b981' : kpis!.completionRate >= 40 ? '#f59e0b' : '#ef4444',
      sparklineData: (sp?.completionRate as number[] | undefined) || [],
      trend: kpis!.completionRate >= 70 ? 'up' : kpis!.completionRate >= 40 ? 'neutral' : 'down',
    },
    {
      label: 'Velocity',
      value: analytics.velocityData.length > 0
        ? analytics.velocityData[analytics.velocityData.length - 1].completed : 0,
      unit: '/wk',
      subtitle: 'Weekly throughput',
      accentHex: '#3b82f6', // neutral — throughput is informational, not good/bad
      sparklineData: (sp?.velocity as number[] | undefined) || [],
    },
    {
      label: 'Cycle Time',
      value: kpis!.cycleTime,
      unit: 'd',
      subtitle: 'Time to complete',
      accentHex: '#f59e0b', // neutral amber — cycle time is context-dependent
      sparklineData: (sp?.cycleTime as number[] | undefined) || [],
    },
    {
      // Higher on-time rate = better. accentHex and trend arrow must agree.
      label: 'On-Time Delivery',
      value: kpis!.onTimeRate,
      unit: '%',
      subtitle: 'Before deadline',
      accentHex: kpis!.onTimeRate >= 80 ? '#10b981' : kpis!.onTimeRate >= 60 ? '#f59e0b' : '#ef4444',
      sparklineData: [],
      trend: kpis!.onTimeRate >= 80 ? 'up' : kpis!.onTimeRate >= 60 ? 'neutral' : 'down',
    },
    {
      // Lower failure rate = better. accentHex and trend arrow must agree.
      label: 'Failure Rate',
      value: cfr?.value ?? 0,
      unit: '%',
      subtitle: 'Tasks regressed',
      accentHex: (cfr?.value ?? 0) <= 10 ? '#10b981' : (cfr?.value ?? 0) <= 25 ? '#f59e0b' : '#ef4444',
      sparklineData: cfr?.sparkline || [],
      trend: (cfr?.value ?? 0) <= 10 ? 'up' : (cfr?.value ?? 0) <= 25 ? 'neutral' : 'down',
    },
  ] : [];

  return (
    <>
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-950 overflow-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-8 pt-8 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/manager/analytics-v2"
              className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border border-white/20 dark:border-zinc-700/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <FlaskConical size={10} />
                  V3 EXPERIMENTAL
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentOrganization?.name} · KPIs &amp; Signals redesign
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePeriodChange(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedPeriod === opt.value
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }`}
                  title={opt.label}
                >
                  <span className="hidden sm:inline">{opt.label}</span>
                  <span className="sm:hidden">{opt.shortLabel}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchAnalytics()}
                className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAIModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 px-8 pb-8 overflow-auto">
          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
              <button
                onClick={() => fetchAnalytics()}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : analytics ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Signals */}
              <AnimatePresence>
                {insights.length > 0 && <SignalFeed insights={insights} />}
              </AnimatePresence>

              {/* Live Pulse */}
              <LivePulseRail metrics={pulseMetrics} />

              {/* Period KPIs */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Period KPIs</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">— Time-based metrics</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {kpiCards.map((card) => (
                    <KpiCard key={card.label} {...card} />
                  ))}
                </div>
              </div>

              {/* Footer note */}
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800/60 text-center">
                <p className="text-[10px] tracking-wide text-gray-400 dark:text-zinc-600 font-mono">
                  v3 experiment · signals + live pulse + period kpis · flow section unchanged in v2
                </p>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <AIReportModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} />
    </>
  );
}
