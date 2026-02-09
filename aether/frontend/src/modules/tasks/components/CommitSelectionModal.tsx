import { motion, AnimatePresence } from "framer-motion";
import { X, GitCommit, AlertCircle } from "lucide-react";

interface CommitSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    commitHash: string | null;
    commitMessage?: string;
}

export function CommitSelectionModal({
    isOpen,
    onClose,
    onConfirm,
    commitHash,
    commitMessage,
}: CommitSelectionModalProps) {
    const shortHash = commitHash?.substring(0, 7) || "";

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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                                    <GitCommit size={20} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-900">Switch Commit View</h2>
                                    <p className="text-xs text-gray-500 font-mono">{shortHash}</p>
                                </div>
                            </div>
                            <motion.button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-white/50 transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </motion.button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
                                <div className="flex-1">
                                    <p className="text-sm text-blue-900 leading-relaxed">
                                        This will update the code view and AI analysis to reflect the state of code at this commit.
                                    </p>
                                </div>
                            </div>

                            {commitMessage && (
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-xs text-gray-500 font-medium mb-1">Commit Message:</p>
                                    <p className="text-sm text-gray-700 line-clamp-2">{commitMessage}</p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-sm hover:from-blue-600 hover:to-indigo-600 transition-all"
                            >
                                Switch to this commit
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
