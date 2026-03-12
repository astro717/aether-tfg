import { useState, useEffect, useRef, useCallback } from "react";
import { X, Paperclip, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFileUpload, type UploadedFile } from "../../../hooks/useFileUpload";

interface PendingFile {
  file: File;
  preview?: string;
  id: string;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string, attachments?: UploadedFile[]) => Promise<void>;
}

export function CommentModal({ isOpen, onClose, onSubmit }: CommentModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFiles, isUploading, progress } = useFileUpload("comment-attachments");

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setPendingFiles([]);
    }
  }, [isOpen]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: PendingFile[] = Array.from(files).map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const f = prev.find((pf) => pf.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((pf) => pf.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleSubmit = async () => {
    if ((!content.trim() && pendingFiles.length === 0) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let uploaded: UploadedFile[] = [];
      if (pendingFiles.length > 0) {
        uploaded = await uploadFiles(pendingFiles.map((pf) => pf.file));
        pendingFiles.forEach((pf) => { if (pf.preview) URL.revokeObjectURL(pf.preview); });
      }
      await onSubmit(content.trim(), uploaded.length > 0 ? uploaded : undefined);
      setContent("");
      setPendingFiles([]);
      onClose();
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) handleSubmit();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const canSubmit = (content.trim().length > 0 || pendingFiles.length > 0) && !isSubmitting && !isUploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl animate-modal-enter"
        style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Comment</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 space-y-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your comment..."
            rows={4}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl resize-none text-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
          />

          {/* File previews */}
          <AnimatePresence>
            {pendingFiles.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((pf) => (
                    <motion.div
                      key={pf.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group"
                    >
                      {pf.preview ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
                          <img src={pf.preview} alt={pf.file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 max-w-[180px]">
                          <FileText size={14} className="text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{pf.file.name}</p>
                            <p className="text-[10px] text-gray-400">{formatFileSize(pf.file.size)}</p>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(pf.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload progress */}
          <AnimatePresence>
            {isUploading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Uploading...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            ⌘ + Enter to submit · Drag & drop files to attach
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 pb-5">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || isUploading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
          >
            <Paperclip size={15} />
            Attach
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
            >
              {(isSubmitting || isUploading) && <Loader2 size={14} className="animate-spin" />}
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          onChange={(e) => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ""; } }}
        />
      </div>

      <style>{`
        @keyframes modal-enter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-enter { animation: modal-enter 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
}
