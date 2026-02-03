import { Check, CheckCheck } from "lucide-react";
import { formatMessageTime, type Message } from "../data/mockData";

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

  return (
    <div className={`flex ${alignmentClasses}`}>
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
          {message.text}
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
            {formatMessageTime(message.timestamp)}
          </span>

          {/* Status indicator for sent messages */}
          {isSent && message.status && (
            <span className="text-white/70">
              {message.status === 'sent' && <Check size={12} />}
              {message.status === 'delivered' && <CheckCheck size={12} />}
              {message.status === 'read' && <CheckCheck size={12} className="text-white" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
