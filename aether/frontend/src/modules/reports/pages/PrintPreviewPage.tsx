/**
 * PrintPreviewPage — A4-optimised print layout for Puppeteer PDF export.
 *
 * No navbar, no sidebar. Pure report rendering.
 * Signals `window.__CHARTS_READY__ = true` once all charts are mounted so
 * the Puppeteer caller knows it can safely call page.pdf().
 *
 * URL: /reports/print-preview?token=<previewToken>
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ComposedChart,
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import type { AIReport } from '../../manager/api/managerApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PreviewData {
  report: AIReport;
  organizationName: string;
  period: string;
  reportTypeName: string;
  periodType: 'week' | 'month' | 'quarter';
  generatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativizeCFD(
  data: Array<{ date: string; done: number; in_progress: number; todo: number }>,
) {
  if (!data?.length) return data;
  const base = data[0].done;
  return data.map(p => ({ ...p, done: Math.max(0, p.done - base) }));
}

function deriveVelocityWeeks(
  cfd: Array<{ date: string; done: number; in_progress: number; todo: number }>,
) {
  if (!cfd?.length) return [];
  const weekMap = new Map<string, { first: number; last: number }>();
  for (const pt of cfd) {
    const d = new Date(pt.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(new Date(pt.date).setDate(diff));
    const key = monday.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, { first: pt.done, last: pt.done });
    else weekMap.get(key)!.last = pt.done;
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, { first, last }]) => ({
      week: new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed: Math.max(0, last - first),
      weekStart,
    }));
}

function movingAvg(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });
}

function accentForVelocity(v: number): string {
  return v > 0 ? '#10b981' : v < 0 ? '#f59e0b' : '#3b82f6';
}
function accentForOnTime(v: number): string {
  return v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';
}
function accentForRisk(v: number): string {
  return v <= 30 ? '#10b981' : v <= 60 ? '#f59e0b' : '#ef4444';
}
function accentForCfr(v: number): string {
  return v <= 10 ? '#10b981' : v <= 25 ? '#f59e0b' : '#ef4444';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle: string;
  accent: string;
}

function KpiCard({ label, value, unit, subtitle, accent }: KpiCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '11px 16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          marginTop: 4,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 29, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: '#9ca3af' }}>{unit}</span>}
      </div>
      <span style={{ fontSize: 10, color: '#9ca3af' }}>{subtitle}</span>
    </div>
  );
}

// CFD area chart for print
function PrintCFDChart({ data }: { data: Array<{ date: string; done: number; in_progress: number; todo: number }> }) {
  const displayData = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    done: d.done,
    in_progress: d.in_progress,
    todo: d.todo,
  }));
  const step = Math.max(1, Math.floor(displayData.length / 8));
  return (
    <AreaChart
      width={680}
      height={160}
      data={displayData}
      margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
    >
      <defs>
        <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
        </linearGradient>
        <linearGradient id="gradIP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="gradTodo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 10, fill: '#9ca3af' }}
        tickLine={false}
        axisLine={false}
        interval={step - 1}
      />
      <YAxis
        tick={{ fontSize: 10, fill: '#9ca3af' }}
        tickLine={false}
        axisLine={false}
        width={30}
        allowDecimals={false}
      />
      <Area type="monotone" dataKey="todo" stackId="1" stroke="#d1d5db" fill="url(#gradTodo)" isAnimationActive={false} />
      <Area type="monotone" dataKey="in_progress" stackId="1" stroke="#14b8a6" fill="url(#gradIP)" isAnimationActive={false} />
      <Area type="monotone" dataKey="done" stackId="1" stroke="#6366f1" fill="url(#gradDone)" isAnimationActive={false} />
      <Legend
        iconType="square"
        iconSize={8}
        wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
        formatter={(value) => ({ done: 'Done', in_progress: 'In Progress', todo: 'Todo' }[value] ?? value)}
      />
    </AreaChart>
  );
}

// Throughput bar+line chart
function PrintThroughputChart({ data }: { data: Array<{ week: string; completed: number; avg: number }> }) {
  const peakIdx = data.reduce((best, d, i) => d.completed > data[best].completed ? i : best, 0);
  return (
    <ComposedChart
      width={320}
      height={170}
      data={data}
      margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
    >
      <CartesianGrid strokeDasharray="0" stroke="#f3f4f6" vertical={false} />
      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} />
      <Bar dataKey="completed" name="Completed" radius={[4, 4, 2, 2]} maxBarSize={32} isAnimationActive={false}>
        {data.map((_, i) => (
          <Cell key={i} fill={i === peakIdx ? '#3b82f6' : '#93c5fd'} />
        ))}
      </Bar>
      <Line type="monotone" dataKey="avg" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </ComposedChart>
  );
}

// Task distribution — horizontal list style matching the app's visual
const DIST_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

function PrintTaskDistChart({ data }: { data: { labels: string[]; datasets: Array<{ label: string; data: number[]; color: string }> } }) {
  const items = data.labels.map((label, i) => {
    const count = data.datasets.reduce((sum, ds) => sum + (ds.data[i] ?? 0), 0);
    // Use dataset color if one-per-label, otherwise fall back to palette
    const color =
      data.datasets.length === data.labels.length
        ? (data.datasets[i]?.color ?? DIST_COLORS[i % DIST_COLORS.length])
        : DIST_COLORS[i % DIST_COLORS.length];
    return { label, count, color };
  });
  const total = items.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Total count */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>Total Tasks</span>
      </div>

      {/* Stacked horizontal bar */}
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 14 }}>
        {items.map((item, i) => (
          item.count > 0 ? (
            <div
              key={i}
              style={{ flex: item.count, background: item.color, minWidth: 3 }}
            />
          ) : null
        ))}
      </div>

      {/* Legend list */}
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: item.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10.5, color: '#374151' }}>{item.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#111827' }}>{item.count}</span>
            <span style={{ fontSize: 9.5, color: '#9ca3af', minWidth: 42, textAlign: 'right' }}>
              {((item.count / total) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Workload heatmap
function PrintHeatmap({ data }: { data: { users: string[]; days: string[]; data: number[][] } }) {
  const maxVal = Math.max(1, ...data.data.flat());
  const getColor = (v: number): string => {
    if (v === 0) return '#f9fafb';
    const intensity = v / maxVal;
    if (intensity < 0.25) return '#e0e7ff';
    if (intensity < 0.5) return '#a5b4fc';
    if (intensity < 0.75) return '#6366f1';
    return '#4338ca';
  };
  const colW = Math.max(16, Math.min(26, Math.floor(560 / (data.days.length + 1))));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ width: 90, textAlign: 'left', fontWeight: 500, color: '#9ca3af', paddingRight: 8 }} />
            {data.days.map((d, i) => {
              const label = (() => {
                if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(d + 'T00:00:00').getDate();
                if (d.startsWith('W') || d.length <= 3) return d;
                return new Date(d).getDate();
              })();
              return (
                <th
                  key={i}
                  style={{
                    width: colW,
                    textAlign: 'center',
                    fontWeight: 500,
                    color: '#9ca3af',
                    paddingBottom: 4,
                    background: '#f8f9fa',
                  }}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.users.map((user, ui) => (
            <tr key={ui}>
              <td
                style={{
                  paddingRight: 8,
                  color: '#374151',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  maxWidth: 90,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user}
              </td>
              {(data.data[ui] ?? []).map((v, di) => (
                <td
                  key={di}
                  style={{
                    width: colW,
                    height: colW,
                    background: getColor(v),
                    borderRadius: 3,
                    textAlign: 'center',
                    color: v > 0 ? (v / maxVal > 0.6 ? '#fff' : '#374151') : 'transparent',
                    fontSize: 8,
                  }}
                >
                  {v > 0 ? v : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f5f7ff',
        borderRadius: 6,
        padding: '8px 12px',
        marginBottom: 12,
        borderLeft: '3px solid #6366f1',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', letterSpacing: '0.02em' }}>
        {title}
      </span>
    </div>
  );
}

// Chart block wrapper
function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20, breakInside: 'avoid' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f5f7ff',
          padding: '5px 10px',
          borderRadius: 4,
          marginBottom: 8,
          borderLeft: '2px solid #6366f1',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// Running page header
function PageHeader({ title, orgName, generatedAt }: { title: string; orgName: string; generatedAt: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 10,
        marginBottom: 18,
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {orgName}
      </span>
      <span style={{ fontSize: 9, color: '#9ca3af' }}>
        {title} · {generatedAt}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __CHARTS_READY__: boolean;
  }
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function PrintPreviewPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chartsSignalled = useRef(false);

  const token = params.get('token');

  useEffect(() => {
    if (!token) { setError('No preview token'); return; }

    fetch(`${API_BASE}/reports/preview-data/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.message ?? 'Not found')))
      .then((d: PreviewData) => setData(d))
      .catch((e: unknown) => setError(String(e)));
  }, [token]);

  useEffect(() => {
    if (!data || chartsSignalled.current) return;
    const timer = setTimeout(() => {
      window.__CHARTS_READY__ = true;
      chartsSignalled.current = true;
    }, 800);
    return () => clearTimeout(timer);
  }, [data]);

  if (error) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', padding: 40, color: '#ef4444' }}>
        <h1>Preview Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', padding: 40, color: '#6b7280', textAlign: 'center' }}>
        <p>Loading report…</p>
      </div>
    );
  }

  const { report, organizationName, period, reportTypeName, generatedAt } = data;
  const pulse = report.chartData?.pulse;
  const cfd = report.chartData?.cfd ? relativizeCFD(report.chartData.cfd) : undefined;
  const velocityWeeks = cfd ? deriveVelocityWeeks(report.chartData!.cfd!) : [];
  const avgs = movingAvg(velocityWeeks.map(w => w.completed));
  const throughputData = velocityWeeks.map((w, i) => ({ ...w, avg: avgs[i] }));
  const hasVelocityChart = velocityWeeks.length >= 2;

  const velocityVal = pulse?.velocityRate?.value ?? 0;
  const onTimeVal = pulse?.onTimeDelivery?.value ?? 100;
  const riskVal = pulse?.riskScore?.value ?? 0;
  const cfrVal = pulse?.changeFailureRate?.value ?? 0;
  const ctVal = pulse?.cycleTime?.value ?? 0;

  const PAGE_PADDING = '18mm';
  const PAGE_BG = '#fff';

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: '#e5e7eb',
        minHeight: '100vh',
        WebkitPrintColorAdjust: 'exact',
        // @ts-expect-error non-standard
        printColorAdjust: 'exact',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { margin: 0; background: white; }
          .page-break { break-after: page; }
        }
      `}</style>

      {/* ── COVER PAGE ─────────────────────────────────────────────────────── */}
      <div
        className="page-break"
        style={{
          width: '210mm',
          minHeight: '297mm',
          background: 'linear-gradient(160deg, #3730a3 0%, #312e81 50%, #1e1b4b 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30mm 20mm',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle texture lines */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 8mm)',
          pointerEvents: 'none',
        }} />

        {/* Wordmark */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <span style={{
            fontSize: 42,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-2px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
            lineHeight: 1,
          }}>aether.</span>
          <p style={{
            fontSize: 10,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
          }}>AI-powered project intelligence</p>
        </div>

        {/* Org name */}
        <p style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          {organizationName}
        </p>

        {/* Divider */}
        <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.18)', marginBottom: 20 }} />

        {/* Report title */}
        <h1 style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'white',
          textAlign: 'center',
          lineHeight: 1.2,
          marginBottom: 14,
          maxWidth: 360,
        }}>
          {reportTypeName}
        </h1>

        {/* Period pill */}
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 999,
          padding: '6px 18px',
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: '0.04em',
          marginBottom: pulse ? 40 : 0,
        }}>
          {period}
        </div>

        {/* Hero stats */}
        {pulse && (
          <div style={{
            display: 'flex',
            gap: 24,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '20px 32px',
            backdropFilter: 'blur(8px)',
          }}>
            {[
              { value: `${velocityVal > 0 ? '+' : ''}${velocityVal}%`, label: 'Velocity', color: accentForVelocity(velocityVal) },
              { value: `${onTimeVal}%`, label: 'On-Time', color: accentForOnTime(onTimeVal) },
              { value: String(riskVal), label: 'Risk Score', color: accentForRisk(riskVal) },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 23, fontWeight: 800, color: stat.color, marginBottom: 4 }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer tag */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          fontSize: 9,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.08em',
        }}>
          Confidential · Aether AI
        </div>
      </div>

      {/* ── CONTENT PAGE (charts + KPIs) ────────────────────────────────────── */}
      <div
        style={{
          width: '210mm',
          minHeight: '297mm',
          background: PAGE_BG,
          padding: PAGE_PADDING,
          breakBefore: 'page',
        }}
      >
        <PageHeader title={reportTypeName} orgName={organizationName} generatedAt={generatedAt} />

        {/* Executive Summary */}
        {report.summary && (
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Executive Summary" />
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 10.5,
                lineHeight: 1.6,
                color: '#374151',
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ ...props }) => <p style={{ marginBottom: 8 }} {...props} />,
                  ul: ({ ...props }) => <ul style={{ paddingLeft: 16, marginBottom: 8 }} {...props} />,
                  li: ({ ...props }) => <li style={{ marginBottom: 3 }} {...props} />,
                  strong: ({ ...props }) => <strong style={{ color: '#111827' }} {...props} />,
                  h1: ({ ...props }) => <h1 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }} {...props} />,
                  h2: ({ ...props }) => <h2 style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }} {...props} />,
                  h3: ({ ...props }) => <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }} {...props} />,
                }}
              >
                {report.summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* KPI Metrics */}
        {pulse && (
          <div style={{ marginBottom: 24, breakInside: 'avoid' }}>
            <SectionHeader title="Key Performance Indicators" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              <KpiCard
                label="Velocity Rate"
                value={`${velocityVal > 0 ? '+' : ''}${velocityVal}`}
                unit="%"
                subtitle="vs previous period"
                accent={accentForVelocity(velocityVal)}
              />
              <KpiCard
                label="On-Time Delivery"
                value={onTimeVal}
                unit="%"
                subtitle="Met deadlines"
                accent={accentForOnTime(onTimeVal)}
              />
              <KpiCard
                label="AI Risk Score"
                value={riskVal}
                unit="/100"
                subtitle="Delay probability"
                accent={accentForRisk(riskVal)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <KpiCard
                label="Change Failure Rate"
                value={cfrVal}
                unit="%"
                subtitle="Tasks requiring fixes"
                accent={accentForCfr(cfrVal)}
              />
              <KpiCard
                label="Avg Cycle Time"
                value={ctVal}
                unit=" days"
                subtitle="In Progress → Done"
                accent="#f59e0b"
              />
            </div>
          </div>
        )}

        {/* CFD Chart */}
        {cfd && cfd.length >= 2 && (
          <ChartBlock title="Cumulative Flow Diagram — Relative View">
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', background: '#fff', padding: '4px 4px 4px' }}>
              <PrintCFDChart data={cfd} />
            </div>
          </ChartBlock>
        )}

        {/* Throughput + Distribution (2 cols, equal height) */}
        {(hasVelocityChart || report.chartData?.investment) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>
            {hasVelocityChart && (
              <ChartBlock title="Throughput Trend">
                <div style={{
                  border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', background: '#fff',
                  minHeight: 192, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 4px',
                }}>
                  <PrintThroughputChart data={throughputData} />
                </div>
              </ChartBlock>
            )}
            {report.chartData?.investment && (
              <ChartBlock title="Task Distribution">
                <div style={{
                  border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff',
                  minHeight: 192, display: 'flex', alignItems: 'center',
                  padding: '16px 0 14px',
                }}>
                  <div style={{ width: '100%' }}>
                    <PrintTaskDistChart data={report.chartData.investment} />
                  </div>
                </div>
              </ChartBlock>
            )}
          </div>
        )}

      </div>

      {/* ── HEATMAP + TEXT SECTIONS (new page, flows continuously) ───────────── */}
      {(report.chartData?.heatmap || (report.sections && report.sections.length > 0)) && (
        <div
          style={{
            width: '210mm',
            minHeight: '297mm',
            background: PAGE_BG,
            padding: PAGE_PADDING,
            breakBefore: 'page',
          }}
        >
          <PageHeader title={reportTypeName} orgName={organizationName} generatedAt={generatedAt} />

          {/* Heatmap — first element on this page, gets full 18mm top padding */}
          {report.chartData?.heatmap && (
            <div style={{ marginBottom: 28 }}>
              <ChartBlock title="Team Workload Heatmap">
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '16px 16px 12px', background: '#fff' }}>
                  <PrintHeatmap data={report.chartData.heatmap} />
                </div>
              </ChartBlock>
            </div>
          )}

          {/* All sections except the last — flow naturally after heatmap */}
          {report.sections?.slice(0, -1).map((section, idx) => (
            <div key={idx} style={{ marginBottom: 24 }}>
              <SectionHeader title={section.title} />
              <div style={{ fontSize: 10.5, lineHeight: 1.65, color: '#374151' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ ...props }) => <p style={{ marginBottom: 8 }} {...props} />,
                    ul: ({ ...props }) => <ul style={{ paddingLeft: 16, marginBottom: 8 }} {...props} />,
                    ol: ({ ...props }) => <ol style={{ paddingLeft: 16, marginBottom: 8 }} {...props} />,
                    li: ({ ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
                    strong: ({ ...props }) => <strong style={{ color: '#111827', fontWeight: 600 }} {...props} />,
                    h1: ({ ...props }) => <h1 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }} {...props} />,
                    h2: ({ ...props }) => <h2 style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, marginTop: 8 }} {...props} />,
                    h3: ({ ...props }) => <h3 style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, marginTop: 6 }} {...props} />,
                    blockquote: ({ ...props }) => (
                      <blockquote style={{ borderLeft: '2px solid #6366f1', paddingLeft: 10, color: '#6b7280', fontStyle: 'italic', margin: '8px 0' }} {...props} />
                    ),
                  }}
                >
                  {section.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LAST SECTION (own page — same pattern as heatmap) ────────────── */}
      {report.sections && report.sections.length > 0 && (() => {
        const last = report.sections[report.sections.length - 1];
        return (
          <div
            style={{
              width: '210mm',
              minHeight: '297mm',
              background: PAGE_BG,
              padding: PAGE_PADDING,
              breakBefore: 'page',
            }}
          >
            <PageHeader title={reportTypeName} orgName={organizationName} generatedAt={generatedAt} />
            <div style={{ marginBottom: 24 }}>
              <SectionHeader title={last.title} />
              <div style={{ fontSize: 10.5, lineHeight: 1.65, color: '#374151' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ ...props }) => <p style={{ marginBottom: 8 }} {...props} />,
                    ul: ({ ...props }) => <ul style={{ paddingLeft: 16, marginBottom: 8 }} {...props} />,
                    ol: ({ ...props }) => <ol style={{ paddingLeft: 16, marginBottom: 8 }} {...props} />,
                    li: ({ ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
                    strong: ({ ...props }) => <strong style={{ color: '#111827', fontWeight: 600 }} {...props} />,
                    h1: ({ ...props }) => <h1 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }} {...props} />,
                    h2: ({ ...props }) => <h2 style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, marginTop: 8 }} {...props} />,
                    h3: ({ ...props }) => <h3 style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, marginTop: 6 }} {...props} />,
                    blockquote: ({ ...props }) => (
                      <blockquote style={{ borderLeft: '2px solid #6366f1', paddingLeft: 10, color: '#6b7280', fontStyle: 'italic', margin: '8px 0' }} {...props} />
                    ),
                  }}
                >
                  {last.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── END OF REPORT MARKER ─────────────────────────────────────────── */}
      <div
        style={{
          width: '210mm',
          background: PAGE_BG,
          padding: `8mm ${PAGE_PADDING}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        <span style={{ fontSize: 8, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          End of Report · Confidential · Aether AI
        </span>
        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
      </div>
    </div>
  );
}
