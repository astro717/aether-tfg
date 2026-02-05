import { useRef, useEffect, useState } from "react";
import { Check, CheckCheck, ClipboardList } from "lucide-react";
import { type Message, type CommentNotificationMetadata } from "../api/messagingApi";
import { formatMessageTime } from "../data/mockData";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  isFirstInGroup?: boolean;
}

export function MessageBubble({
  message,
  isSent,
  isFirstInGroup = false
}: MessageBubbleProps) {
  // Track if this is a fresh mount (new message) to apply animation only once
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // After first render, mark as animated to prevent re-animation on refetch
    if (!hasAnimated.current) {
      hasAnimated.current = true;
    } else {
      setShouldAnimate(false);
    }
  }, []);

  const isCommentNotification = message.type === 'comment_notification';
  const metadata = message.metadata as CommentNotificationMetadata | null;

  // Aether-native styling as per spec:
  // Me (Sent): Dark Gray / Charcoal (bg-gray-800), rounded-2xl rounded-tr-sm
  // Others (Received): Glass White (bg-white/60), rounded-2xl rounded-tl-sm
  const bubbleClasses = isSent
    ? "bg-gray-800 text-white"
    : "bg-white/60 text-gray-800";

  const alignmentClasses = isSent ? "justify-end" : "justify-start";

  // Rounded corners - sharper on the side where the tail would be
  const radiusClasses = isSent
    ? isFirstInGroup
      ? "rounded-2xl rounded-tr-sm"
      : "rounded-2xl"
    : isFirstInGroup
      ? "rounded-2xl rounded-tl-sm"
      : "rounded-2xl";

  // Determine message status from read_at
  const getStatus = (): 'sent' | 'delivered' | 'read' => {
    if (message.read_at) return 'read';
    // For optimistic messages (id starts with 'optimistic-'), show as sent
    if (message.id.startsWith('optimistic-')) return 'sent';
    return 'delivered';
  };

  const status = isSent ? getStatus() : null;

  // Comment Notification Card - Premium "Context Card" design
  if (isCommentNotification && metadata) {
    const cardClasses = isSent
      ? "bg-gray-800/90 text-white border border-gray-700/50"
      : "bg-gray-100/80 text-gray-800 border border-gray-200/50";

    const headerClasses = isSent
      ? "text-white/60"
      : "text-gray-500";

    const accentClasses = isSent
      ? "bg-blue-400"
      : "bg-blue-500";

    return (
      <div className={`flex ${alignmentClasses} ${shouldAnimate ? 'animate-message-in' : ''}`}>
        <div
          className={`
            relative max-w-[70%] min-w-[200px]
            ${cardClasses}
            rounded-xl
            shadow-sm
            overflow-hidden
          `}
        >
          {/* Vertical accent pill on the left */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentClasses}`} />

          <div className="flex flex-col gap-1 p-3 pl-4">
            {/* Header - Task context */}
            <div className={`flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold ${headerClasses}`}>
              <ClipboardList size={12} />
              <span className="truncate">{metadata.taskTitle}</span>
            </div>

            {/* Comment content */}
            <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>

            {/* Timestamp & Status */}
            <div
              className={`
                flex items-center gap-1.5 mt-1
                ${isSent ? "justify-end" : "justify-start"}
              `}
            >
              <span
                className={`
                  text-[10px] font-medium
                  ${isSent ? "text-white/50" : "text-gray-400"}
                `}
              >
                {formatMessageTime(new Date(message.created_at))}
              </span>

              {isSent && status && (
                <span className="text-white/50">
                  {status === 'sent' && <Check size={10} />}
                  {status === 'delivered' && <CheckCheck size={10} />}
                  {status === 'read' && <CheckCheck size={10} className="text-white/70" />}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular text message
  return (
    <div className={`flex ${alignmentClasses} ${shouldAnimate ? 'animate-message-in' : ''}`}>
      <div
        className={`
          relative max-w-[70%] px-4 py-2.5
          ${bubbleClasses}
          ${radiusClasses}
          shadow-sm
        `}
      >
        {/* Message Text */}
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Timestamp & Status */}
        <div
          className={`
            flex items-center gap-1.5 mt-1
            ${isSent ? "justify-end" : "justify-start"}
          `}
        >
          <span
            className={`
              text-[11px] font-medium
              ${isSent ? "text-white/70" : "text-gray-400"}
            `}
          >
            {formatMessageTime(new Date(message.created_at))}
          </span>

          {/* Status indicator for sent messages */}
          {isSent && status && (
            <span className="text-white/70">
              {status === 'sent' && <Check size={12} />}
              {status === 'delivered' && <CheckCheck size={12} />}
              {status === 'read' && <CheckCheck size={12} className="text-white" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
