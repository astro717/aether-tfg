import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import { managerApi, type UserPulseData } from '../api/managerApi';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { MetricTooltip } from '../../../components/ui/MetricTooltip';

interface MemberPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  member: {
    id: string;
    username: string;
    email: string;
    avatar_color?: string;
  };
}

function GradientValue({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'streak' | 'danger' }) {
  const gradients = {
    default: 'from-gray-800 via-gray-700 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-300',
    success: 'from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300',
    streak: 'from-orange-500 via-amber-500 to-yellow-500 dark:from-orange-400 dark:via-amber-400 dark:to-yellow-400',
    danger: 'from-red-600 via-rose-500 to-pink-500 dark:from-red-400 dark:via-rose-400 dark:to-pink-400',
  };

  return (
    <span className={`bg-gradient-to-br ${gradients[variant]} bg-clip-text text-transparent`}>
      {children}
    </span>
  );
}

export function MemberPulseModal({ isOpen, onClose, organizationId, member }: MemberPulseModalProps) {
  const [pulse, setPulse] = useState<UserPulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadPulse() {
      setLoading(true);
      setError(null);
      try {
        const data = await managerApi.getUserPulse(organizationId, member.id);
        setPulse(data);
      } catch (err) {
        console.error('Failed to load user pulse', err);
        setError(err instanceof Error ? err.message : 'Failed to load pulse data');
      } finally {
        setLoading(false);
      }
    }

    loadPulse();
  }, [isOpen, organizationId, member.id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPulse(null);
      setLoading(true);
      setError(null);
    }
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
              <div className="flex items-center gap-3">
                <UserAvatar
                  username={member.username}
                  avatarColor={member.avatar_color}
                  size="lg"
                />
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{member.username}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Loading pulse data...</span>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <p className="text-sm text-red-500">{error}</p>
                  <button
                    onClick={onClose}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                  >
                    Close
                  </button>
                </div>
              )}

              {!loading && !error && pulse && (
                <PulseContent pulse={pulse} />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function PulseContent({ pulse }: { pulse: UserPulseData }) {
  const { weeklyVelocity, trend, onTimeRate, cycleTime, overdueTasks, progress } = pulse;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-500' : 'text-gray-400';
  const trendBg = trend > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : trend < 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-gray-500/10';
  const onTimeVariant = onTimeRate >= 80 ? 'success' : 'default';

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 dark:from-violet-500/30 dark:to-purple-500/30 flex items-center justify-center ring-1 ring-violet-500/20">
          <Activity size={12} className="text-violet-500" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 leading-tight">Performance Pulse</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Last 30 days & current week</span>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Weekly Velocity */}
        <div className="group relative bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Velocity</p>
            <Zap size={11} className="text-gray-300 dark:text-gray-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              <GradientValue>{weeklyVelocity}</GradientValue>
            </span>
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${trendBg}`}>
              <TrendIcon size={9} className={trendColor} strokeWidth={2.5} />
              <span className={`text-[9px] font-bold tabular-nums ${trendColor}`}>
                {Math.abs(trend)}
              </span>
            </div>
          </div>
          <MetricTooltip
            title="Weekly Velocity"
            description="Number of tasks completed during the current week. The trend indicates the difference compared to the previous week."
          />
        </div>

        {/* On-Time Rate */}
        <div className="group relative bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">On-time</p>
            <Clock size={11} className="text-gray-300 dark:text-gray-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              <GradientValue variant={onTimeVariant}>{onTimeRate}</GradientValue>
            </span>
            <span className="text-base font-semibold text-gray-400 dark:text-gray-500">%</span>
          </div>
          <MetricTooltip
            title="30-Day On-Time Rate"
            description="Percentage of tasks completed before their deadline over the past 30 days. It doesn't penalize tasks without deadlines."
            align="right"
          />
        </div>

        {/* Avg Cycle Time */}
        <div className="group relative bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Cycle Time</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              <GradientValue>{cycleTime}</GradientValue>
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">days</span>
          </div>
          <MetricTooltip
            title="30-Day Cycle Time"
            description="Average number of days taken to complete a task over the past 30 days. Shorter times indicate faster workflow."
          />
        </div>

        {/* Overdue Tasks */}
        <div className="group bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 relative overflow-visible">
          {overdueTasks > 0 && (
            <div className="absolute -top-4 -right-4 w-14 h-14 bg-gradient-to-br from-red-400/20 to-rose-400/10 rounded-full blur-xl pointer-events-none" />
          )}
          <div className="flex items-center justify-between mb-2 relative">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Overdue</p>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${overdueTasks > 0
              ? 'bg-gradient-to-br from-red-400 to-rose-500 shadow-red-500/30'
              : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30'
              }`}>
              <AlertTriangle size={10} className="text-white" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 relative">
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              <GradientValue variant={overdueTasks > 0 ? 'danger' : 'success'}>{overdueTasks}</GradientValue>
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">tasks</span>
          </div>
          <MetricTooltip
            title="Current Overdue Tasks"
            description="Active tasks that have missed their deadline. Excludes completed tasks and those pending your validation."
            align="right"
          />
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Weekly Progress</span>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">
            {progress.done}<span className="text-gray-400 dark:text-gray-500 font-medium">/{progress.total}</span>
            <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">done</span>
          </span>
        </div>

        {/* Segmented Progress Bar */}
        <div className="h-2 bg-gray-100 dark:bg-gray-800/80 rounded-full overflow-hidden flex ring-1 ring-black/5 dark:ring-white/5">
          {progress.done > 0 && (
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-700 ease-out"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          )}
          {progress.inProgress > 0 && (
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-700 ease-out"
              style={{ width: `${(progress.inProgress / progress.total) * 100}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[9px] font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 ring-1 ring-emerald-500/30" />
            <span className="text-gray-500 dark:text-gray-400">Done ({progress.done})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 ring-1 ring-blue-500/30" />
            <span className="text-gray-500 dark:text-gray-400">Active ({progress.inProgress})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-600 ring-1 ring-gray-300/30 dark:ring-gray-500/30" />
            <span className="text-gray-500 dark:text-gray-400">Todo ({progress.todo})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
