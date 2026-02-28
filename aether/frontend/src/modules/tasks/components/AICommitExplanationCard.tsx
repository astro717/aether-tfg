import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Maximize2, X, Sparkles, CheckCircle2, Clock, Download, RefreshCw } from "lucide-react";
import { tasksApi, type CommitInTaskContextExplanation } from "../../dashboard/api/tasksApi";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";
import { useSettings } from "../../settings/context/SettingsContext";
import { generateCommitExplanationPDF } from "../../../utils/pdfGenerator";

interface AICommitExplanationCardProps {
  taskId: string;
  commitSha: string | null;
  className?: string;
}

type CardState = "idle" | "loading" | "completed" | "error";

// Dynamic loading messages for the "thinking" effect
const LOADING_MESSAGES = [
  "Analyzing changes...",
  "Reading code patterns...",
  "Synthesizing logic...",
  "Generating explanation...",
];

export function AICommitExplanationCard({ taskId, commitSha, className = "" }: AICommitExplanationCardProps) {
  const { aiLanguage, analysisDepth } = useSettings();
  const [state, setState] = useState<CardState>("idle");
  const [explanation, setExplanation] = useState<CommitInTaskContextExplanation | null>(null);
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

  // Reset state when commitSha or taskId changes
  // This ensures we don't show stale data from a previous task/commit
  useEffect(() => {
    setState("idle");
    setExplanation(null);
    setError(null);
  }, [commitSha, taskId]);

  // Check for cached explanation after reset
  useEffect(() => {
    async function checkCache() {
      if (!commitSha || !taskId) return;

      try {
        // Try to get cached contextual explanation without generating new one
        const result = await tasksApi.getCommitExplanationInContext(taskId, commitSha, { onlyCached: true });
        setExplanation(result);
        setState("completed");
      } catch (err) {
        // Silence is golden: any error (404) means no cache, so we stay in idle state
      }
    }

    // Only run this check if we are in the initial state
    if (state === "idle") {
      checkCache();
    }
  }, [commitSha, taskId, state]);

  const handleGenerate = useCallback(async (forceRegenerate: boolean = false) => {
    if (!commitSha || !taskId) return;

    setState("loading");
    setLoadingMessageIndex(0);
    setError(null);

    try {
      const result = await tasksApi.getCommitExplanationInContext(taskId, commitSha, { forceRegenerate, language: aiLanguage, depth: analysisDepth });
      setExplanation(result);
      setState("completed");
    } catch (err) {
      console.error("Failed to generate contextual explanation:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setState("error");
    }
  }, [commitSha, taskId, aiLanguage, analysisDepth]);

  const handleRegenerateClick = () => {
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmRegenerate = () => {
    setState("idle");
    setExplanation(null);
    setError(null);
    // Immediately trigger regeneration with forceRegenerate=true to bypass cache
    handleGenerate(true);
  };

  const handleReset = () => {
    setState("idle");
    setExplanation(null);
    setError(null);
  };

  // No commit available
  if (!commitSha) {
    return (
      <div className={`bg-white/20 dark:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-gray-200/50 dark:border-zinc-700/50 min-h-[120px] opacity-50 ${className}`}>
        <div className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center">
          <Bot size={18} className="text-gray-400 dark:text-gray-500" />
        </div>
        <h4 className="text-gray-400 dark:text-gray-500 font-medium text-sm leading-tight">
          Generate commit explanation
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
            className={`bg-white/30 dark:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 dark:border-zinc-700 hover:bg-white/50 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-zinc-600 transition-all min-h-[120px] group ${className}`}
          >
            <motion.div
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-zinc-600 flex items-center justify-center group-hover:border-purple-400 group-hover:bg-purple-50 dark:group-hover:bg-purple-900/30 transition-all"
              whileHover={{ scale: 1.1 }}
            >
              <Bot size={18} className="text-gray-600 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
            </motion.div>
            <h4 className="text-gray-700 dark:text-gray-300 font-medium text-sm leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Generate commit explanation
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
            className={`relative overflow-hidden rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[120px] ${className}`}
          >
            {/* Animated gradient background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10"
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

            {/* Glass overlay */}
            <div className="absolute inset-0 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm border border-purple-200/50 dark:border-purple-500/30 rounded-xl" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              {/* Pulsing Bot Icon with Glow */}
              <motion.div
                className="relative"
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-purple-400/40 blur-md"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                  <Bot size={20} className="text-white" />
                </div>
              </motion.div>

              {/* Dynamic loading text */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingMessageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm font-medium text-purple-700 dark:text-purple-300"
                >
                  {LOADING_MESSAGES[loadingMessageIndex]}
                </motion.p>
              </AnimatePresence>

              {/* Shimmer dots */}
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-purple-400"
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
        {state === "completed" && explanation && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            layoutId="explanation-card"
            className={`relative flex flex-col bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-green-200/50 dark:border-green-500/30 min-h-[120px] ${className}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                  AI Explanation
                  {explanation.cached && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">(cached)</span>
                  )}
                </span>
              </div>

              {/* Expand Button */}
              <motion.button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Maximize2 size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </motion.button>
            </div>

            {/* Explanation Preview (truncated) */}
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
              {explanation.explanation}
            </p>

            {/* Footer with timestamp and actions */}
            <div className="mt-auto pt-2 border-t border-gray-100 dark:border-zinc-700/50 flex items-center justify-between gap-2 min-w-0">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 min-w-0 truncate shrink">
                <Clock size={10} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <span className="truncate">Generated {formatTimeAgo(explanation.timestamp)}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => generateCommitExplanationPDF(explanation)}
                  className="p-1.5 rounded-md text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  title="Download PDF"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={handleRegenerateClick}
                  className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
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
            className={`bg-red-50/50 dark:bg-red-900/20 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-red-200/50 dark:border-red-500/30 min-h-[120px] ${className}`}
          >
            <div className="w-8 h-8 rounded-full border border-red-300 dark:border-red-500/50 flex items-center justify-center">
              <Bot size={18} className="text-red-500 dark:text-red-400" />
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 max-w-[200px] line-clamp-3">{error}</p>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPANSION MODAL */}
      <ExplanationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        explanation={explanation}
        commitSha={commitSha}
      />

      {/* REGENERATE CONFIRMATION DIALOG */}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmRegenerate}
        title="Regenerate AI Response?"
        message="Are you sure you want to regenerate this explanation? The current analysis will be permanently overwritten. This action consumes AI credits and cannot be undone."
        confirmLabel="Regenerate"
        cancelLabel="Cancel"
        variant="warning"
      />
    </>
  );
}

// Modal Component
interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: CommitInTaskContextExplanation | null;
  commitSha: string;
}

function ExplanationModal({ isOpen, onClose, explanation, commitSha }: ExplanationModalProps) {
  if (!explanation) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            layoutId="explanation-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">AI Contextual Explanation</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Task #{explanation.readableId} • Commit {commitSha.substring(0, 7)}
                  </p>
                </div>
              </div>

              <motion.button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8 overflow-y-auto premium-scrollbar flex-1">
              {/* Explanation Section */}
              <Section title="What This Commit Does">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">{explanation.explanation}</p>
              </Section>

              {/* How It Fulfills Task Section */}
              <Section title="How It Fulfills the Task">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">{explanation.howItFulfillsTask}</p>
              </Section>

              {/* Technical Details Section */}
              <Section title="Technical Details">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">{explanation.technicalDetails}</p>
              </Section>

              {/* Remaining Work Section */}
              {explanation.remainingWork && explanation.remainingWork.length > 0 && (
                <Section title="Remaining Work">
                  <ul className="space-y-2">
                    {explanation.remainingWork.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-purple-500 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                Generated {formatTimeAgo(explanation.timestamp)}
                {explanation.cached && (
                  <span className="ml-1 text-[10px] text-blue-500">(cached)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generateCommitExplanationPDF(explanation)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-sm hover:from-purple-600 hover:to-blue-600 transition-all"
                >
                  <Download size={14} />
                  Download PDF
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
                >
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

// Helper Components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-500 to-blue-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

