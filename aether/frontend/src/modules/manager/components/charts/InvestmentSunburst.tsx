/**
 * InvestmentArcGauge — Premium semi-circular arc gauge
 * Layout: arc on the left, legend table on the right (same height)
 * Rendered with pure SVG for full visual control.
 */

import { Info } from 'lucide-react';

interface InvestmentData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

interface InvestmentSunburstProps {
  data: InvestmentData;
  title?: string;
  subtitle?: string;
  pdfMode?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  Features:    '#3b82f6',
  Bugs:        '#ef4444',
  Chores:      '#6b7280',
  Maintenance: '#f59e0b',
  'Tech Debt': '#8b5cf6',
  'New Value': '#10b981',
};

// ─── SVG helpers ─────────────────────────────────────────────────────────────

/** Convert polar coords (math angle, y-flipped for SVG) to Cartesian. */
function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

/**
 * Build a donut-arc SVG path from startDeg → endDeg (decreasing = going through top).
 * Outer arc: CCW in SVG (sweep=0). Inner return arc: CW in SVG (sweep=1).
 */
function arcPath(
  cx: number, cy: number,
  ir: number, or: number,
  startDeg: number, endDeg: number,
): string {
  const sweep = startDeg - endDeg;
  const large = sweep > 180 ? 1 : 0;
  const [ox1, oy1] = polar(cx, cy, or, startDeg);
  const [ox2, oy2] = polar(cx, cy, or, endDeg);
  const [ix2, iy2] = polar(cx, cy, ir, endDeg);
  const [ix1, iy1] = polar(cx, cy, ir, startDeg);
  return [
    `M${ox1.toFixed(2)},${oy1.toFixed(2)}`,
    `A${or},${or} 0 ${large},0 ${ox2.toFixed(2)},${oy2.toFixed(2)}`,
    `L${ix2.toFixed(2)},${iy2.toFixed(2)}`,
    `A${ir},${ir} 0 ${large},1 ${ix1.toFixed(2)},${iy1.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InvestmentSunburst({
  data,
  title = 'Investment Distribution',
  subtitle,
  pdfMode = false,
}: InvestmentSunburstProps) {
  const segments = data.labels
    .map((label, idx) => ({
      name:  label,
      value: data.datasets[0]?.data[idx] ?? 0,
      color: SEGMENT_COLORS[label] ?? '#6b7280',
    }))
    .filter(s => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // ── Arc geometry ──
  const W = 200, H = 168;
  const cx = W / 2, cy = H - 18;
  const outerR = 108, innerR = 80;
  const midR   = (outerR + innerR) / 2;
  const capR   = (outerR - innerR) / 2 - 1; // rounded end-cap radius

  const TOTAL_SWEEP = 228; // degrees the arc sweeps
  const START       = 204; // start angle (lower-left)
  const GAP         = 2.8; // degrees between segments

  const availableSweep = TOTAL_SWEEP - Math.max(0, segments.length - 1) * GAP;

  // Compute per-segment arcs
  type ArcSeg = typeof segments[0] & { path: string; capA: number; capB: number };
  const arcs: ArcSeg[] = [];
  let angle = START;
  for (const seg of segments) {
    const sweep   = (seg.value / total) * availableSweep;
    const endAngle = angle - sweep;
    arcs.push({
      ...seg,
      path: arcPath(cx, cy, innerR, outerR, angle, endAngle),
      capA: angle,
      capB: endAngle,
    });
    angle = endAngle - GAP;
  }

  const pct = (v: number) =>
    total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

  return (
    <div
      className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-5 border border-gray-100 dark:border-zinc-700/50 shadow-sm"
      data-chart-id="investment-profile"
    >
      {/* ── Header ── */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="relative group">
          <button
            type="button"
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
            aria-label="Understanding Investment"
          >
            <Info className="w-4 h-4" />
          </button>
          <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
            <h4 className="text-sm font-semibold text-white mb-2">Understanding Investment</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              A visual breakdown of where your team invests effort. Grouped by task type (
              <span className="text-blue-400 font-medium">Feature</span>,{' '}
              <span className="text-red-400 font-medium">Bug</span>,{' '}
              <span className="text-gray-400 font-medium">Chore</span>
              ) to ensure a healthy balance between value creation and technical debt management.
            </p>
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50" />
          </div>
        </div>
      </div>

      {/* ── Body: arc + legend side-by-side ── */}
      <div className="flex items-center gap-2">

        {/* LEFT: SVG arc gauge */}
        <div className="flex-shrink-0 relative" style={{ width: W, height: H }}>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            overflow="visible"
          >
            <defs>
              {/* Soft glow filter */}
              <filter id="arc-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Subtle inner shadow on track */}
              <filter id="track-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* ── Background track ── */}
            <path
              d={arcPath(cx, cy, innerR, outerR, START, START - TOTAL_SWEEP)}
              fill="currentColor"
              className="text-gray-100 dark:text-zinc-700/60"
              opacity={0.9}
            />

            {/* ── Colored segments with glow ── */}
            <g filter="url(#arc-glow)">
              {arcs.map((arc) => (
                <path key={arc.name} d={arc.path} fill={arc.color} opacity={0.92} />
              ))}
            </g>

            {/* ── Rounded end-caps on each segment ── */}
            {arcs.map((arc) => {
              const [ax, ay] = polar(cx, cy, midR, arc.capA);
              const [bx, by] = polar(cx, cy, midR, arc.capB);
              return (
                <g key={`caps-${arc.name}`}>
                  <circle cx={ax} cy={ay} r={capR} fill={arc.color} opacity={0.92} />
                  <circle cx={bx} cy={by} r={capR} fill={arc.color} opacity={0.92} />
                </g>
              );
            })}

            {/* ── Thin highlight ring on outer edge ── */}
            {arcs.map((arc) => (
              <path
                key={`hl-${arc.name}`}
                d={arcPath(cx, cy, outerR - 3, outerR, arc.capA, arc.capB)}
                fill={arc.color}
                opacity={0.35}
              />
            ))}
          </svg>

          {/* Center label */}
          <div
            className="absolute inset-x-0 flex flex-col items-center pointer-events-none select-none"
            style={{ bottom: 10 }}
          >
            <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
              {total}
            </span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
              tasks
            </span>
          </div>
        </div>

        {/* RIGHT: Legend */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 pl-1 min-w-0">
          {arcs.map((arc) => (
            <div key={arc.name} className="flex items-center gap-2 min-w-0">
              {/* Dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: arc.color }}
              />
              {/* Name */}
              <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">
                {arc.name}
              </span>
              {/* Value + pct */}
              <span className="text-xs font-semibold text-gray-800 dark:text-white tabular-nums">
                {arc.value}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-9 text-right">
                {pct(arc.value)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
