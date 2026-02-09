import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X, ShieldAlert, CheckCircle2, ShieldCheck, AlertTriangle, Clock, GitCommit } from "lucide-react";
import { tasksApi, type CodeAnalysisResult } from "../../dashboard/api/tasksApi";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";

interface AICodeAnalysisCardProps {
    taskId?: string;
    commitSha: string | null;
    className?: string;
}

type CardState = "idle" | "loading" | "completed" | "error";

const LOADING_MESSAGES = [
    "Scanning code structure...",
    "Detecting vulnerabilities...",
    "Checking security patterns...",
    "Validating inputs...",
];

export function AICodeAnalysisCard({ commitSha, className = "" }: AICodeAnalysisCardProps) {
    const [state, setState] = useState<CardState>("idle");
    const [analysis, setAnalysis] = useState<CodeAnalysisResult | null>(null);
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

    // Reset and check for cached analysis when commit changes
    useEffect(() => {
        async function checkCache() {
            if (!commitSha) {
                setState("idle");
                setAnalysis(null);
                return;
            }

            try {
                // Try to get cached analysis
                const result = await tasksApi.getCommitCodeAnalysis(commitSha, { onlyCached: true });
                setAnalysis(result);
                setState("completed");
            } catch (err) {
                // No cache found, reset to idle
                setState("idle");
                setAnalysis(null);
            }
        }

        checkCache();
    }, [commitSha]);

    const handleGenerate = useCallback(async (forceRegenerate: boolean = false) => {
        if (!commitSha) return;

        setState("loading");
        setLoadingMessageIndex(0);
        setError(null);

        try {
            const result = await tasksApi.getCommitCodeAnalysis(commitSha, { forceRegenerate });
            setAnalysis(result);
            setState("completed");
        } catch (err) {
            console.error("Failed to analyze code:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setState("error");
        }
    }, [commitSha]);

    const handleRegenerateClick = () => {
        setIsConfirmDialogOpen(true);
    };

    const handleConfirmRegenerate = () => {
        setState("idle");
        setAnalysis(null);
        setError(null);
        // Trigger regeneration with forceRegenerate=true to bypass cache and delete old reports
        handleGenerate(true);
    };

    // No commit available - Disabled State
    if (!commitSha) {
        return (
            <div className={`bg-white/20 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-gray-200/50 min-h-[120px] opacity-50 ${className}`}>
                <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">
                    <ShieldAlert size={18} className="text-gray-400" />
                </div>
                <h4 className="text-gray-400 font-medium text-sm leading-tight">
                    Analyze code & vulnerabilities
                </h4>
                <p className="text-xs text-gray-400">Link a commit first</p>
            </div>
        );
    }

    return (
        <>
            <AnimatePresence mode="wait">
                {/* IDLE */}
                {state === "idle" && (
                    <motion.button
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => handleGenerate(false)}
                        className={`bg-white/30 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 hover:bg-white/50 hover:border-gray-300 transition-all min-h-[120px] group w-full ${className}`}
                    >
                        <motion.div
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center group-hover:border-amber-400 group-hover:bg-amber-50 transition-all"
                            whileHover={{ scale: 1.1 }}
                        >
                            <ShieldAlert size={18} className="text-gray-600 group-hover:text-amber-500 transition-colors" />
                        </motion.div>
                        <h4 className="text-gray-700 font-medium text-sm leading-tight group-hover:text-amber-600 transition-colors">
                            Analyze code & vulnerabilities
                        </h4>
                    </motion.button>
                )}

                {/* LOADING */}
                {state === "loading" && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`relative overflow-hidden rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[120px] w-full ${className}`}
                    >
                        {/* Amber/Security Theme Gradient */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10"
                            animate={{
                                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                            }}
                            transition={{
                                duration: 2, // Faster for alert feel
                                repeat: Infinity,
                                ease: "linear",
                            }}
                            style={{ backgroundSize: "200% 100%" }}
                        />

                        <div className="absolute inset-0 bg-white/40 backdrop-blur-sm border border-amber-200/50 rounded-xl" />

                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <motion.div
                                className="relative"
                                animate={{ rotate: [0, 360] }} // Rotating shield scan
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            >
                                <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                                    <ShieldCheck size={20} className="text-white" />
                                </div>
                            </motion.div>

                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={loadingMessageIndex}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-sm font-medium text-amber-700"
                                >
                                    {LOADING_MESSAGES[loadingMessageIndex]}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}

                {/* COMPLETED */}
                {state === "completed" && analysis && (
                    <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layoutId="code-analysis-card"
                        className={`relative bg-amber-50/50 backdrop-blur-sm rounded-xl p-4 border border-amber-200/50 min-h-[120px] w-full ${className}`}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 size={12} className="text-amber-600 sm:w-[14px] sm:h-[14px]" />
                                </div>
                                <span className="text-[11px] sm:text-xs font-medium text-amber-700 flex items-center gap-1 truncate">
                                    Scan Complete
                                    {analysis.cached && (
                                        <span className="hidden sm:inline text-[10px] text-gray-400 font-normal shrink-0">(cached)</span>
                                    )}
                                </span>
                            </div>
                            <motion.button
                                onClick={() => setIsModalOpen(true)}
                                className="self-end sm:self-auto p-1.5 rounded-lg hover:bg-white/50 transition-colors group shrink-0"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Maximize2 size={14} className="text-amber-500 group-hover:text-amber-700" />
                            </motion.button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                            {analysis.summary}
                        </p>

                        {/* Footer with timestamp, commit SHA, and regenerate */}
                        <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Clock size={10} className="text-gray-400" />
                                    Scanned {formatTimeAgo(analysis.timestamp)}
                                </span>
                                <span className="text-[10px] text-gray-300">|</span>
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono" title={`Analyzing commit: ${commitSha}`}>
                                    <GitCommit size={10} className="text-gray-400" />
                                    {commitSha.substring(0, 7)}
                                </span>
                            </div>
                            <button
                                onClick={handleRegenerateClick}
                                className="text-[10px] text-gray-400 hover:text-amber-600 transition-colors"
                            >
                                Re-scan
                            </button>
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
                        className={`bg-red-50/50 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-red-200/50 min-h-[120px] w-full ${className}`}
                    >
                        <div className="w-8 h-8 rounded-full border border-red-300 flex items-center justify-center">
                            <ShieldAlert size={18} className="text-red-500" />
                        </div>
                        <p className="text-xs text-red-600 max-w-[200px] line-clamp-3">{error}</p>
                        <button
                            onClick={handleConfirmRegenerate}
                            className="text-xs text-red-500 hover:text-red-700 underline"
                        >
                            Try again
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnalysisModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                analysis={analysis}
                commitSha={commitSha}
            />

            {/* REGENERATE CONFIRMATION DIALOG */}
            <ConfirmationDialog
                isOpen={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
                onConfirm={handleConfirmRegenerate}
                title="Re-scan Code Analysis?"
                message="Are you sure you want to re-scan this code? The current security analysis will be permanently overwritten. This action consumes AI credits and cannot be undone."
                confirmLabel="Re-scan"
                cancelLabel="Cancel"
                variant="warning"
            />
        </>
    );
}

function AnalysisModal({ isOpen, onClose, analysis, commitSha }: { isOpen: boolean; onClose: () => void; analysis: CodeAnalysisResult | null; commitSha: string }) {
    if (!analysis) return null;

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
                        layoutId="code-analysis-card"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header - Amber/Security Theme */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                                    <ShieldCheck size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900">Security Analysis</h2>
                                    <p className="text-xs text-gray-500 font-mono flex items-center gap-2">
                                        Score: {analysis.score}
                                        <span className="text-gray-300">|</span>
                                        <span className="flex items-center gap-1" title={`Commit: ${commitSha}`}>
                                            <GitCommit size={12} />
                                            {commitSha.substring(0, 7)}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/50 transition-colors">
                                <X size={20} className="text-gray-500" />
                            </motion.button>
                        </div>

                        <div className="p-6 overflow-y-auto premium-scrollbar flex-1 space-y-6">
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <h3 className="text-sm font-semibold text-amber-900 mb-1">Analysis Summary</h3>
                                    <p className="text-sm text-amber-800 leading-relaxed">{analysis.summary}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Identified Issues</h4>
                                {analysis.issues.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No issues detected.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {analysis.issues.map((issue, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{issue.title}</p>
                                                        <p className="text-xs text-gray-400 font-mono">{issue.file}:{issue.line}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-medium uppercase tracking-wider ${issue.severity === 'high' ? 'text-red-500' : issue.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
                                                    {issue.severity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400" />
                                Scanned {formatTimeAgo(analysis.timestamp)}
                                {analysis.cached && (
                                    <span className="ml-1 text-[10px] text-amber-500">(cached)</span>
                                )}
                            </span>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50">
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
