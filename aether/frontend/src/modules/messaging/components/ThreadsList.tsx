import { useState } from "react";
import { Search, PenSquare, Loader2 } from "lucide-react";
import { type Conversation, type MessageUser } from "../api/messagingApi";
import { formatTimestamp } from "../data/mockData";
import { getAvatarColorClasses } from "../../../lib/avatarColors";

interface ThreadsListProps {
  conversations: Conversation[];
  loading: boolean;
  error: Error | null;
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onNewMessage: () => void;
}

export function ThreadsList({
  conversations,
  loading,
  error,
  selectedUserId,
  onSelectUser,
  onNewMessage,
}: ThreadsListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;

    const nameMatch = conv.user.username.toLowerCase().includes(searchQuery.toLowerCase());
    const messageMatch = conv.lastMessage.content?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;

    return nameMatch || messageMatch;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
            Messages
          </h2>
          <button
            onClick={onNewMessage}
            className="
              w-8 h-8 rounded-full
              flex items-center justify-center
              text-gray-500 hover:text-gray-700 dark:hover:text-gray-300
              hover:bg-white/60 dark:hover:bg-white/10
              transition-all duration-150
            "
            title="New message"
          >
            <PenSquare size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={15}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="
              w-full h-9 pl-9 pr-4
              bg-white/50 dark:bg-white/10 backdrop-blur-sm
              rounded-full
              text-sm text-gray-800 dark:text-gray-200
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              outline-none
              border border-white/30 dark:border-white/10
              focus:bg-white/70 dark:focus:bg-white/15 focus:border-white/50 dark:focus:border-white/20
              transition-all duration-200
            "
          />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-red-500 text-sm">Failed to load conversations</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-400 text-sm">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.user.id}
                  conversation={conv}
                  isSelected={selectedUserId === conv.user.id}
                  onClick={() => onSelectUser(conv.user.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const { user, lastMessage, unreadCount } = conversation;

  // Format preview text - show comment prefix for comment notifications
  const isCommentNotification = lastMessage.type === 'comment_notification';
  const previewText = isCommentNotification
    ? `Commented on your task: ${lastMessage.content}`
    : lastMessage.content;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-4 rounded-2xl
        text-left
        transition-all duration-150
        ${isSelected
          ? "bg-white/80 dark:bg-white/10 shadow-sm"
          : "hover:bg-white/40 dark:hover:bg-white/5"
        }
      `}
    >
      {/* Avatar */}
      <UserAvatar user={user} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`
              text-sm font-semibold truncate
              ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-800 dark:text-gray-200"}
            `}
          >
            {user.username}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
            {formatTimestamp(new Date(lastMessage.created_at))}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={`
              text-[13px] truncate pr-2
              ${unreadCount > 0 ? "text-gray-700 dark:text-gray-300 font-medium" : "text-gray-500 dark:text-gray-400"}
            `}
          >
            {previewText}
          </p>

          {/* Unread badge - Dark Gray per design spec */}
          {unreadCount > 0 && (
            <span
              className="
                flex-shrink-0
                min-w-[20px] h-5 px-1.5
                bg-gray-700 text-white
                text-[11px] font-bold
                rounded-full
                flex items-center justify-center
              "
            >
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

interface UserAvatarProps {
  user: MessageUser;
}

function UserAvatar({ user }: UserAvatarProps) {
  const initials = user.username
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user.username.slice(0, 2).toUpperCase();

  const colors = getAvatarColorClasses(user.avatar_color);

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`
          w-12 h-12
          rounded-full
          ${colors.bg}
          ${colors.border}
          flex items-center justify-center
          font-semibold ${colors.text} text-sm
        `}
      >
        {initials}
      </div>
    </div>
  );
}
