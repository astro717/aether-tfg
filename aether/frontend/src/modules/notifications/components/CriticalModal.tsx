import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, X, AlertOctagon } from "lucide-react";
import { parseISO, isValid, differenceInMilliseconds, isBefore } from "date-fns";

interface CriticalModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    dueDate: Date | string;
    onAction: () => void;
    actionLabel?: string;
}

interface TimeDisplay {
    isOverdue: boolean;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isInvalid: boolean;
}

/**
 * Robustly parse date from various formats (Date object, ISO string, timestamp)
 */
function parseDate(input: Date | string | number): Date | null {
    if (!input) return null;

    let parsed: Date;

    if (input instanceof Date) {
        parsed = input;
    } else if (typeof input === "string") {
        // Try ISO 8601 parsing first (most reliable)
        parsed = parseISO(input);
        // Fallback to native Date constructor if parseISO fails
        if (!isValid(parsed)) {
            parsed = new Date(input);
        }
    } else if (typeof input === "number") {
        parsed = new Date(input);
    } else {
        return null;
    }

    // Validate the result - reject dates too far in the future (> 5 years)
    if (!isValid(parsed)) return null;

    const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000;
    const now = new Date();
    if (Math.abs(parsed.getTime() - now.getTime()) > fiveYearsMs) {
        console.warn("CriticalModal: Date is more than 5 years away, likely invalid:", input);
        return null;
    }

    return parsed;
}

export function CriticalModal({
    isOpen,
    onClose,
    title,
    description,
    dueDate,
    onAction,
    actionLabel = "View Task"
}: CriticalModalProps) {
    const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>({
        isOverdue: false,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isInvalid: false,
    });

    const parsedDueDate = useMemo(() => parseDate(dueDate), [dueDate]);

    useEffect(() => {
        if (!parsedDueDate) {
            setTimeDisplay(prev => ({ ...prev, isInvalid: true }));
            return;
        }

        const calculateTimeLeft = () => {
            const now = new Date();
            const diffMs = differenceInMilliseconds(parsedDueDate, now);
            const isOverdue = isBefore(parsedDueDate, now);
            const absDiff = Math.abs(diffMs);

            const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

            setTimeDisplay({ isOverdue, days, hours, minutes, seconds, isInvalid: false });
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [parsedDueDate]);

    const formatTimeString = (): string => {
        if (timeDisplay.isInvalid) return "--:--:--";

        const { days, hours, minutes, seconds } = timeDisplay;
        const h = hours.toString().padStart(2, "0");
        const m = minutes.toString().padStart(2, "0");
        const s = seconds.toString().padStart(2, "0");

        // Compact format when far away (> 1 day)
        if (days > 0) {
            return `${days}d ${h}h ${m}m`;
        }
        // Full countdown when close (< 24h)
        return `${h}:${m}:${s}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-red-100 dark:border-red-900 overflow-hidden"
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors z-10"
                        >
                            <X size={20} className="text-gray-400" />
                        </button>

                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                                        {title}
                                    </h3>
                                </div>
                            </div>

                            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                                {description}
                            </p>

                            {/* Prominent Timer - Clear distinction between remaining and overdue */}
                            {timeDisplay.isOverdue ? (
                                // OVERDUE STATE - Red alert design
                                <div className="mb-8 p-4 rounded-xl border-2 bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 shadow-sm shadow-red-100 dark:shadow-red-900/20">
                                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                                        <AlertOctagon size={16} className="animate-pulse" />
                                        <span className="uppercase tracking-wider">Time Overdue By</span>
                                    </div>
                                    <div className="text-3xl font-bold font-mono text-center tracking-tight text-red-600 dark:text-red-400 animate-pulse">
                                        {formatTimeString()}
                                    </div>
                                    <p className="text-xs text-red-500 dark:text-red-400/80 text-center mt-2">
                                        This task has passed its deadline
                                    </p>
                                </div>
                            ) : (
                                // TIME REMAINING STATE - Neutral design
                                <div className="mb-8 p-4 rounded-xl border bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700">
                                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        <Clock size={14} />
                                        <span>Time Remaining</span>
                                    </div>
                                    <div className="text-3xl font-bold font-mono text-center tracking-tight text-gray-900 dark:text-white">
                                        {formatTimeString()}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                >
                                    Dismiss
                                </button>
                                <button
                                    onClick={() => {
                                        onAction();
                                        onClose();
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors shadow-red-500/20"
                                >
                                    {actionLabel}
                                </button>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 w-full bg-red-100 dark:bg-red-900/30">
                            <motion.div
                                className="h-full bg-red-500"
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 60, ease: "linear" }}
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
