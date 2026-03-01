import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X, ShieldAlert, CheckCircle2, ShieldCheck, AlertTriangle, Clock, GitCommit, Download, RefreshCw, Quote } from "lucide-react";
import { tasksApi, type CodeAnalysisResult } from "../../dashboard/api/tasksApi";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";
import { useSettings } from "../../settings/context/SettingsContext";
import { generateCodeAnalysisPDF } from "../../../utils/pdfGenerator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    const { aiLanguage, analysisDepth } = useSettings();
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
            const result = await tasksApi.getCommitCodeAnalysis(commitSha, { forceRegenerate, language: aiLanguage, depth: analysisDepth });
            setAnalysis(result);
            setState("completed");
        } catch (err) {
            console.error("Failed to analyze code:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setState("error");
        }
    }, [commitSha, aiLanguage, analysisDepth]);

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
            <div className={`bg-white/20 dark:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-gray-200/50 dark:border-zinc-700/50 min-h-[120px] opacity-50 ${className}`}>
                <div className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center">
                    <ShieldAlert size={18} className="text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-gray-400 dark:text-gray-500 font-medium text-sm leading-tight">
                    Analyze code & vulnerabilities
                </h4>
                <p className="text-xs text-gray-400 dark:text-gray-500">Link a commit first</p>
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
                        className={`bg-white/30 dark:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 dark:border-zinc-700 hover:bg-white/50 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-zinc-600 transition-all min-h-[120px] group w-full ${className}`}
                    >
                        <motion.div
                            className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center group-hover:border-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/30 transition-all"
                            whileHover={{ scale: 1.1 }}
                        >
                            <ShieldAlert size={18} className="text-gray-600 dark:text-gray-400 group-hover:text-amber-500 transition-colors" />
                        </motion.div>
                        <h4 className="text-gray-700 dark:text-gray-300 font-medium text-sm leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
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

                        <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm border border-amber-200/50 dark:border-amber-500/30 rounded-xl" />

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
                                    className="text-sm font-medium text-amber-700 dark:text-amber-300"
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
                        className={`relative flex flex-col bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm rounded-xl border border-amber-200/60 dark:border-amber-500/20 min-h-[120px] h-full w-full overflow-hidden ${className}`}
                    >
                        {/* Compact Header Bar */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/10 border-b border-amber-100/50 dark:border-amber-800/30">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                                    <CheckCircle2 size={11} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 truncate">
                                    Scan Complete
                                </span>
                                {analysis.cached && (
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
                                <Maximize2 size={12} className="text-amber-600/70 dark:text-amber-400/70" />
                            </motion.button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 relative px-4 py-5 flex flex-col justify-center items-center overflow-hidden">
                            <Quote className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 text-amber-500/15 dark:text-amber-400/15 -rotate-12 pointer-events-none" />
                            <p className="relative z-10 text-[12px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 text-center font-medium italic">
                                {analysis.summary}
                            </p>
                        </div>

                        {/* Minimal Footer */}
                        <div className="px-3 py-2 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/30">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                                <GitCommit size={10} className="opacity-70" />
                                <span className="font-mono">{commitSha.substring(0, 7)}</span>
                            </div>
                            <motion.button
                                onClick={handleRegenerateClick}
                                className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                title="Re-scan"
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
                            <ShieldAlert size={18} className="text-red-500 dark:text-red-400" />
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-400 max-w-[200px] line-clamp-3">{error}</p>
                        <button
                            onClick={handleConfirmRegenerate}
                            className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
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
                        className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Header - Amber/Security Theme */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                                    <ShieldCheck size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900 dark:text-white">Security Analysis</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono flex items-center gap-2">
                                        Score: {analysis.score}
                                        <span className="text-gray-300 dark:text-zinc-600">|</span>
                                        <span className="flex items-center gap-1" title={`Commit: ${commitSha}`}>
                                            <GitCommit size={12} />
                                            {commitSha.substring(0, 7)}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800 transition-colors">
                                <X size={20} className="text-gray-500 dark:text-gray-400" />
                            </motion.button>
                        </div>

                        <div className="p-6 sm:p-8 overflow-y-auto premium-scrollbar flex-1 space-y-6">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">Analysis Summary</h3>
                                    <div className="text-sm text-amber-800 dark:text-amber-200/80 leading-relaxed max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-amber-500" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-amber-500" {...props} />,
                                                li: ({ node, ...props }) => <li {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-semibold text-amber-900 dark:text-amber-100" {...props} />,
                                                code: ({ node, className, children, ...props }) => {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const isInline = !match && !String(children).includes('\n');
                                                    return isInline
                                                        ? <code className="bg-amber-100/50 dark:bg-amber-900/30 flex-shrink-0 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded text-[11px] font-mono whitespace-nowrap" {...props}>{children}</code>
                                                        : <pre className="bg-amber-100/30 dark:bg-amber-900/20 p-3 rounded-lg text-xs font-mono mb-3 overflow-x-auto text-amber-900 dark:text-amber-200"><code className={className} {...props}>{children}</code></pre>;
                                                },
                                            }}
                                        >
                                            {analysis.summary}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Identified Issues</h4>
                                {analysis.issues.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No issues detected.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {analysis.issues.map((issue, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{issue.title}</p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{issue.file}:{issue.line}</p>
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

                        <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 flex items-center justify-between flex-shrink-0">
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                                Scanned {formatTimeAgo(analysis.timestamp)}
                                {analysis.cached && (
                                    <span className="ml-1 text-[10px] text-amber-500">(cached)</span>
                                )}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => generateCodeAnalysisPDF(analysis, commitSha)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all"
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
