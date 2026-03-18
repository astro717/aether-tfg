import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi } from '../api/managerApi';
import { WorkItemAgeChart, ThroughputHistogram, RealCFDChart } from '../components/charts';
import { ControlChart } from '../../../components/charts';
import {
  Clock, Zap, Layers, CheckCircle2, AlertTriangle, TrendingUp,
  TrendingDown, Minus, Users, Activity, ChevronLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIs {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  completionRate: number;
  overdueTasks: number;
  teamSize: number;
  cycleTime: number;
  onTimeRate: number;
  riskScore: number;
  velocity?: number;
  changeFailureRate?: number;
  teamFriction?: { sentimentScore: number; frictionTrend: string; isStable: boolean };
}

interface AnalyticsData {
  kpis: KPIs;
  velocityData: Array<{ week: string; completed: number; weekStart: string }>;
  individualPerformance: Array<{ username: string; completed: number; inProgress: number }>;
  recentTasks: Array<{ id: string; title: string; status: string; assignee: string; created_at: string }>;
  premiumCharts?: {
    sparklines?: Record<string, number[]>;
    cfd?: Array<{ date: string; done: number; in_progress: number; todo: number }>;
    heatmap?: { users: string[]; days: string[]; data: number[][] };
    burndown?: { real: number[]; ideal: number[]; projection: number[] };
    cycleTimeScatter?: Array<{ date: string; days: number; taskTitle: string }>;
    workItemAge?: Array<{ id: string; title: string; ageInDays: number; status: string; assignee: string }>;
    investment?: { labels: string[]; datasets: Array<{ data: number[]; backgroundColor: string[] }> };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7d' },
  { value: 'month', label: '30d' },
  { value: 'quarter', label: '3M' },
  { value: 'all', label: 'All' },
] as const;

const CFD_RANGE_MAP: Record<string, string> = {
  today: '7d',
  week: '7d',
  month: '30d',
  quarter: '90d',
  all: 'all',
};

function calcFlowScore(kpis: KPIs): number {
  const completion = Math.min(kpis.completionRate ?? 0, 100);
  const onTime = Math.min(kpis.onTimeRate ?? 0, 100);
  const risk = Math.max(0, 100 - (kpis.riskScore ?? 0));
  const ct = kpis.cycleTime ?? 5;
  const cycleScore = Math.max(0, Math.min(100, 100 - ((ct - 1) / 9) * 100));
  return Math.round(completion * 0.3 + onTime * 0.3 + risk * 0.2 + cycleScore * 0.2);
}

function scoreColor(s: number): string {
  if (s >= 75) return '#4ECDC4';
  if (s >= 50) return '#F5A623';
  return '#FF5252';
}

function scoreLabel(s: number): string {
  if (s >= 75) return 'Excellent';
  if (s >= 50) return 'Moderate';
  return 'At Risk';
}

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

// ─── Flow Score Gauge ─────────────────────────────────────────────────────────

function FlowGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  const color = scoreColor(score);
  const label = scoreLabel(score);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const R = 68;
  const cx = 100, cy = 110;
  const startAngle = 215;
  const endAngle = 325;
  const totalArc = 360 - startAngle + endAngle; // 270°

  function polar(angle: number, r: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(from: number, to: number, r: number) {
    const s = polar(from, r);
    const e = polar(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const animatedEnd = startAngle + (animated / 100) * totalArc;

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 160" className="w-52 h-40">
        {/* Track */}
        <path
          d={arcPath(startAngle, startAngle + totalArc, R)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={arcPath(startAngle, Math.max(startAngle + 0.01, animatedEnd), R)}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          style={{ transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
        {/* Score */}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          fill="white"
          fontSize="34"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
        >
          {Math.round(animated)}
        </text>
        <text
          x={cx} y={cy + 16}
          textAnchor="middle"
          fill={color}
          fontSize="10"
          fontFamily="'Bricolage Grotesque', sans-serif"
          fontWeight="600"
          letterSpacing="2"
        >
          {label.toUpperCase()}
        </text>
      </svg>
      <div className="text-center -mt-3">
        <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-[11px] tracking-widest text-white/30 font-semibold uppercase">
          Flow Score
        </p>
      </div>
    </div>
  );
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

interface SignalCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit?: string;
  decimals?: number;
  sub?: string;
  accent?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendGood?: 'up' | 'down'; // which direction is positive
}

function SignalCard({ icon, label, value, unit = '', decimals = 0, sub, accent = '#5AABFF', trend, trendGood = 'up' }: SignalCardProps) {
  const isPositive = trend === trendGood;
  const isNeutral = trend === 'neutral' || !trend;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = isNeutral ? 'rgba(255,255,255,0.3)' : isPositive ? '#4ECDC4' : '#FF5252';

  return (
    <motion.div
      whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.14)' }}
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        padding: '20px',
        fontFamily: "'Bricolage Grotesque', sans-serif",
      }}
      className="flex flex-col gap-3 transition-all duration-200 cursor-default"
    >
      <div className="flex items-center justify-between">
        <div style={{ color: accent, opacity: 0.8 }}>{icon}</div>
        {trend && (
          <div style={{ color: trendColor }} className="flex items-center gap-1">
            <TrendIcon size={12} />
          </div>
        )}
      </div>
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'white', fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>
          <AnimatedNumber value={value} decimals={decimals} />{unit}
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontWeight: 500 }}>{label}</p>
      </div>
      {sub && (
        <p style={{ fontSize: '11px', color: accent, opacity: 0.6, fontWeight: 500 }}>{sub}</p>
      )}
    </motion.div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div style={{ width: '2px', height: '14px', background: 'rgba(255,255,255,0.15)', borderRadius: '1px' }} />
      <p style={{
        fontFamily: "'Bricolage Grotesque', sans-serif",
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        color: 'rgba(255,255,255,0.35)',
        textTransform: 'uppercase',
      }}>
        {children}
      </p>
    </div>
  );
}

// ─── Team Performance Bar ─────────────────────────────────────────────────────

function PerfBar({ username, completed, inProgress, maxCompleted }: {
  username: string;
  completed: number;
  inProgress: number;
  maxCompleted: number;
}) {
  const pct = maxCompleted > 0 ? (completed / maxCompleted) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.6)',
        flexShrink: 0,
      }}>
        {username[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1.5">
          <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
            {username}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {completed} done · {inProgress} wip
          </span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] as any }}
            style={{ height: '100%', background: '#4ECDC4', borderRadius: '2px' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  done: { label: 'Completed', color: '#4ECDC4' },
  in_progress: { label: 'Started', color: '#5AABFF' },
  todo: { label: 'Added', color: 'rgba(255,255,255,0.4)' },
  pending_validation: { label: 'Review', color: '#F5A623' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
`;

const OBSIDIAN = '#07080A';

export function AnalyticsDashboardV4() {
  const { currentOrganization } = useOrganization();
  const [period, setPeriod] = useState<string>('month');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [cfdData, setCfdData] = useState<Array<{ date: string; done: number; in_progress: number; todo: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const [data, cfd] = await Promise.all([
        managerApi.getAnalytics(currentOrganization.id, period),
        managerApi.getCFD(currentOrganization.id, (CFD_RANGE_MAP[period] ?? '30d') as '7d' | '30d' | '90d' | 'all'),
      ]);
      setAnalytics(data as AnalyticsData);
      setCfdData(Array.isArray(cfd) ? cfd : (cfd as { data?: typeof cfdData })?.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = analytics?.kpis;
  const flowScore = kpis ? calcFlowScore(kpis) : 0;
  const scatter = analytics?.premiumCharts?.cycleTimeScatter ?? [];
  const workItemAge = analytics?.premiumCharts?.workItemAge ?? [];
  const velocity = analytics?.velocityData ?? [];
  const perf = analytics?.individualPerformance ?? [];
  const recent = analytics?.recentTasks ?? [];
  const maxCompleted = Math.max(...perf.map(p => p.completed), 1);

  const stagger = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] as any } } as any);

  return (
    <div
      className="h-full overflow-y-auto dark"
      style={{ background: OBSIDIAN, fontFamily: "'Bricolage Grotesque', sans-serif" }}
    >
      <style>{FONT_IMPORT}</style>

      <div className="max-w-[1400px] mx-auto px-8 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div {...stagger(0)} className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <Link
              to="/manager"
              className="flex items-center gap-1.5 transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 500 }}
            >
              <ChevronLeft size={14} />
              Back
            </Link>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
                Analytics
              </h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', fontWeight: 400 }}>
                {currentOrganization?.name ?? 'Team'} · Performance Overview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div
              style={{
                display: 'flex', gap: '2px', padding: '3px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
              }}
            >
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'all 0.15s ease',
                    background: period === p.value ? 'rgba(255,255,255,0.09)' : 'transparent',
                    color: period === p.value ? 'white' : 'rgba(255,255,255,0.35)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Clock */}
            <div style={{
              padding: '6px 14px', borderRadius: '9px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px', color: 'rgba(255,255,255,0.3)',
            }}>
              {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center py-32"
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.06)',
                  borderTop: '2px solid rgba(255,255,255,0.4)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
                  Loading analytics…
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key={period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>

              {/* ── Hero Row ──────────────────────────────────────────────── */}
              <motion.div {...stagger(1)} className="mb-6">
                <SectionLabel>Team Health</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px' }}>

                  {/* Flow Score */}
                  <div style={{
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '20px',
                    padding: '24px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FlowGauge score={flowScore} />
                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
                      <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', fontWeight: 700, color: 'white' }}>
                          {kpis?.completionRate?.toFixed(0) ?? '—'}%
                        </p>
                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
                          Completion
                        </p>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', fontWeight: 700, color: 'white' }}>
                          {kpis?.onTimeRate?.toFixed(0) ?? '—'}%
                        </p>
                        <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
                          On Time
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Signal Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <SignalCard
                      icon={<Clock size={16} />}
                      label="Avg Cycle Time"
                      value={kpis?.cycleTime ?? 0}
                      decimals={1}
                      unit="d"
                      accent="#F5A623"
                      sub="Time from start to done"
                    />
                    <SignalCard
                      icon={<Zap size={16} />}
                      label="Weekly Throughput"
                      value={analytics?.velocityData?.length
                        ? Math.round(analytics.velocityData.slice(-4).reduce((s, v) => s + v.completed, 0) / Math.min(4, analytics.velocityData.length))
                        : 0}
                      unit=" tasks"
                      accent="#5AABFF"
                      sub="Avg last 4 weeks"
                    />
                    <SignalCard
                      icon={<Layers size={16} />}
                      label="WIP"
                      value={kpis?.inProgressTasks ?? 0}
                      accent="#C15F3C"
                      sub="Active work in flight"
                    />
                    <SignalCard
                      icon={<AlertTriangle size={16} />}
                      label="Overdue"
                      value={kpis?.overdueTasks ?? 0}
                      accent="#FF5252"
                      sub={kpis?.overdueTasks === 0 ? 'All clear' : 'Needs attention'}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Secondary signal row */}
              <motion.div {...stagger(2)} className="mb-8">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <SignalCard
                    icon={<CheckCircle2 size={16} />}
                    label="Tasks Completed"
                    value={kpis?.completedTasks ?? 0}
                    accent="#4ECDC4"
                    sub={`of ${kpis?.totalTasks ?? 0} total`}
                  />
                  <SignalCard
                    icon={<Users size={16} />}
                    label="Team Size"
                    value={kpis?.teamSize ?? 0}
                    accent="#5AABFF"
                    sub="Active contributors"
                  />
                  <SignalCard
                    icon={<Activity size={16} />}
                    label="Risk Score"
                    value={kpis?.riskScore ?? 0}
                    accent="#FF5252"
                    sub={kpis?.riskScore && kpis.riskScore > 60 ? 'High risk — investigate' : 'Within bounds'}
                  />
                  <SignalCard
                    icon={<TrendingUp size={16} />}
                    label="Change Failure"
                    value={kpis?.changeFailureRate ?? 0}
                    decimals={1}
                    unit="%"
                    accent="#F5A623"
                    sub="Failed deploys ratio"
                  />
                </div>
              </motion.div>

              {/* ── CFD + Control Chart ───────────────────────────────────── */}
              <motion.div {...stagger(3)} className="mb-6">
                <SectionLabel>Flow Dynamics</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <RealCFDChart
                    data={cfdData}
                    period={period as 'today' | 'week' | 'month' | 'quarter' | 'all'}
                    title="Cumulative Flow"
                    subtitle="Work distribution over time"
                  />
                  <ControlChart
                    data={scatter}
                    className=""
                  />
                </div>
              </motion.div>

              {/* ── Work Item Age + Throughput Histogram ──────────────────── */}
              <motion.div {...stagger(4)} className="mb-6">
                <SectionLabel>Delivery Intelligence</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <WorkItemAgeChart data={workItemAge} />
                  <ThroughputHistogram data={velocity} />
                </div>
              </motion.div>

              {/* ── Team Performance + Activity ───────────────────────────── */}
              <motion.div {...stagger(5)} className="mb-8">
                <SectionLabel>Team Signal</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                  {/* Individual Performance */}
                  <div style={{
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '20px',
                    padding: '24px',
                  }}>
                    <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
                      Individual Performance
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '20px' }}>
                      Completed tasks per team member
                    </p>
                    <div className="space-y-1">
                      {perf.length === 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>No data for this period.</p>
                      ) : (
                        [...perf].sort((a, b) => b.completed - a.completed).map((p) => (
                          <PerfBar
                            key={p.username}
                            username={p.username}
                            completed={p.completed}
                            inProgress={p.inProgress}
                            maxCompleted={maxCompleted}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Activity Feed */}
                  <div style={{
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '20px',
                    padding: '24px',
                  }}>
                    <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
                      Recent Activity
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '20px' }}>
                      Latest task movements
                    </p>
                    <div className="space-y-3">
                      {recent.slice(0, 8).map((task) => {
                        const meta = STATUS_META[task.status] ?? { label: task.status, color: 'rgba(255,255,255,0.4)' };
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: meta.color,
                              marginTop: '5px', flexShrink: 0,
                              boxShadow: `0 0 4px ${meta.color}`,
                            }} />
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {task.title}
                              </p>
                              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>
                                <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                                {' · '}{task.assignee}{' · '}{timeAgo(task.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {recent.length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>No recent activity.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ── Footer ───────────────────────────────────────────────── */}
              <motion.div {...stagger(6)}>
                <div style={{
                  padding: '16px 24px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
                    aether · analytics v4
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {clock.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
