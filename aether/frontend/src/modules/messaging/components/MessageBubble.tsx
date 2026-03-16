import { useRef, useEffect, useState } from "react";
import { Check, CheckCheck, ClipboardList, FileText, Download, X, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { type Message, type CommentNotificationMetadata, type MessageAttachment, type MessageUser } from "../api/messagingApi";
import { formatMessageTime } from "../data/mockData";
import { getAvatarColorClasses } from "../../../lib/avatarColors";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  otherUser?: MessageUser | null;
}

export function MessageBubble({
  message,
  isSent,
  isFirstInGroup = false,
  isLastInGroup = false,
  otherUser = null
}: MessageBubbleProps) {
  const navigate = useNavigate();

  // Track if this is a fresh mount (new message) to apply animation only once
  // Fix for "glitch": Don't animate if it's a confirmed message (sent by us, real ID)
  // because it's replacing an optimistic one that already animated.
  const [shouldAnimate] = useState(() => {
    if (isSent && !message.id.startsWith('optimistic-')) {
      return false;
    }
    return true;
  });
  const hasAnimated = useRef(false);

  useEffect(() => {
    // After first render, mark as animated to prevent re-animation on refetch
    if (!hasAnimated.current) {
      hasAnimated.current = true;
    }
  }, []);

  const isCommentNotification = message.type === 'comment_notification';
  const metadata = message.metadata as CommentNotificationMetadata | null;

  // Aether-native styling as per spec:
  // Me (Sent): Dark Gray / Charcoal (bg-gray-800), rounded-2xl rounded-tr-sm
  // Others (Received): Glass White (bg-white/60), rounded-2xl rounded-tl-sm
  const bubbleClasses = isSent
    ? "bg-gradient-to-br from-[#1f2c3f] to-[#24364d] border border-white/5 text-white/95"
    : "bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md border border-white/60 dark:border-white/5 text-gray-800 dark:text-gray-100";

  const alignmentClasses = isSent ? "justify-end" : "justify-start";

  // Rounded corners - adaptive tail logic
  let radiusClasses = "rounded-[20px] ";
  if (isSent) {
    if (!isFirstInGroup) radiusClasses += "rounded-tr-[5px] ";
    if (!isLastInGroup) radiusClasses += "rounded-br-[5px] ";
  } else {
    if (!isFirstInGroup) radiusClasses += "rounded-tl-[5px] ";
    if (!isLastInGroup) radiusClasses += "rounded-bl-[5px] ";
  }

  // Determine message status from read_at
  const getStatus = (): 'sent' | 'delivered' | 'read' => {
    if (message.read_at) return 'read';
    // For optimistic messages (id starts with 'optimistic-'), show as sent
    if (message.id.startsWith('optimistic-')) return 'sent';
    return 'delivered';
  };

  const status = isSent ? getStatus() : null;

  // Comment Notification Card — Task Context Card (clickable, navigates to task)
  if (isCommentNotification && metadata) {
    const bubbleBase = isSent
      ? "bg-gradient-to-br from-[#1f2c3f] to-[#24364d] border border-white/5 text-white/95"
      : "bg-white/50 dark:bg-zinc-800/50 backdrop-blur-md border border-white/60 dark:border-white/5 text-gray-800 dark:text-gray-100";

    const headerBg = isSent
      ? "bg-white/[0.06]"
      : "bg-black/[0.04] dark:bg-white/[0.04]";

    const dividerColor = isSent
      ? "border-white/[0.08]"
      : "border-black/[0.06] dark:border-white/[0.08]";

    return (
      <div className={`flex ${alignmentClasses} ${shouldAnimate ? 'animate-message-in' : ''}`}>
        <button
          onClick={() => navigate(`/tasks/${metadata.taskId}`)}
          className={`
            relative max-w-[70%] min-w-[220px] text-left
            ${bubbleBase}
            rounded-2xl shadow-md overflow-hidden
            group cursor-pointer
            hover:brightness-[1.08] active:scale-[0.985]
            transition-all duration-200
          `}
        >
          {/* Task header band */}
          <div className={`flex items-center justify-between gap-2 px-3 py-2 ${headerBg} border-b ${dividerColor}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <ClipboardList size={11} className={`flex-shrink-0 ${isSent ? "text-blue-400/70" : "text-blue-500/60 dark:text-blue-400/60"}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-widest flex-shrink-0 ${isSent ? "text-white/40" : "text-gray-400 dark:text-gray-500"}`}>
                Task
              </span>
              <span className={`opacity-25 flex-shrink-0`}>·</span>
              <span className={`text-[11px] font-medium truncate ${isSent ? "text-white/65" : "text-gray-500 dark:text-gray-400"}`}>
                {metadata.taskTitle}
              </span>
            </div>
            <ArrowUpRight
              size={13}
              className={`flex-shrink-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                isSent
                  ? "text-white/25 group-hover:text-white/55"
                  : "text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400"
              }`}
            />
          </div>

          {/* Message content */}
          <div className="flex flex-col gap-1 px-3 py-2.5">
            <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
              <span className="inline-block w-[72px]" />
            </p>

            {/* Floating Timestamp & Status */}
            <div className={`absolute bottom-[8px] right-[12px] flex items-center gap-1`}>
              <span className={`text-[10px] font-medium opacity-60 ${isSent ? "text-white" : "text-gray-500 dark:text-gray-400"}`}>
                {formatMessageTime(new Date(message.created_at))}
              </span>
              {isSent && status && (
                <span className={`transition-colors duration-300 ${
                  status === 'read' ? 'text-blue-400' :
                  status === 'delivered' ? 'text-white/60' :
                  'text-white/30'
                }`}>
                  {status === 'sent' && <Check size={10} />}
                  {(status === 'delivered' || status === 'read') && <CheckCheck size={10} />}
                </span>
              )}
            </div>
          </div>
        </button>
      </div>
    );
  }

  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasContent = Boolean(message.content && message.content.trim().length > 0);

  // Separate images from other files
  const imageAttachments = message.attachments?.filter(att =>
    att.file_type.startsWith("image/")
  ) || [];
  const documentAttachments = message.attachments?.filter(att =>
    !att.file_type.startsWith("image/")
  ) || [];

  const getUserInitials = (user: MessageUser) => {
    return user.username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || user.username.slice(0, 2).toUpperCase();
  };

  // Regular text message (possibly with attachments)
  return (
    <div className={`flex ${alignmentClasses} ${shouldAnimate ? 'animate-message-in' : ''} group/message`}>
      {/* Avatar for received messages */}
      {!isSent && (
        <div className="w-8 flex-shrink-0 mr-2 flex flex-col justify-end pb-0.5">
          {isLastInGroup && otherUser ? (
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm
                ${getAvatarColorClasses(otherUser.avatar_color).bg}
                ${getAvatarColorClasses(otherUser.avatar_color).text}
                ${getAvatarColorClasses(otherUser.avatar_color).border}
              `}
            >
              {getUserInitials(otherUser)}
            </div>
          ) : null}
        </div>
      )}

      <div
        className={`
          relative max-w-[75%]
          ${
            imageAttachments.length > 0 && !hasContent
              ? 'pb-7'                   // images-only: strip at bottom for timestamp
              : imageAttachments.length > 0 && hasContent
                ? 'pb-[12px]'           // images + text: edge-to-edge images, bottom space
                : hasAttachments && !hasContent
                  ? ''                  // docs-only: inner div handles padding
                  : 'px-[16px] pt-[10px] pb-[12px]'  // text only or text+docs
          }
          ${bubbleClasses}
          ${radiusClasses}
          overflow-hidden
          shadow-sm
        `}
      >
        {/* Image Attachments Grid */}
        {imageAttachments.length > 0 && (
          <ImageGrid
            images={imageAttachments}
            isSent={isSent}
            hasContent={hasContent}
          />
        )}

        {/* Document Attachments */}
        {documentAttachments.length > 0 && (
          <div className={`${hasContent || imageAttachments.length > 0 ? 'px-4 pb-2' : 'px-3 pt-3 pb-7'} space-y-2`}>
            {documentAttachments.map((doc) => (
              <DocumentAttachment key={doc.id} attachment={doc} isSent={isSent} />
            ))}
          </div>
        )}

        {/* Message Text with inline spacer for timestamp */}
        {hasContent && (
          <div className={`relative ${imageAttachments.length > 0 ? 'px-[16px] pt-2' : ''}`}>
            <p className="text-[15px] leading-[1.5] whitespace-pre-wrap break-words">
              {message.content}
              <span className="inline-block w-[72px]" />
            </p>
          </div>
        )}

        {/* Floating Timestamp & Status */}
        <div
          className={`
            absolute bottom-[6px] right-[12px] flex items-center gap-1
          `}
        >
          <span
            className={`
              text-[10px] font-medium opacity-60
              ${isSent ? "text-white" : "text-gray-500 dark:text-gray-400"}
            `}
          >
            {formatMessageTime(new Date(message.created_at))}
          </span>

          {/* Status indicator for sent messages */}
          {isSent && status && (
            <span className={`transition-colors duration-300 ${
              status === 'read' ? 'text-blue-400' :
              status === 'delivered' ? 'text-white/60' :
              'text-white/30'
            }`}>
              {status === 'sent' && <Check size={12} />}
              {(status === 'delivered' || status === 'read') && <CheckCheck size={12} />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Image Grid Component
interface ImageGridProps {
  images: MessageAttachment[];
  isSent: boolean;
  hasContent: boolean;
}

function ImageGrid({ images, isSent, hasContent }: ImageGridProps) {
  const [lightboxImage, setLightboxImage] = useState<MessageAttachment | null>(null);

  const getGridClass = () => {
    if (images.length === 1) return "grid-cols-1";
    if (images.length === 2) return "grid-cols-2";
    if (images.length === 3) return "grid-cols-2";
    return "grid-cols-2";
  };

  return (
    <>
      <div className={`grid ${getGridClass()} gap-0.5 ${hasContent ? 'mb-1' : ''}`}>
        {images.map((img, index) => (
          <ImageItem
            key={img.id}
            image={img}
            index={index}
            totalImages={images.length}
            isSent={isSent}
            onClick={() => setLightboxImage(img)}
          />
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <Lightbox
            image={lightboxImage}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Individual Image Item with loading state and animations
interface ImageItemProps {
  image: MessageAttachment;
  index: number;
  totalImages: number;
  isSent: boolean;
  onClick: () => void;
}

function ImageItem({ image, index, totalImages, isSent, onClick }: ImageItemProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Staggered delay for multiple images (50ms per image)
  const staggerDelay = index * 50;

  const handleLoad = () => {
    // Small delay to ensure smooth transition
    setTimeout(() => {
      setIsLoading(false);
      setIsLoaded(true);
    }, staggerDelay);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: staggerDelay / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`
        relative overflow-hidden
        ${totalImages === 3 && index === 0 ? 'row-span-2' : ''}
        ${totalImages === 1 ? 'max-h-[300px]' : 'aspect-square'}
        focus:outline-none focus:ring-2 focus:ring-blue-500/50
        group
      `}
    >
      {/* Skeleton loader */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`
              absolute inset-0
              ${isSent ? 'image-skeleton-dark' : 'image-skeleton'}
              flex items-center justify-center
            `}
          >
            {/* Subtle loading indicator */}
            <div className={`
              w-8 h-8 rounded-full
              ${isSent ? 'bg-white/10' : 'bg-gray-200/60'}
              animate-pulse-glow
              flex items-center justify-center
            `}>
              <div className={`
                w-4 h-4 rounded-full
                ${isSent ? 'bg-white/20' : 'bg-gray-300/60'}
              `} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {hasError && (
        <div className={`
          absolute inset-0 flex items-center justify-center
          ${isSent ? 'bg-gray-700/50' : 'bg-gray-100'}
        `}>
          <div className="text-center p-4">
            <X size={24} className={isSent ? 'text-gray-400 mx-auto mb-1' : 'text-gray-400 mx-auto mb-1'} />
            <span className={`text-xs ${isSent ? 'text-gray-400' : 'text-gray-500'}`}>
              Failed to load
            </span>
          </div>
        </div>
      )}

      {/* Actual image */}
      <motion.img
        src={image.file_url}
        alt={image.file_name}
        onLoad={handleLoad}
        onError={handleError}
        initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
        animate={isLoaded ? {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
        } : {
          opacity: 0,
          scale: 1.05,
          filter: 'blur(10px)',
        }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={`
          w-full h-full object-cover
          group-hover:scale-[1.02] transition-transform duration-300
        `}
      />

      {/* Hover overlay */}
      <div className="
        absolute inset-0
        bg-black/0 group-hover:bg-black/10
        transition-colors duration-200
        pointer-events-none
      " />
    </motion.button>
  );
}

// Lightbox Component
interface LightboxProps {
  image: MessageAttachment;
  onClose: () => void;
}

function Lightbox({ image, onClose }: LightboxProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all hover:scale-105 z-10"
      >
        <X size={22} className="text-white" />
      </motion.button>

      {/* Image container with loading state */}
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Loading skeleton */}
        <AnimatePresence>
          {!isImageLoaded && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main image */}
        <motion.img
          initial={{ scale: 0.85, opacity: 0, filter: 'blur(10px)' }}
          animate={isImageLoaded ? {
            scale: 1,
            opacity: 1,
            filter: 'blur(0px)',
          } : {
            scale: 0.85,
            opacity: 0,
            filter: 'blur(10px)',
          }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          src={image.file_url}
          alt={image.file_name}
          onLoad={() => setIsImageLoaded(true)}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Bottom controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.25 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* File name */}
        <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full">
          <span className="text-sm text-white/80 font-medium truncate max-w-[200px] block">
            {image.file_name}
          </span>
        </div>

        {/* Download button */}
        <a
          href={image.file_url}
          download={image.file_name}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-all hover:scale-105"
        >
          <Download size={16} />
          <span className="text-sm font-medium">Download</span>
        </a>
      </motion.div>
    </motion.div>
  );
}

// Document Attachment Component
interface DocumentAttachmentProps {
  attachment: MessageAttachment;
  isSent: boolean;
}

function DocumentAttachment({ attachment, isSent }: DocumentAttachmentProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <a
      href={attachment.file_url}
      download={attachment.file_name}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        flex items-center gap-3 p-2.5 rounded-xl
        group cursor-pointer
        ${isSent
          ? "bg-white/10 hover:bg-white/20"
          : "bg-black/[0.06] hover:bg-black/[0.10] dark:bg-white/10 dark:hover:bg-white/[0.15]"
        }
        transition-colors duration-200
      `}
    >
      <div
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
          ${isSent
            ? "bg-white/20"
            : "bg-black/[0.08] dark:bg-white/15"
          }
        `}
      >
        <FileText size={18} className={isSent ? "text-white/80" : "text-gray-500 dark:text-gray-300"} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`
            text-sm font-medium truncate
            ${isSent ? "text-white" : "text-gray-700 dark:text-gray-100"}
          `}
        >
          {attachment.file_name}
        </p>
        <p
          className={`
            text-xs
            ${isSent ? "text-white/60" : "text-gray-400 dark:text-gray-400"}
          `}
        >
          {formatFileSize(attachment.file_size)}
        </p>
      </div>
      <Download
        size={16}
        className={`flex-shrink-0 transition-all duration-200 group-hover:translate-y-0.5 ${
          isSent
            ? "text-white/50 group-hover:text-white/90"
            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-200"
        }`}
      />
    </a>
  );
}
