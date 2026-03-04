/**
 * DashboardSkeleton - Premium loading skeleton for AnalyticsDashboard
 *
 * Mirrors the exact visual structure of the real dashboard to eliminate
 * layout shift and provide a polished first-paint experience.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-6 w-40 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-4 w-64 bg-gray-200 dark:bg-zinc-800 rounded-lg mt-2" />
      </div>

      {/* Live Snapshot Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-700" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-3 w-40 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={`snapshot-${i}`}
              className="h-32 bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-20 bg-gray-200 dark:bg-zinc-700 rounded" />
                <div className="h-8 w-8 bg-gray-200 dark:bg-zinc-700 rounded-xl" />
              </div>
              <div className="h-8 w-16 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-2" />
              <div className="h-3 w-24 bg-gray-200 dark:bg-zinc-700 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Historical Performance Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-36 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
            <div className="h-3 w-32 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            {/* Period Selector Skeleton */}
            <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={`period-${i}`}
                  className={`h-8 rounded-xl ${i === 1 ? 'w-20 bg-blue-500/30' : 'w-14 bg-gray-200 dark:bg-zinc-700'} mx-0.5`}
                />
              ))}
            </div>
            <div className="h-10 w-10 bg-gray-200 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700" />
            <div className="h-10 w-36 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-xl" />
          </div>
        </div>

        {/* Sparkline Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={`sparkline-${i}`}
              className="h-32 bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-4"
            >
              <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
              <div className="h-7 w-20 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-2" />
              <div className="h-10 w-full bg-gray-200 dark:bg-zinc-700 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Primary Charts: CFD + Investment */}
      <div className="grid grid-cols-1 gap-6">
        {/* CFD Chart Skeleton */}
        <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-5 w-48 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-2" />
              <div className="h-3 w-72 bg-gray-200 dark:bg-zinc-700 rounded" />
            </div>
            <div className="h-6 w-20 bg-emerald-500/20 rounded-full" />
          </div>
          <div className="h-80 bg-gray-100 dark:bg-zinc-700/30 rounded-xl" />
        </div>

        {/* Investment Sunburst Skeleton */}
        <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-6">
          <div className="h-5 w-40 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-4" />
          <div className="h-72 bg-gray-100 dark:bg-zinc-700/30 rounded-xl" />
        </div>
      </div>

      {/* Secondary Charts: Heatmap + Burndown */}
      <div className="grid grid-cols-1 gap-6">
        {/* Heatmap Skeleton */}
        <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-6">
          <div className="h-5 w-36 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-4" />
          <div className="h-64 bg-gray-100 dark:bg-zinc-700/30 rounded-xl" />
        </div>

        {/* Burndown Skeleton */}
        <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-6">
          <div className="h-5 w-44 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-4" />
          <div className="h-72 bg-gray-100 dark:bg-zinc-700/30 rounded-xl" />
        </div>
      </div>

      {/* Individual Performance Chart */}
      <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-6">
        <div className="h-5 w-40 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-2" />
        <div className="h-3 w-56 bg-gray-200 dark:bg-zinc-700 rounded mb-4" />
        <div className="h-72 bg-gray-100 dark:bg-zinc-700/30 rounded-xl" />
      </div>

      {/* Recent Activity */}
      <div className="bg-white/70 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-zinc-700/50 p-6">
        <div className="h-5 w-32 bg-gray-200 dark:bg-zinc-700 rounded-lg mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={`activity-${i}`}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-700/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-zinc-600" />
                <div>
                  <div className="h-4 w-48 bg-gray-200 dark:bg-zinc-600 rounded mb-1" />
                  <div className="h-3 w-24 bg-gray-200 dark:bg-zinc-600 rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-gray-200 dark:bg-zinc-600 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
