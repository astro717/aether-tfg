import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Maximize2, X, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";

interface AITaskReportCardProps {
    taskId?: string; // Optional if we just want the UI for now
    className?: string;
}

type CardState = "idle" | "loading" | "completed" | "error";

const LOADING_MESSAGES = [
    "Analyzing task progress...",
    "Reviewing comments...",
    "Checking commits...",
    "Compiling report...",
];

export function AITaskReportCard({ taskId, className = "" }: AITaskReportCardProps) {
    const [state, setState] = useState<CardState>("idle");
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

    // Mock data since the backend endpoint might not be ready
    const report = {
        summary: "Task is progressing well with 85% completion. The core features are implemented, but some edge cases in the validation logic need attention.",
        sections: [
            { title: "Progress Overview", content: "All primary objectives for the backend endpoints are complete. Frontend integration is currently receiving the most attention." },
            { title: "Blockers", content: "None identified. API latency is within acceptable limits." },
            { title: "Next Steps", content: "1. Finalize error handling.\n2. Add loading skeletons for better UX.\n3. Conduct user acceptance testing." }
        ],
        cached: false
    };

    // Cycle through loading messages
    useEffect(() => {
        if (state !== "loading") return;

        const interval = setInterval(() => {
            setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 1500);

        return () => clearInterval(interval);
    }, [state]);

    const handleGenerate = useCallback(async () => {
        setState("loading");
        setLoadingMessageIndex(0);

        // Simulate API call
        setTimeout(() => {
            setState("completed");
            setGeneratedAt(new Date());
        }, 3000);
    }, [taskId]);

    const handleRegenerateClick = () => {
        setIsConfirmDialogOpen(true);
    };

    const handleConfirmRegenerate = () => {
        setState("idle");
        setGeneratedAt(null);
        // Immediately trigger regeneration
        handleGenerate();
    };

    return (
        <>
            <AnimatePresence mode="wait">
                {/* IDLE STATE */}
                {state === "idle" && (
                    <motion.button
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={handleGenerate}
                        className={`bg-white/30 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 hover:bg-white/50 hover:border-gray-300 transition-all min-h-[120px] group w-full ${className}`}
                    >
                        <motion.div
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center group-hover:border-blue-400 group-hover:bg-blue-50 transition-all"
                            whileHover={{ scale: 1.1 }}
                        >
                            <ClipboardList size={18} className="text-gray-600 group-hover:text-blue-500 transition-colors" />
                        </motion.div>
                        <h4 className="text-gray-700 font-medium text-sm leading-tight group-hover:text-blue-600 transition-colors">
                            Generate task report
                        </h4>
                    </motion.button>
                )}

                {/* LOADING STATE */}
                {state === "loading" && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`relative overflow-hidden rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[120px] w-full ${className}`}
                    >
                        {/* Animated gradient background - Blue theme */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10"
                            animate={{
                                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                            style={{ backgroundSize: "200% 100%" }}
                        />

                        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm border border-blue-200/50 rounded-xl" />

                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <motion.div
                                className="relative"
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                                    <Bot size={20} className="text-white" />
                                </div>
                            </motion.div>

                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={loadingMessageIndex}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-sm font-medium text-blue-700"
                                >
                                    {LOADING_MESSAGES[loadingMessageIndex]}
                                </motion.p>
                            </AnimatePresence>

                            {/* Shimmer dots */}
                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                        animate={{
                                            scale: [1, 1.5, 1],
                                            opacity: [0.5, 1, 0.5],
                                        }}
                                        transition={{
                                            duration: 1,
                                            repeat: Infinity,
                                            delay: i * 0.2,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* COMPLETED STATE */}
                {state === "completed" && (
                    <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layoutId="task-report-card"
                        className={`relative bg-blue-50/50 backdrop-blur-sm rounded-xl p-4 border border-blue-200/50 min-h-[120px] w-full ${className}`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                    <CheckCircle2 size={14} className="text-blue-600" />
                                </div>
                                <span className="text-xs font-medium text-blue-700">Task Report Ready</span>
                            </div>
                            <motion.button
                                onClick={() => setIsModalOpen(true)}
                                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors group"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Maximize2 size={14} className="text-blue-500 group-hover:text-blue-700" />
                            </motion.button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                            {report.summary}
                        </p>

                        {/* Footer with timestamp and regenerate */}
                        <div className="mt-3 pt-2 border-t border-blue-100 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock size={10} className="text-gray-400" />
                                Generated {formatTimeAgo(generatedAt)}
                            </span>
                            <button
                                onClick={handleRegenerateClick}
                                className="text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
                            >
                                Regenerate
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ReportModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                report={report}
                generatedAt={generatedAt}
            />

            {/* REGENERATE CONFIRMATION DIALOG */}
            <ConfirmationDialog
                isOpen={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
                onConfirm={handleConfirmRegenerate}
                title="Regenerate Task Report?"
                message="Are you sure you want to regenerate this report? The current analysis will be permanently overwritten. This action consumes AI credits and cannot be undone."
                confirmLabel="Regenerate"
                cancelLabel="Cancel"
                variant="warning"
            />
        </>
    );
}

function ReportModal({ isOpen, onClose, report, generatedAt }: { isOpen: boolean; onClose: () => void; report: any; generatedAt: Date | null }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        layoutId="task-report-card"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header - Blue Theme */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                                    <ClipboardList size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900">Task Intelligence Report</h2>
                                    <p className="text-xs text-gray-500 font-mono">Generated by Aether AI</p>
                                </div>
                            </div>
                            <motion.button onClick={onClose} className="p-2 rounded-lg hover:bg-white/50 transition-colors">
                                <X size={20} className="text-gray-500" />
                            </motion.button>
                        </div>

                        <div className="p-6 overflow-y-auto premium-scrollbar flex-1 space-y-6">
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <h3 className="text-sm font-semibold text-blue-900 mb-2">Executive Summary</h3>
                                <p className="text-sm text-blue-800 leading-relaxed">{report.summary}</p>
                            </div>

                            {report.sections.map((section: any, idx: number) => (
                                <div key={idx}>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        {section.title}
                                    </h4>
                                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line pl-4 border-l-2 border-gray-100">
                                        {section.content}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400" />
                                Generated {formatTimeAgo(generatedAt)}
                            </span>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50">
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
