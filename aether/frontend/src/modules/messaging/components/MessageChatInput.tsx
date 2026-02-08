
import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Plus, X, FileText, Image, Film, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFileUpload, type UploadedFile } from "../../../hooks/useFileUpload";

interface PendingFile {
  file: File;
  preview?: string;
  id: string;
}

interface MessageChatInputProps {
  onSend: (content: string, attachments?: UploadedFile[]) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
}: MessageChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const { uploadFiles, isUploading, progress } = useFileUpload("messages");

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)} px`;
    }
  }, [inputValue]);

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: PendingFile[] = Array.from(files).map((file) => ({
      file,
      id: `${Date.now()} -${Math.random().toString(36).slice(2, 11)} `,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleFileSelect = useCallback(
    (accept: string) => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
      setShowAttachMenu(false);
    },
    []
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleSend = async () => {
    const hasContent = inputValue.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;

    if ((!hasContent && !hasFiles) || sending || disabled) return;

    const content = inputValue.trim();
    setInputValue("");
    setSending(true);

    // Reset height immediately
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      let uploadedAttachments: UploadedFile[] = [];

      if (hasFiles) {
        const filesToUpload = pendingFiles.map((pf) => pf.file);
        uploadedAttachments = await uploadFiles(filesToUpload);
      }

      // Clear pending files after successful upload
      pendingFiles.forEach((pf) => {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      });
      setPendingFiles([]);

      await onSend(content, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);

      // Refocus input
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      // Restore input on error
      setInputValue(content);
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
      // Wait a bit before refocusing to avoid layout shift issues
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (inputValue.trim().length > 0 || pendingFiles.length > 0) && !sending && !disabled;

  return (
    <div
      className={`
        relative p-4
        ${isDragOver ? "bg-blue-50/50" : "bg-gradient-to-t from-white via-white to-transparent"}
        transition-colors duration-300
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay - improved visual */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-2 bg-blue-500/10 backdrop-blur-sm flex flex-col items-center justify-center z-20 border-2 border-dashed border-blue-400 rounded-2xl"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Sparkles className="text-blue-600" size={24} />
            </div>
            <p className="text-blue-600 font-semibold text-lg">Drop files to attach</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        {/* File previews */}
        <AnimatePresence>
          {pendingFiles.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 12 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-1">
                {pendingFiles.map((pf) => (
                  <FilePreview key={pf.id} file={pf} onRemove={() => removeFile(pf.id)} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload progress */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-3 px-1"
            >
              <div className="flex items-center justify-between text-xs font-medium text-blue-600 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Uploading files...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}% ` }}
                  transition={{ ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area - The "Capsule" */}
        <div
          className={`
            relative flex items-center gap-2 p-1.5
            bg-white/80 backdrop-blur-xl
            rounded-[24px]
            border transition-all duration-300 ease-out
            shadow-sm hover:shadow-md
            ${isFocused
              ? "border-blue-400/50 shadow-blue-500/10 ring-4 ring-blue-500/5"
              : "border-gray-200/60 shadow-gray-200/50"
            }
`}
        >
          {/* Attachment button */}
          <div className="relative mb-0.5" ref={attachMenuRef}>
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              disabled={disabled || sending}
              className={`
                w-9 h-9 rounded-full flex-shrink-0
                flex items-center justify-center
                transition-all duration-200
                ${showAttachMenu
                  ? "bg-gray-100 text-gray-900 rotate-90"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title="Attach file"
            >
              <Plus size={24} className="transition-transform duration-200" />
            </button>

            {/* Premium Attachment Menu */}
            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="absolute bottom-12 left-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[200px] z-30 p-1.5 ring-1 ring-black/5"
                >

                  <button
                    onClick={() => handleFileSelect("image/*,video/*")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                      <Image size={16} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-medium text-gray-700 group-hover:text-blue-700">Photos & Videos</span>
                      <span className="block text-[10px] text-gray-400">Share memories</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleFileSelect("*/*")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group mt-1"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center group-hover:from-purple-200 group-hover:to-pink-200 transition-colors">
                      <FileText size={16} className="text-purple-600" />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-medium text-gray-700 group-hover:text-purple-700">Documents</span>
                      <span className="block text-[10px] text-gray-400">PDFs, files, etc.</span>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Text input */}
          <div className="flex-1 relative py-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || sending}
              rows={1}
              className="
                w-full
                bg-transparent
                text-[15px] leading-relaxed text-gray-800
                placeholder:text-gray-400
                outline-none
                resize-none
                border-none p-0 m-0
                max-h-[160px]
                selection:bg-blue-100 selection:text-blue-900
                disabled:opacity-50
              "
              style={{
                minHeight: "24px",
                // Hide scrollbar but keep functionality
                scrollbarWidth: "none",
                msOverflowStyle: "none"
              }}
            />
            <style>{`
textarea::-webkit-scrollbar {
  display: none;
}
`}</style>
          </div>

          {/* Send button */}
          <div className="relative mb-0.5">
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`
                w-9 h-9 rounded-full flex-shrink-0
                flex items-center justify-center
                transition-all duration-300
                ${canSend
                  ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }
`}
            >
              {sending || isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={18} className="translate-x-[-1px] translate-y-[1px]" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilePreviewProps {
  file: PendingFile;
  onRemove: () => void;
}

function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.file.type.startsWith("image/");
  const isVideo = file.file.type.startsWith("video/");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      layout
      className="relative group flex-shrink-0"
    >
      {isImage && file.preview ? (
        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200/50 shadow-sm">
          <img
            src={file.preview}
            alt={file.file.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 w-6 h-6 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500"
          >
            <X size={12} className="text-white" />
          </button>
          <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-white font-medium truncate">{formatFileSize(file.file.size)}</p>
          </div>
        </div>
      ) : (
        <div className="relative w-48 flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200/60 shadow-sm group-hover:shadow-md transition-all">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
            ${isVideo ? 'bg-indigo-50 text-indigo-500' : 'bg-orange-50 text-orange-500'}
          `}>
            {isVideo ? (
              <Film size={18} />
            ) : (
              <FileText size={18} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
              {file.file.name}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.file.size)}
            </p>
          </div>
          <motion.button
            onClick={onRemove}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="
              w-6 h-6
              rounded-full
              flex items-center justify-center
              hover:bg-gray-200
              transition-colors
            "
          >
            <X size={14} className="text-gray-500" />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
