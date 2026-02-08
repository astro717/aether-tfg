import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Maximize2, X, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { tasksApi, type CommitExplanation } from "../../dashboard/api/tasksApi";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";
import { formatTimeAgo } from "../../../lib/utils";

interface AICommitExplanationCardProps {
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

export function AICommitExplanationCard({ commitSha, className = "" }: AICommitExplanationCardProps) {
  const [state, setState] = useState<CardState>("idle");
  const [explanation, setExplanation] = useState<CommitExplanation | null>(null);
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

  // Check for cached explanation on mount or commit change
  useEffect(() => {
    async function checkCache() {
      if (!commitSha) return;

      try {
        // Try to get cached explanation without generating new one
        const result = await tasksApi.getCommitExplanation(commitSha, { onlyCached: true });
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
  }, [commitSha]);

  const handleGenerate = useCallback(async () => {
    if (!commitSha) return;

    setState("loading");
    setLoadingMessageIndex(0);
    setError(null);

    try {
      const result = await tasksApi.getCommitExplanation(commitSha);
      setExplanation(result);
      setState("completed");
    } catch (err) {
      console.error("Failed to generate explanation:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setState("error");
    }
  }, [commitSha]);

  const handleRegenerateClick = () => {
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmRegenerate = () => {
    setState("idle");
    setExplanation(null);
    setError(null);
    // Immediately trigger regeneration
    handleGenerate();
  };

  // No commit available
  if (!commitSha) {
    return (
      <div className={`bg-white/20 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-gray-200/50 min-h-[120px] opacity-50 ${className}`}>
        <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">
          <Bot size={18} className="text-gray-400" />
        </div>
        <h4 className="text-gray-400 font-medium text-sm leading-tight">
          Generate commit explanation
        </h4>
        <p className="text-xs text-gray-400">Link a commit first</p>
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
            onClick={handleGenerate}
            className={`bg-white/30 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 hover:bg-white/50 hover:border-gray-300 transition-all min-h-[120px] group ${className}`}
          >
            <motion.div
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center group-hover:border-purple-400 group-hover:bg-purple-50 transition-all"
              whileHover={{ scale: 1.1 }}
            >
              <Bot size={18} className="text-gray-600 group-hover:text-purple-500 transition-colors" />
            </motion.div>
            <h4 className="text-gray-700 font-medium text-sm leading-tight group-hover:text-purple-600 transition-colors">
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
            <div className="absolute inset-0 bg-white/40 backdrop-blur-sm border border-purple-200/50 rounded-xl" />

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
                  className="text-sm font-medium text-purple-700"
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
            className={`relative bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-green-200/50 min-h-[120px] ${className}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 size={14} className="text-green-600" />
                </div>
                <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                  AI Explanation
                  {explanation.cached && (
                    <span className="text-[10px] text-gray-400 font-normal">(cached)</span>
                  )}
                </span>
              </div>

              {/* Expand Button */}
              <motion.button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Maximize2 size={14} className="text-gray-400 group-hover:text-gray-600" />
              </motion.button>
            </div>

            {/* Summary Preview (truncated) */}
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
              {explanation.summary}
            </p>

            {/* Footer with timestamp and regenerate */}
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock size={10} className="text-gray-400" />
                Generated {formatTimeAgo(explanation.timestamp)}
              </span>
              <button
                onClick={handleRegenerateClick}
                className="text-[10px] text-gray-400 hover:text-purple-600 transition-colors"
              >
                Regenerate
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
            className={`bg-red-50/50 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 border border-red-200/50 min-h-[120px] ${className}`}
          >
            <div className="w-8 h-8 rounded-full border border-red-300 flex items-center justify-center">
              <Bot size={18} className="text-red-500" />
            </div>
            <p className="text-xs text-red-600 max-w-[200px] line-clamp-3">{error}</p>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 hover:text-red-700 underline"
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
  explanation: CommitExplanation | null;
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
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">AI Explanation</h2>
                  <p className="text-xs text-gray-500 font-mono">
                    Commit #{commitSha.substring(0, 7)}
                  </p>
                </div>
              </div>

              <motion.button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={20} className="text-gray-500" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto premium-scrollbar flex-1">
              {/* Summary Section */}
              <Section title="Summary">
                <p className="text-gray-700 leading-relaxed text-sm">{explanation.summary}</p>
              </Section>

              {/* Files Changed Section */}
              <Section title="Files Changed">
                <ul className="space-y-1">
                  {explanation.filesChanged.map((file, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-purple-500 mt-1">•</span>
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{file}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Impact Section */}
              <Section title="Impact">
                <p className="text-gray-700 leading-relaxed text-sm">{explanation.impact}</p>
              </Section>

              {/* Code Quality Section */}
              <Section title="Code Quality Assessment">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <QualityBadge quality={explanation.codeQuality} />
                  <span className="text-sm font-medium text-gray-700">{explanation.codeQuality}</span>
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Clock size={12} className="text-gray-400" />
                Generated {formatTimeAgo(explanation.timestamp)}
                {explanation.cached && (
                  <span className="ml-1 text-[10px] text-blue-500">(cached)</span>
                )}
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50"
              >
                Close
              </button>
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
      <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-500 to-blue-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const lowerQuality = quality.toLowerCase();

  if (lowerQuality.includes("good") || lowerQuality.includes("excellent")) {
    return <div className="w-3 h-3 rounded-full bg-green-500" />;
  }
  if (lowerQuality.includes("improvement") || lowerQuality.includes("moderate")) {
    return <div className="w-3 h-3 rounded-full bg-yellow-500" />;
  }
  if (lowerQuality.includes("concern") || lowerQuality.includes("poor")) {
    return <div className="w-3 h-3 rounded-full bg-red-500" />;
  }
  return <div className="w-3 h-3 rounded-full bg-gray-400" />;
}
