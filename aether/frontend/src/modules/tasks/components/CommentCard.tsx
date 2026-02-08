import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, File as FileIcon, Image as ImageIcon } from "lucide-react";
import type { CommentAttachment } from "../../dashboard/api/tasksApi";

interface CommentCardProps {
  author: string;
  role: string;
  content: string | null;
  createdAt?: string;
  isMe?: boolean;
  attachments?: CommentAttachment[];
}

export function CommentCard({
  author,
  role,
  content,
  createdAt,
  isMe = false,
  attachments = [],
}: CommentCardProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const imageAttachments = attachments.filter((a) =>
    a.file_type.startsWith("image/")
  );
  const documentAttachments = attachments.filter(
    (a) => !a.file_type.startsWith("image/")
  );

  return (
    <>
      <div className="bg-[#FCFCFD] rounded-[24px] p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center text-[10px] text-white font-bold">
              {role}
            </div>
            <span className="font-bold text-sm text-gray-900">
              {author}{" "}
              {isMe && (
                <span className="text-gray-400 font-normal ml-1">(You)</span>
              )}
            </span>
          </div>
          {createdAt && (
            <span className="text-[10px] text-gray-400">
              {formatTime(createdAt)}
            </span>
          )}
        </div>

        {/* Text Content */}
        {content && (
          <p className="text-[11px] text-gray-500 leading-relaxed font-medium mb-3">
            {content}
          </p>
        )}

        {/* Image Grid */}
        {imageAttachments.length > 0 && (
          <div
            className={`grid gap-2 mb-3 ${
              imageAttachments.length === 1
                ? "grid-cols-1"
                : imageAttachments.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
            }`}
          >
            {imageAttachments.slice(0, 6).map((attachment, index) => (
              <button
                key={attachment.id}
                onClick={() => setLightboxImage(attachment.file_url)}
                className="relative aspect-square overflow-hidden rounded-xl group"
              >
                <img
                  src={attachment.file_url}
                  alt={attachment.file_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {index === 5 && imageAttachments.length > 6 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      +{imageAttachments.length - 6}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Document Attachments */}
        {documentAttachments.length > 0 && (
          <div className="space-y-2">
            {documentAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileIcon size={16} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {attachment.file_name}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>
                <Download
                  size={14}
                  className="text-gray-400 group-hover:text-gray-600 transition-colors"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={lightboxImage}
              alt="Full size"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
