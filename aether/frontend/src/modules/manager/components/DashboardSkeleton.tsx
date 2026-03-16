/**
 * DashboardSkeleton - Loading skeleton for AnalyticsDashboardV2
 *
 * Mirrors the exact visual structure of V2 to eliminate layout shift
 * and provide a polished first-paint experience.
 * Default period is 'week' (non-today), so skeleton reflects that path.
 */

function SectionHeading({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 ${wide ? 'w-32' : 'w-20'} bg-gray-200 dark:bg-zinc-800 rounded-md`} />
      <div className="h-3 w-40 bg-gray-100 dark:bg-zinc-800/60 rounded-md" />
    </div>
  );
}

function SkeletonCard({ height = 'h-52' }: { height?: string }) {
  return (
    <div
      className={`${height} bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">

      {/* ── Header: period selector + actions ────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Period pills */}
        <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-1 gap-0.5">
          {[72, 88, 96, 80, 64].map((w, i) => (
            <div
              key={i}
              className={`h-8 rounded-xl ${i === 1 ? 'bg-blue-500/30' : 'bg-gray-100 dark:bg-zinc-700'}`}
              style={{ width: w }}
            />
          ))}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700" />
          <div className="h-10 w-32 bg-gradient-to-r from-purple-500/25 to-blue-500/25 rounded-xl" />
        </div>
      </div>

      {/* ── Signals panel ───────────────────────────────────────────────── */}
      <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-zinc-700" />
            <div className="h-3 w-14 bg-gray-200 dark:bg-zinc-800 rounded-md" />
          </div>
          <div className="h-4 w-14 bg-gray-100 dark:bg-zinc-700 rounded-md" />
        </div>
        {/* Signal rows */}
        {[180, 220, 160].map((w, i) => (
          <div key={i} className="flex items-center gap-3.5 px-5 py-3 border-b border-gray-50 dark:border-white/[0.03] last:border-0">
            <div className="w-1.5 h-1.5 rounded-sm bg-gray-200 dark:bg-zinc-700 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-200 dark:bg-zinc-700 rounded" style={{ width: w }} />
              <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded w-48" />
            </div>
            <div className="h-5 w-12 bg-gray-100 dark:bg-zinc-700 rounded shrink-0" />
          </div>
        ))}
      </div>

      {/* ── Live Pulse Rail ──────────────────────────────────────────────── */}
      <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 dark:border-white/[0.04]">
          <div className="w-3 h-3 rounded-full bg-emerald-500/30" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-zinc-800 rounded-md" />
        </div>
        {/* 5-cell grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-gray-100 dark:divide-zinc-700/40">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col px-5 py-4 gap-2">
              <div className="h-7 w-12 bg-gray-200 dark:bg-zinc-700 rounded-md" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-zinc-800 rounded" />
              <div className="h-2.5 w-16 bg-gray-100 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section: Period KPIs ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading wide />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 overflow-hidden"
            >
              <div className="h-[2px] w-full bg-gray-200 dark:bg-zinc-700" />
              <div className="flex flex-col flex-1 px-4 pt-3.5 pb-3 gap-2">
                <div className="h-2.5 w-20 bg-gray-200 dark:bg-zinc-700 rounded" />
                <div className="h-7 w-12 bg-gray-200 dark:bg-zinc-700 rounded-md" />
                <div className="h-2.5 w-24 bg-gray-100 dark:bg-zinc-800 rounded" />
              </div>
              <div className="h-9 bg-gray-100 dark:bg-zinc-700/30" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section: Flow ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard height="h-72" />
          <SkeletonCard height="h-72" />
        </div>
      </div>

      {/* ── Section: Distribution ───────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading wide />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard height="h-64" />
          <SkeletonCard height="h-64" />
        </div>
      </div>

      {/* ── Section: Team ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard height="h-56" />
          <SkeletonCard height="h-56" />
        </div>
      </div>

      {/* ── Section: Capacity ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading wide />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard height="h-60" />
          <SkeletonCard height="h-60" />
        </div>
      </div>

    </div>
  );
}
