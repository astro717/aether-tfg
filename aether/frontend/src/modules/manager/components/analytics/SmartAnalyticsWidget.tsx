import { AnimatePresence, motion } from 'framer-motion';
import { PredictiveBurndownChart } from '../charts/PredictiveBurndownChart';
import { DailyHealthDashboard } from './DailyHealthDashboard';
import type { TimeRange } from '../../types/analytics';

interface BurndownData {
  real: Array<{ day: number; tasks: number }>;
  ideal: Array<{ day: number; tasks: number }>;
  projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
}

interface SmartAnalyticsWidgetProps {
  period: TimeRange;
  organizationId: string;
  burndownData?: BurndownData;
}

const FADE_SLIDE: Parameters<typeof motion.div>[0] = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: 'easeInOut' },
};

export function SmartAnalyticsWidget({
  period,
  organizationId,
  burndownData,
}: SmartAnalyticsWidgetProps) {
  return (
    <AnimatePresence mode="wait">
      {period === 'today' ? (
        <motion.div key="daily-health" {...FADE_SLIDE}>
          {/* ── Today: Daily Team Pulse ── */}
          <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-shadow duration-300">
            <DailyHealthDashboard organizationId={organizationId} />
          </div>
        </motion.div>
      ) : (
        <motion.div key="burndown" {...FADE_SLIDE}>
          {/* ── Other periods: Predictive Burndown ── */}
          {burndownData ? (
            <PredictiveBurndownChart data={burndownData} period={period} />
          ) : (
            <BurndownEmptyState />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BurndownEmptyState() {
  return (
    <div className="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl rounded-2xl p-6 border border-gray-100 dark:border-zinc-700/50 shadow-sm flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-2xl">📊</p>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No burndown data available</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Select a longer period to see predictive trends.</p>
    </div>
  );
}
