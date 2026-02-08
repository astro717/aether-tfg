import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X, ShieldAlert, CheckCircle2, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";

interface AICodeAnalysisCardProps {
    taskId?: string;
    className?: string;
}

type CardState = "idle" | "loading" | "completed" | "error";

const LOADING_MESSAGES = [
    "Scanning code structure...",
    "Detecting vulnerabilities...",
    "Checking security patterns...",
    "Validating inputs...",
];

export function AICodeAnalysisCard({ taskId, className = "" }: AICodeAnalysisCardProps) {
    const [state, setState] = useState<CardState>("idle");
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

    // Mock data
    const analysis = {
        summary: "No critical vulnerabilities found. However, there are 2 potential security hotspots related to input sanitization that should be reviewed.",
        score: "B+",
        issues: [
            { severity: "medium", title: "Missing input validation", file: "auth.controller.ts", line: 45 },
            { severity: "low", title: "Hardcoded timeout value", file: "users.service.ts", line: 120 }
        ]
    };

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
        setTimeout(() => {
            setState("completed");
            setGeneratedAt(new Date());
        }, 4000); // Slightly longer for "scanning" effect
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
                {/* IDLE */}
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
                {state === "completed" && (
                    <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layoutId="code-analysis-card"
                        className={`relative bg-amber-50/50 backdrop-blur-sm rounded-xl p-4 border border-amber-200/50 min-h-[120px] w-full ${className}`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                    <CheckCircle2 size={14} className="text-amber-600" />
                                </div>
                                <span className="text-xs font-medium text-amber-700">Scan Complete</span>
                            </div>
                            <motion.button
                                onClick={() => setIsModalOpen(true)}
                                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors group"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Maximize2 size={14} className="text-amber-500 group-hover:text-amber-700" />
                            </motion.button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                            {analysis.summary}
                        </p>

                        {/* Footer with timestamp and regenerate */}
                        <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock size={10} className="text-gray-400" />
                                Scanned {formatTimeAgo(generatedAt)}
                            </span>
                            <button
                                onClick={handleRegenerateClick}
                                className="text-[10px] text-gray-400 hover:text-amber-600 transition-colors"
                            >
                                Re-scan
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnalysisModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                analysis={analysis}
                generatedAt={generatedAt}
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

function AnalysisModal({ isOpen, onClose, analysis, generatedAt }: { isOpen: boolean; onClose: () => void; analysis: any; generatedAt: Date | null }) {
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
                                    <p className="text-xs text-gray-500 font-mono">Score: {analysis.score}</p>
                                </div>
                            </div>
                            <motion.button onClick={onClose} className="p-2 rounded-lg hover:bg-white/50 transition-colors">
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
                                <div className="space-y-3">
                                    {analysis.issues.map((issue: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{issue.title}</p>
                                                    <p className="text-xs text-gray-400 font-mono">{issue.file}:{issue.line}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{issue.severity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Clock size={12} className="text-gray-400" />
                                Scanned {formatTimeAgo(generatedAt)}
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
