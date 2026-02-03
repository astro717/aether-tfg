import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import {
  getMessagesForThread,
  getOtherParticipant,
  mockThreads,
  CURRENT_USER_ID,
  type Message,
  type User
} from "../data/mockData";

interface ChatViewProps {
  threadId: string | null;
}

export function ChatView({ threadId }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = threadId ? mockThreads.find(t => t.id === threadId) : null;
  const participant = thread ? getOtherParticipant(thread) : null;

  // Load messages when thread changes
  useEffect(() => {
    if (threadId) {
      const threadMessages = getMessagesForThread(threadId);
      setMessages(threadMessages);
    } else {
      setMessages([]);
    }
  }, [threadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a new message
  const handleSend = () => {
    if (!inputValue.trim() || !threadId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      threadId,
      senderId: CURRENT_USER_ID,
      text: inputValue.trim(),
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue("");

    // Simulate message delivery
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === newMessage.id ? { ...msg, status: 'delivered' as const } : msg
        )
      );
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state
  if (!thread || !participant) {
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

  // Group messages by sender
  const groupedMessages = groupMessagesBySender(messages);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <ChatHeader participant={participant} />

      {/* Messages Area - Transparent background */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-0.5">
                {group.map((message, msgIndex) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isSent={message.senderId === CURRENT_USER_ID}
                    isFirstInGroup={msgIndex === 0}
                  />
                ))}
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
            disabled={!inputValue.trim()}
            className={`
              w-11 h-11 rounded-full flex-shrink-0
              flex items-center justify-center
              transition-all duration-200
              ${inputValue.trim()
                ? "bg-gray-800 text-white shadow-md hover:bg-gray-700"
                : "bg-white/40 text-gray-400"
              }
              disabled:cursor-not-allowed
            `}
          >
            <Send size={18} className={inputValue.trim() ? "translate-x-[1px]" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChatHeaderProps {
  participant: User;
}

function ChatHeader({ participant }: ChatHeaderProps) {
  const initials = participant.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
            {participant.name}
          </h3>
          <p className="text-xs text-gray-500 capitalize">
            {participant.status || 'offline'}
          </p>
        </div>
      </div>

    </div>
  );
}

// Helper: Group consecutive messages from the same sender
function groupMessagesBySender(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  let currentGroup: Message[] = [];
  let currentSenderId: string | null = null;

  for (const message of messages) {
    if (message.senderId !== currentSenderId) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [message];
      currentSenderId = message.senderId;
    } else {
      currentGroup.push(message);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}
