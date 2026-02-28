import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, Clock, Flame, Zap, Info } from 'lucide-react';
import { tasksApi, type PersonalPulseData } from '../api/tasksApi';

// Gradient text component for KPI values
function GradientValue({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'streak' }) {
    const gradients = {
        default: 'from-gray-800 via-gray-700 to-gray-600 dark:from-white dark:via-gray-100 dark:to-gray-300',
        success: 'from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300',
        streak: 'from-orange-500 via-amber-500 to-yellow-500 dark:from-orange-400 dark:via-amber-400 dark:to-yellow-400',
    };

    return (
        <span className={`bg-gradient-to-br ${gradients[variant]} bg-clip-text text-transparent`}>
            {children}
        </span>
    );
}

export function PersonalPulse() {
    const [pulse, setPulse] = useState<PersonalPulseData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadPulse() {
            try {
                const data = await tasksApi.getMyPulse();
                setPulse(data);
            } catch (error) {
                console.error('Failed to load personal pulse', error);
            } finally {
                setLoading(false);
            }
        }
        loadPulse();
    }, []);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <span className="text-gray-400 text-sm">Loading pulse...</span>
                </div>
            </div>
        );
    }

    if (!pulse) {
        return (
            <div className="h-full flex items-center justify-center">
                <span className="text-gray-400 text-sm">Unable to load pulse</span>
            </div>
        );
    }

    const { weeklyVelocity, trend, onTimeRate, cycleTime = 2.4, streak = 5, progress } = pulse;

    // Trend icon and color
    const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
    const trendColor = trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-500' : 'text-gray-400';
    const trendBg = trend > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : trend < 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-gray-500/10';

    // On-time rate color based on performance
    const onTimeVariant = onTimeRate >= 80 ? 'success' : 'default';

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5 flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 dark:from-violet-500/30 dark:to-purple-500/30 flex items-center justify-center ring-1 ring-violet-500/20">
                    <Activity size={14} className="text-violet-500" />
                </div>
                <h2 className="text-gray-600 dark:text-gray-300 font-semibold text-lg tracking-tight">Personal Pulse</h2>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6 flex-shrink-0">
                {/* Weekly Velocity */}
                <div className="group bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Velocity</p>
                        <Zap size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tabular-nums tracking-tight">
                            <GradientValue>{weeklyVelocity}</GradientValue>
                        </span>
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${trendBg}`}>
                            <TrendIcon size={10} className={trendColor} strokeWidth={2.5} />
                            <span className={`text-[10px] font-bold tabular-nums ${trendColor}`}>
                                {Math.abs(trend)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* On-Time Rate */}
                <div className="group bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">On-time</p>
                        <Clock size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl font-bold tabular-nums tracking-tight">
                            <GradientValue variant={onTimeVariant}>{onTimeRate}</GradientValue>
                        </span>
                        <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">%</span>
                    </div>
                </div>

                {/* Avg Cycle Time */}
                <div className="group bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Cycle Time</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tabular-nums tracking-tight">
                            <GradientValue>{cycleTime}</GradientValue>
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">days</span>
                    </div>
                </div>

                {/* Current Streak */}
                <div className="group bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-center relative">
                    {/* Subtle glow effect for active streak */}
                    {streak > 0 && (
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-orange-400/20 to-amber-400/10 rounded-full blur-xl pointer-events-none" />
                    )}
                    <div className="flex items-center justify-between mb-2 relative">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Daily Streak</p>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm shadow-orange-500/30">
                            <Flame size={12} className="text-white" fill="currentColor" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 relative">
                        <span className="text-3xl font-bold tabular-nums tracking-tight">
                            <GradientValue variant="streak">{streak}</GradientValue>
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">days</span>
                    </div>
                    {/* Info Tooltip - Bottom Right, aligned with fire icon */}
                    <div className="absolute bottom-3 right-4 group/tooltip">
                        <button
                            type="button"
                            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
                            aria-label="Momentum & Streaks"
                        >
                            <Info className="w-3.5 h-3.5" />
                        </button>
                        {/* Glassmorphism Popover */}
                        <div className="absolute right-0 bottom-full mb-2 w-64 p-4 rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50">
                            <h4 className="text-sm font-semibold text-white mb-2">Momentum & Streaks</h4>
                            <p className="text-xs text-zinc-300 leading-relaxed">
                                The number of consecutive days you've closed at least one task or logged significant progress. Keeping your <span className="text-orange-400 font-medium">Streak</span> alive is key to building high-impact habits.
                            </p>
                            {/* Arrow (pointing down since popover is above) */}
                            <div className="absolute -bottom-1.5 right-3 w-3 h-3 bg-zinc-900/95 dark:bg-zinc-900/95 rotate-45 border-r border-b border-zinc-700/50" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Bar Section */}
            <div className="flex-1 flex flex-col justify-end">
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Weekly Progress</span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                            {progress.done}<span className="text-gray-400 dark:text-gray-500 font-medium">/{progress.total}</span>
                            <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">done</span>
                        </span>
                    </div>

                    {/* Segmented Progress Bar */}
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-800/80 rounded-full overflow-hidden flex ring-1 ring-black/5 dark:ring-white/5">
                        {/* Done segment - emerald gradient */}
                        {progress.done > 0 && (
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-700 ease-out"
                                style={{ width: `${(progress.done / progress.total) * 100}%` }}
                            />
                        )}
                        {/* In Progress segment - blue gradient */}
                        {progress.inProgress > 0 && (
                            <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-700 ease-out"
                                style={{ width: `${(progress.inProgress / progress.total) * 100}%` }}
                            />
                        )}
                        {/* Todo segment (implicit - remaining space) */}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px] font-medium">
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
        </div>
    );
}
