import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Maximize2, X, CheckCircle2, ClipboardList, Clock, Download, RefreshCw, Quote } from "lucide-react";
import { tasksApi, type TaskReportResult } from "../../dashboard/api/tasksApi";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";
import { generateTaskReportPDF } from "../../../utils/pdfGenerator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AITaskReportCardProps {
    taskId?: string;
    commitSha: string | null;
    className?: string;
}

type CardState = "idle" | "loading" | "completed" | "error";

const LOADING_MESSAGES = [
    "Analyzing task progress...",
    "Reviewing comments...",
    "Checking commits...",
    "Compiling report...",
];

export function AITaskReportCard({ taskId, commitSha, className = "" }: AITaskReportCardProps) {
    const [state, setState] = useState<CardState>("idle");
    const [report, setReport] = useState<TaskReportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    // Cycle through loading messages
    useEffect(() => {
        if (state !== "loading") return;

        const interval = setInterval(() => {
            setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 1500);

        return () => clearInterval(interval);
    }, [state]);

    // Reset and check for cached report when commit changes
    useEffect(() => {
        async function checkCache() {
            if (!taskId || !commitSha) {
                setState("idle");
                setReport(null);
                return;
            }

            try {
                const result = await tasksApi.getTaskReport(taskId, commitSha, { onlyCached: true });
                setReport(result);
                setState("completed");
            } catch (err) {
                // No cache found, reset to idle
                setState("idle");
                setReport(null);
            }
        }

        checkCache();
    }, [taskId, commitSha]);

    const handleGenerate = useCallback(async (forceRegenerate: boolean = false) => {
        if (!taskId || !commitSha) return;

        setState("loading");
        setLoadingMessageIndex(0);
        setError(null);

        try {
            const result = await tasksApi.getTaskReport(taskId, commitSha, { forceRegenerate });
            setReport(result);
            setState("completed");
        } catch (err) {
            console.error("Failed to generate report:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setState("error");
        }
    }, [taskId, commitSha]);

    const handleRegenerateClick = () => {
        setIsConfirmDialogOpen(true);
    };

    const handleConfirmRegenerate = () => {
        setState("idle");
        setReport(null);
        setError(null);
        // Immediately trigger regeneration with forceRegenerate=true to bypass cache and delete old reports
        handleGenerate(true);
    };

    // No commit available - Disabled State
    if (!commitSha) {
        return (
            <div className={`bg-white/20 dark:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-gray-200/50 dark:border-zinc-700/50 min-h-[120px] opacity-50 ${className}`}>
                <div className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center">
                    <ClipboardList size={18} className="text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-gray-400 dark:text-gray-500 font-medium text-sm leading-tight">
                    Generate task report
                </h4>
                <p className="text-xs text-gray-400 dark:text-gray-500">Link a commit first</p>
            </div>
        );
    }

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
                        onClick={() => handleGenerate(false)}
                        className={`bg-white/30 dark:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 dark:border-zinc-700 hover:bg-white/50 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-zinc-600 transition-all min-h-[120px] group w-full ${className}`}
                    >
                        <motion.div
                            className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center group-hover:border-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-all"
                            whileHover={{ scale: 1.1 }}
                        >
                            <ClipboardList size={18} className="text-gray-600 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                        </motion.div>
                        <h4 className="text-gray-700 dark:text-gray-300 font-medium text-sm leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
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

                        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm border border-blue-200/50 dark:border-blue-500/30 rounded-xl" />

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
                                    className="text-sm font-medium text-blue-700 dark:text-blue-300"
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
                {state === "completed" && report && (
                    <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layoutId="task-report-card"
                        className={`relative flex flex-col bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm rounded-xl border border-blue-200/60 dark:border-blue-500/20 min-h-[120px] h-full w-full overflow-hidden ${className}`}
                    >
                        {/* Compact Header Bar */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50/80 to-cyan-50/50 dark:from-blue-900/20 dark:to-cyan-900/10 border-b border-blue-100/50 dark:border-blue-800/30">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                                    <CheckCircle2 size={11} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 truncate">
                                    Task Report Ready
                                </span>
                                {report.cached && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 font-medium">
                                        cached
                                    </span>
                                )}
                            </div>
                            <motion.button
                                onClick={() => setIsModalOpen(true)}
                                className="p-1 rounded-md hover:bg-white/60 dark:hover:bg-zinc-800 transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                title="Expand"
                            >
                                <Maximize2 size={12} className="text-blue-600/70 dark:text-blue-400/70" />
                            </motion.button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 relative px-4 py-5 flex flex-col justify-center items-center overflow-hidden">
                            <Quote className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 text-blue-500/15 dark:text-blue-400/15 -rotate-12 pointer-events-none" />
                            <p className="relative z-10 text-[12px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 text-center font-medium italic">
                                {report.summary}
                            </p>
                        </div>

                        {/* Minimal Footer */}
                        <div className="px-3 py-2 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/30">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                <Clock size={9} className="opacity-70" />
                                {formatTimeAgo(report.timestamp)}
                            </span>
                            <motion.button
                                onClick={handleRegenerateClick}
                                className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                title="Regenerate"
                            >
                                <RefreshCw size={11} />
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* ERROR STATE */}
                {state === "error" && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-red-50/50 dark:bg-red-900/20 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-red-200/50 dark:border-red-500/30 min-h-[120px] w-full ${className}`}
                    >
                        <div className="w-8 h-8 rounded-full border border-red-300 dark:border-red-500/50 flex items-center justify-center">
                            <Bot size={18} className="text-red-500 dark:text-red-400" />
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-400 max-w-[200px] line-clamp-3">{error}</p>
                        <button
                            onClick={() => handleGenerate(true)}
                            className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
                        >
                            Try again
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <ReportModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                report={report}
                taskId={taskId}
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

function ReportModal({ isOpen, onClose, report, taskId }: { isOpen: boolean; onClose: () => void; report: TaskReportResult | null; taskId?: string }) {
    if (!report) return null;

    const handleDownloadPDF = () => {
        if (!report) return;
        const taskTitle = taskId ? `Task ${taskId}` : 'Task Report';
        generateTaskReportPDF(report, taskTitle);
    };

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
                        className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header - Blue Theme */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                                    <ClipboardList size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900 dark:text-white">Task Intelligence Report</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Generated by Aether AI</p>
                                </div>
                            </div>
                            <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800 transition-colors">
                                <X size={20} className="text-gray-500 dark:text-gray-400" />
                            </motion.button>
                        </div>

                        <div className="p-6 sm:p-8 overflow-y-auto premium-scrollbar flex-1 space-y-6">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Executive Summary</h3>
                                <div className="text-sm text-blue-800 dark:text-blue-200/80 leading-relaxed max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-semibold text-blue-900 dark:text-blue-100" {...props} />,
                                        }}
                                    >
                                        {report.summary}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {report.sections.map((section, idx) => (
                                <div key={idx}>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        {section.title}
                                    </h4>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pl-4 border-l-2 border-gray-100 dark:border-zinc-800">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-blue-500" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-blue-500" {...props} />,
                                                li: ({ node, ...props }) => <li {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />,
                                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-base font-bold text-gray-900 dark:text-white mt-3 mb-2" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2 mb-1" {...props} />,
                                                code: ({ node, className, children, ...props }) => {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const isInline = !match && !String(children).includes('\n');
                                                    return isInline
                                                        ? <code className="bg-gray-100 dark:bg-zinc-800 flex-shrink-0 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded text-[11px] font-mono whitespace-nowrap" {...props}>{children}</code>
                                                        : <pre className="bg-gray-100 dark:bg-zinc-800 p-3 rounded-lg text-xs font-mono mb-3 overflow-x-auto text-gray-800 dark:text-gray-200"><code className={className} {...props}>{children}</code></pre>;
                                                },
                                                blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-blue-400 pl-3 italic text-gray-500 dark:text-gray-400 my-2" {...props} />,
                                            }}
                                        >
                                            {section.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 flex items-center justify-between flex-shrink-0">
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                                Generated {formatTimeAgo(report.timestamp)}
                                {report.cached && (
                                    <span className="ml-1 text-[10px] text-blue-500">(cached)</span>
                                )}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-sm hover:from-blue-600 hover:to-cyan-600 transition-all"
                                >
                                    <Download size={14} />
                                    Download PDF
                                </button>
                                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
