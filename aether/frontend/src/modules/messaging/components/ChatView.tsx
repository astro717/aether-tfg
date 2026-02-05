import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { type Message, type MessageUser } from "../api/messagingApi";

interface ChatViewProps {
  userId: string | null;
  messages: Message[];
  otherUser: MessageUser | null;
  loading: boolean;
  error: Error | null;
  currentUserId: string;
  onSendMessage: (content: string) => Promise<void>;
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
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a new message
  const handleSend = async () => {
    // Allow sending if in draft mode (userId comes from draft recipient) or normal mode
    if (!inputValue.trim() || (!userId && !isDraft) || sending) return;

    const content = inputValue.trim();
    setInputValue("");
    setSending(true);

    // Immediately refocus the input to maintain flawless flow
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    try {
      await onSendMessage(content);
      // User has responded - clear the "New Messages" separator
      clearUnreadSeparator();
    } catch (err) {
      // Restore input on error
      setInputValue(content);
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
      // Ensure focus is maintained after the send completes
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
              bg-white/40
              flex items-center justify-center
            "
          >
            <MessageCircle size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">
            No Conversation Selected
          </h3>
          <p className="text-sm text-gray-500">
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

  // Group messages by sender, tracking which group contains the first unread
  const { groupedMessages, firstUnreadGroupIndex } = groupMessagesBySenderWithUnread(
    messages,
    firstUnreadId
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {otherUser && <ChatHeader user={otherUser} />}

      {/* Messages Area - Transparent background */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
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
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Unread Messages Separator */}
                {groupIndex === firstUnreadGroupIndex && (
                  <UnreadSeparator />
                )}
                <div className="space-y-0.5">
                  {group.map((message, msgIndex) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isSent={message.sender_id === currentUserId}
                      isFirstInGroup={msgIndex === 0}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Pinned to bottom */}
      <div className="px-5 py-4 border-t border-white/20">
        <div className="flex items-end gap-3">
          {/* Input field - pill shaped */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message"
              rows={1}
              className="
                w-full px-4 py-2.5
                bg-white/50 backdrop-blur-sm
                rounded-full
                text-[15px] text-gray-800
                placeholder:text-gray-400
                outline-none
                border border-white/30
                focus:bg-white/70 focus:border-white/50
                resize-none
                transition-all duration-200
              "
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {/* Send Button - Dark Gray circle with white arrow */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            className={`
              w-11 h-11 rounded-full flex-shrink-0
              flex items-center justify-center
              transition-all duration-200
              ${inputValue.trim() && !sending
                ? "bg-gray-800 text-white shadow-md hover:bg-gray-700"
                : "bg-white/40 text-gray-400"
              }
              disabled:cursor-not-allowed
            `}
          >
            {sending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} className={inputValue.trim() ? "translate-x-[1px]" : ""} />
            )}
          </button>
        </div>
      </div>
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

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/20">
      {/* Left: Avatar & Name */}
      <div className="flex items-center gap-3">
        <div
          className="
            w-10 h-10
            rounded-full
            bg-gradient-to-br from-gray-200 to-gray-300
            flex items-center justify-center
            font-semibold text-gray-600 text-sm
          "
        >
          {initials}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {user.username}
          </h3>
          <p className="text-xs text-gray-500">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}

// Unread Messages Separator - Subtle red divider per Aether spec
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

// Helper: Group consecutive messages from the same sender, tracking first unread group
function groupMessagesBySenderWithUnread(
  messages: Message[],
  firstUnreadId: string | null
): { groupedMessages: Message[][]; firstUnreadGroupIndex: number | null } {
  const groups: Message[][] = [];
  let currentGroup: Message[] = [];
  let currentSenderId: string | null = null;
  let firstUnreadGroupIndex: number | null = null;

  for (const message of messages) {
    if (message.sender_id !== currentSenderId) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [message];
      currentSenderId = message.sender_id;

      // Check if this new group starts with the first unread message
      if (firstUnreadId && message.id === firstUnreadId && firstUnreadGroupIndex === null) {
        firstUnreadGroupIndex = groups.length; // The group we're about to add
      }
    } else {
      currentGroup.push(message);

      // Check if this message is the first unread (in case it's not the first of a group)
      if (firstUnreadId && message.id === firstUnreadId && firstUnreadGroupIndex === null) {
        // The unread starts mid-group, so mark the current group
        firstUnreadGroupIndex = groups.length;
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return { groupedMessages: groups, firstUnreadGroupIndex };
}
