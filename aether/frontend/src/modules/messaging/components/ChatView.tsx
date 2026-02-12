import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageChatInput } from "./MessageChatInput";
import { type Message, type MessageUser } from "../api/messagingApi";
import { type UploadedFile } from "../../../hooks/useFileUpload";
import { getAvatarColorClasses } from "../../../lib/avatarColors";

interface ChatViewProps {
  userId: string | null;
  messages: Message[];
  otherUser: MessageUser | null;
  loading: boolean;
  error: Error | null;
  currentUserId: string;
  onSendMessage: (content: string, attachments?: UploadedFile[]) => Promise<void>;
  isDraft?: boolean;
}

export function ChatView({
  userId,
  messages,
  otherUser,
  loading,
  error,
  currentUserId,
  onSendMessage,
  isDraft = false,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track the first unread message ID for this session (persists after mark-as-read)
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const hasDetectedUnreadRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  // Detect first unread message when messages load (only once per conversation)
  useEffect(() => {
    // Reset detection when switching users
    if (userId !== prevUserIdRef.current) {
      setFirstUnreadId(null);
      hasDetectedUnreadRef.current = false;
      prevUserIdRef.current = userId;
    }

    // Only detect once per conversation session
    if (!hasDetectedUnreadRef.current && messages.length > 0 && !loading) {
      // Find the first message that is unread (received from other user)
      const firstUnread = messages.find(
        msg => msg.sender_id !== currentUserId && msg.read_at === null
      );

      if (firstUnread) {
        setFirstUnreadId(firstUnread.id);
      }
      hasDetectedUnreadRef.current = true;
    }
  }, [messages, loading, userId, currentUserId]);

  // Clear the unread separator when user sends a message (they've responded)
  const clearUnreadSeparator = () => {
    setFirstUnreadId(null);
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Initial scroll to bottom on mount / load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom("auto"); // Instant scroll on load
    }
  }, [loading, userId]); // Only on user switch or done loading

  const prevLastMessageIdRef = useRef<string | null>(null);

  // 2. Smart auto-scroll on new messages
  useEffect(() => {
    // Check if we actually have a *new* message at the end
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // If the last message ID hasn't changed, do NOTHING.
    // This prevents scrolling on polling updates when content is stable.
    if (lastMessage.id === prevLastMessageIdRef.current) {
      return;
    }

    // Update ref for next time
    prevLastMessageIdRef.current = lastMessage.id;

    // Basic check: if we are close to bottom, scroll down.
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150; // 150px threshold

    // Determine if we should auto-scroll
    const isOurMessage = lastMessage.sender_id === currentUserId;

    // Scroll if:
    // 1. We were already at the bottom (reading new incoming messages)
    // 2. We just sent the message (force scroll to see our own message)
    if (isNearBottom || isOurMessage) {
      scrollToBottom("smooth");
    }
  }, [messages, currentUserId]);

  // Handle sending a new message
  const handleSend = async (content: string, attachments?: UploadedFile[]) => {
    // Allow sending if in draft mode (userId comes from draft recipient) or normal mode
    if (!userId && !isDraft) return;

    try {
      await onSendMessage(content, attachments);
      // User has responded - clear the "New Messages" separator
      clearUnreadSeparator();
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err; // Re-throw so MessageChatInput can handle it
    }
  };

  // Empty state - no conversation selected (but allow draft mode with otherUser)
  if (!userId && !isDraft) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <div
            className="
              w-16 h-16 mx-auto mb-4
              rounded-full
              bg-white/40 dark:bg-white/10
              flex items-center justify-center
            "
          >
            <MessageCircle size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">
            No Conversation Selected
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose a conversation to start messaging
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm">Failed to load messages</p>
        </div>
      </div>
    );
  }

  // Group messages for rendering (Date headers -> Unread Separator -> Message Groups)
  const renderItems = getRenderItems(messages, firstUnreadId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {otherUser && <ChatHeader user={otherUser} />}

      {/* Messages Area - Transparent background */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-4 premium-scrollbar cursor-default"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              {isDraft
                ? `Start a new conversation with ${otherUser?.username || 'this user'}`
                : "No messages yet. Start the conversation!"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {renderItems.map((item, index) => {
              if (item.type === 'date') {
                return <DateSeparator key={`date-${item.date}`} date={item.date} />;
              }
              if (item.type === 'unread') {
                return <UnreadSeparator key="unread-separator" />;
              }
              if (item.type === 'group') {
                return (
                  <div key={`group-${index}`} className="space-y-0.5">
                    {item.messages.map((message, msgIndex) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isSent={message.sender_id === currentUserId}
                        isFirstInGroup={msgIndex === 0}
                      />
                    ))}
                  </div>
                );
              }
              return null;
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Pinned to bottom */}
      <MessageChatInput
        onSend={handleSend}
        disabled={!userId && !isDraft}
      />
    </div>
  );
}

interface ChatHeaderProps {
  user: MessageUser;
}

function ChatHeader({ user }: ChatHeaderProps) {
  const initials = user.username
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user.username.slice(0, 2).toUpperCase();

  const colors = getAvatarColorClasses(user.avatar_color);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/20 dark:border-white/10">
      {/* Left: Avatar & Name */}
      <div className="flex items-center gap-3">
        <div
          className={`
            w-10 h-10
            rounded-full
            ${colors.bg}
            ${colors.border}
            flex items-center justify-center
            font-semibold ${colors.text} text-sm
          `}
        >
          {initials}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {user.username}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}

// Unread Messages Separator
function UnreadSeparator() {
  return (
    <div className="flex items-center gap-3 py-3 my-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
      <span className="text-xs font-medium text-red-500 px-2">
        New Messages
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-red-400/50 to-transparent" />
    </div>
  );
}

// Date Separator
function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="bg-gray-200/50 dark:bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 dark:border-white/10">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {date}
        </span>
      </div>
    </div>
  );
}

type RenderItem =
  | { type: 'date'; date: string }
  | { type: 'unread' }
  | { type: 'group'; messages: Message[] };

// Helper: Format date for headers
function getDateLabel(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset hours for comparison
  const dStr = d.toDateString();
  const nowStr = now.toDateString();
  const yesterdayStr = yesterday.toDateString();

  if (dStr === nowStr) return "Today";
  if (dStr === yesterdayStr) return "Yesterday";

  // Format: "Monday, 14/03"
  // const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;

  // Per spec "Monday, 14/3"
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

// Helper: Group messages for rendering
function getRenderItems(messages: Message[], firstUnreadId: string | null): RenderItem[] {
  const items: RenderItem[] = [];
  let currentGroup: Message[] = [];
  let currentSenderId: string | null = null;
  let lastDateLabel: string | null = null;
  let hasAddedUnreadSeparator = false;

  for (const message of messages) {
    // 1. Check for Unread Separator BEFORE processing message
    if (firstUnreadId === message.id && !hasAddedUnreadSeparator) {
      if (currentGroup.length > 0) {
        items.push({ type: 'group', messages: currentGroup });
        currentGroup = [];
        currentSenderId = null;
      }
      items.push({ type: 'unread' });
      hasAddedUnreadSeparator = true;
    }

    // 2. Check for Date Change
    const messageDate = new Date(message.created_at);
    const dateLabel = getDateLabel(messageDate);

    if (dateLabel !== lastDateLabel) {
      if (currentGroup.length > 0) {
        items.push({ type: 'group', messages: currentGroup });
        currentGroup = [];
        currentSenderId = null;
      }
      items.push({ type: 'date', date: dateLabel });
      lastDateLabel = dateLabel;
    }

    // 3. Group by Sender
    if (message.sender_id !== currentSenderId) {
      if (currentGroup.length > 0) {
        items.push({ type: 'group', messages: currentGroup });
      }
      currentGroup = [message];
      currentSenderId = message.sender_id;
    } else {
      currentGroup.push(message);
    }
  }

  // Push remaining group
  if (currentGroup.length > 0) {
    items.push({ type: 'group', messages: currentGroup });
  }

  return items;
}
