import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkItemAgeDatum {
  id: string;
  title: string;
  ageInDays: number;
  status: string;
  assignee: string;
}

interface WorkItemAgeChartProps {
  data: WorkItemAgeDatum[];
  p85CycleTime?: number;
  className?: string;
}

type AgeCategory = 'fresh' | 'aging' | 'stale';

// ─── Category config ──────────────────────────────────────────────────────────

const CAT = {
  fresh: {
    bar: '#10b981',
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10',
    label: 'Fresh',
    range: '≤ 3d',
    Icon: CheckCircle2,
  },
  aging: {
    bar: '#fbbf24',
    text: 'text-amber-400',
    badgeBg: 'bg-amber-400/10',
    label: 'Aging',
    range: '4–7d',
    Icon: Clock,
  },
  stale: {
    bar: '#ef4444',
    text: 'text-red-400',
    badgeBg: 'bg-red-500/10',
    label: 'Stale',
    range: '> 7d',
    Icon: AlertTriangle,
  },
} as const;

function getCategory(days: number): AgeCategory {
  if (days <= 3) return 'fresh';
  if (days <= 7) return 'aging';
  return 'stale';
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const LABEL_WIDTH = 152; // px — Y-axis label column
const ROW_HEIGHT   = 30; // px per row
const ROW_GAP      = 6;  // px between rows
const BAR_HEIGHT   = 6;  // px bar thickness
const AXIS_HEIGHT  = 24; // px X-axis area

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkItemAgeChart({ data, p85CycleTime, className = '' }: WorkItemAgeChartProps) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Prepare data: filter out just-created items, sort oldest first, cap at 25
  const items = [...data]
    .filter(d => d.ageInDays > 0)
    .sort((a, b) => b.ageInDays - a.ageInDays)
    .slice(0, 25);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div
        className={`p-5 bg-white dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm ${className}`}
      >
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Work Item Age</p>
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">No active tasks — all clear</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">Nothing in progress right now</p>
        </div>
      </div>
    );
  }

  // ── Scale ──────────────────────────────────────────────────────────────────
  // Add 15% headroom so the longest bar doesn't touch the right edge
  const maxAge   = Math.ceil(Math.max(...items.map(d => d.ageInDays), p85CycleTime ?? 0) * 1.15);
  const p85Pct   = p85CycleTime != null ? (p85CycleTime / maxAge) * 100 : null;
  const toX      = (days: number) => `${(days / maxAge) * 100}%`;

  // X-axis: 4 evenly-spaced ticks
  const tickStep = Math.ceil(maxAge / 4);
  const ticks    = Array.from({ length: 5 }, (_, i) => Math.min(i * tickStep, maxAge));

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = {
    stale: items.filter(i => i.ageInDays >  7).length,
    aging: items.filter(i => i.ageInDays >  3 && i.ageInDays <= 7).length,
    fresh: items.filter(i => i.ageInDays <= 3).length,
  };

  const hoveredItem = items.find(i => i.id === hoveredId) ?? null;

  return (
    <div
      className={`p-5 bg-white dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 shadow-sm flex flex-col gap-4 min-h-[400px] ${className}`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Work Item Age</p>
            <InfoTooltip
              size="sm"
              content={{
                title: 'Work Item Age',
                description: (
                <>
                  <span className="text-emerald-400 font-medium">Fresh</span>,{' '}
                  <span className="text-amber-400 font-medium">aging</span>, and{' '}
                  <span className="text-red-400 font-medium">stale</span> items show how long active tasks have been in progress. The{' '}
                  <span className="text-violet-400 font-medium">p85 line</span> is your statistical SLA — tasks past it rarely finish on time. Prioritize red items before pulling in new work.
                </>
              ),
              }}
            />
          </div>
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">{items.length}</span>
            <span className="text-sm text-gray-400 dark:text-zinc-500">active tasks</span>
          </div>
        </div>

        {/* Summary badges — right-aligned */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {counts.stale > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {counts.stale} stale
            </span>
          )}
          {counts.aging > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              {counts.aging} aging
            </span>
          )}
          {counts.fresh > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              {counts.fresh} fresh
            </span>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="flex-1 flex items-start mt-4 overflow-y-auto overflow-x-hidden max-h-[300px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600">

        {/* Y-axis label column */}
        <div
          className="flex flex-col shrink-0"
          style={{ width: LABEL_WIDTH, gap: ROW_GAP, paddingBottom: AXIS_HEIGHT + 12 }}
        >
          {items.map(item => {
            const cat  = getCategory(item.ageInDays);
            const isHovered = hoveredId === item.id;
            return (
              <div
                key={item.id}
                className="flex items-center justify-end pr-3 cursor-pointer"
                style={{ height: ROW_HEIGHT }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => navigate(`/tasks/${item.id}`)}
              >
                <span
                  className={`text-xs truncate text-right select-none transition-colors duration-150 ${
                    isHovered ? CAT[cat].text : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                  title={item.title}
                >
                  {item.title.length > 22 ? item.title.substring(0, 22) + '…' : item.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chart body */}
        <div className="flex-1 flex flex-col">

          {/* Relative container — bars + reference line + risk zone */}
          <div className="relative">

            {/* ── Risk zone (subtle gradient right of p85) */}
            {p85Pct != null && p85Pct < 98 && (
              <div
                className="absolute top-0 pointer-events-none rounded-r-lg"
                style={{
                  left: `${p85Pct}%`,
                  right: 0,
                  bottom: AXIS_HEIGHT + 4,
                  background: 'linear-gradient(to right, rgba(239,68,68,0.04), rgba(239,68,68,0.10))',
                }}
              />
            )}

            {/* ── Vertical grid lines */}
            {ticks.filter(t => t > 0).map(tick => (
              <div
                key={tick}
                className="absolute top-0 w-px bg-zinc-100 dark:bg-zinc-700/50 pointer-events-none"
                style={{ left: toX(tick), bottom: AXIS_HEIGHT + 4 }}
              />
            ))}

            {/* ── p85 reference line */}
            {p85Pct != null && (
              <div
                className="absolute top-0 pointer-events-none"
                style={{ left: `${p85Pct}%`, bottom: AXIS_HEIGHT + 4 }}
              >
                <div className="w-px h-full border-l-2 border-dashed border-violet-400/70" />
                <span
                  className="absolute text-xs font-semibold text-violet-400 whitespace-nowrap"
                  style={{ top: 2, left: 5 }}
                >
                  p85
                </span>
              </div>
            )}

            {/* ── Rows */}
            <div className="flex flex-col" style={{ gap: ROW_GAP }}>
              {items.map(item => {
                const pct      = (item.ageInDays / maxAge) * 100;
                const cat      = getCategory(item.ageInDays);
                const isHovered = hoveredId === item.id;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 cursor-pointer group"
                    style={{ height: ROW_HEIGHT }}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/tasks/${item.id}`)}
                  >
                    {/* Bar track + hover highlight */}
                    <div className="flex-1 relative flex items-center">
                      {isHovered && (
                        <div className="absolute inset-0 -mx-1 rounded-lg bg-white/[0.025] pointer-events-none" />
                      )}
                      <div className="w-full flex items-center" style={{ height: BAR_HEIGHT }}>
                        <div
                          className="rounded-full"
                          style={{
                            height: BAR_HEIGHT,
                            width: `${pct}%`,
                            background: CAT[cat].bar,
                            opacity: isHovered ? 1 : 0.72,
                            transition: 'width 700ms cubic-bezier(0.4,0,0.2,1), opacity 150ms ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Age value */}
                    <span
                      className={`text-xs font-semibold tabular-nums w-8 shrink-0 text-right ${CAT[cat].text}`}
                      style={{
                        opacity: isHovered ? 1 : 0.6,
                        transition: 'opacity 150ms ease',
                      }}
                    >
                      {item.ageInDays}d
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── X-axis ticks */}
            <div className="relative mt-1" style={{ height: AXIS_HEIGHT }}>
              {ticks.map(tick => (
                <span
                  key={tick}
                  className="absolute text-xs text-zinc-400 dark:text-zinc-500 -translate-x-1/2 tabular-nums"
                  style={{ left: toX(tick), bottom: 4 }}
                >
                  {tick}
                </span>
              ))}
            </div>
          </div>

          {/* X-axis label */}
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-0.5">
            Age (days)
          </p>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {(['fresh', 'aging', 'stale'] as AgeCategory[]).map(cat => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: CAT[cat].bar }} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {CAT[cat].label}{' '}
              <span className="text-zinc-400 dark:text-zinc-500">{CAT[cat].range}</span>
            </span>
          </div>
        ))}
        {p85CycleTime != null && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 border-t-2 border-dashed border-violet-400/80" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              p85 <span className="text-zinc-400 dark:text-zinc-500">({p85CycleTime}d)</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Detail strip — always present, updates on hover ── */}
      <div className="mt-auto border-t border-gray-100 dark:border-zinc-700/50 pt-3 min-h-[44px] flex items-center">
        {hoveredItem ? (() => {
          const cat       = getCategory(hoveredItem.ageInDays);
          const Icon      = CAT[cat].Icon;
          const isPastP85 = p85CycleTime != null && hoveredItem.ageInDays > p85CycleTime;
          return (
            <div className="flex items-center gap-3 w-full animate-in fade-in duration-150">
              <div className={`p-1.5 rounded-lg ${CAT[cat].badgeBg} shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${CAT[cat].text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate leading-tight">
                  {hoveredItem.title}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 leading-tight">
                  <span className="text-gray-500 dark:text-zinc-400">{hoveredItem.assignee}</span>
                  <span className="mx-1.5 text-gray-200 dark:text-zinc-600">·</span>
                  <span className="capitalize">{hoveredItem.status.replace(/_/g, ' ')}</span>
                  {isPastP85 && (
                    <>
                      <span className="mx-1.5 text-gray-200 dark:text-zinc-600">·</span>
                      <span className="text-red-400 font-medium">past p85</span>
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-base font-bold tabular-nums leading-none ${CAT[cat].text}`}>
                  {hoveredItem.ageInDays}
                </span>
                <span className={`text-xs font-medium ml-0.5 ${CAT[cat].text} opacity-60`}>d</span>
              </div>
            </div>
          );
        })() : (
          <p className="text-xs text-gray-400 dark:text-zinc-500 w-full text-center select-none">
            Hover a task to inspect
          </p>
        )}
      </div>
    </div>
  );
}
