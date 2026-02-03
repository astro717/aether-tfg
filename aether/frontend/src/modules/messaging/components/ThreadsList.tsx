import { useState } from "react";
import { Search, PenSquare } from "lucide-react";
import {
  mockThreads,
  getOtherParticipant,
  formatTimestamp,
  type Thread,
  type User
} from "../data/mockData";

interface ThreadsListProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
}

export function ThreadsList({
  selectedThreadId,
  onSelectThread
}: ThreadsListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = mockThreads.filter(thread => {
    if (!searchQuery.trim()) return true;

    const participant = getOtherParticipant(thread);
    const nameMatch = participant?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const messageMatch = thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

    return nameMatch || messageMatch;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
            Messages
          </h2>
          <button
            className="
              w-8 h-8 rounded-full
              flex items-center justify-center
              text-gray-500 hover:text-gray-700
              hover:bg-white/60
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
              bg-white/50 backdrop-blur-sm
              rounded-full
              text-sm text-gray-800
              placeholder:text-gray-400
              outline-none
              border border-white/30
              focus:bg-white/70 focus:border-white/50
              transition-all duration-200
            "
          />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {filteredThreads.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-gray-400 text-sm">No conversations found</p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onClick={() => onSelectThread(thread.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ThreadItemProps {
  thread: Thread;
  isSelected: boolean;
  onClick: () => void;
}

function ThreadItem({ thread, isSelected, onClick }: ThreadItemProps) {
  const participant = getOtherParticipant(thread);

  if (!participant) return null;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-4 rounded-2xl
        text-left
        transition-all duration-150
        ${isSelected
          ? "bg-white/80 shadow-sm"
          : "hover:bg-white/40"
        }
      `}
    >
      {/* Avatar */}
      <ThreadAvatar user={participant} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`
              text-sm font-semibold truncate
              ${isSelected ? "text-gray-900" : "text-gray-800"}
            `}
          >
            {participant.name}
          </span>
          <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
            {formatTimestamp(thread.lastMessageTime)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={`
              text-[13px] truncate pr-2
              ${thread.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"}
            `}
          >
            {thread.lastMessage}
          </p>

          {/* Unread badge - Dark Gray per design spec */}
          {thread.unreadCount > 0 && (
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
              {thread.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

interface ThreadAvatarProps {
  user: User;
}

function ThreadAvatar({ user }: ThreadAvatarProps) {
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const statusColors = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    offline: "bg-gray-400"
  };

  return (
    <div className="relative flex-shrink-0">
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div
          className="
            w-12 h-12
            rounded-full
            bg-gradient-to-br from-gray-200 to-gray-300
            flex items-center justify-center
            font-semibold text-gray-600 text-sm
          "
        >
          {initials}
        </div>
      )}

      {/* Online status indicator */}
      {user.status && user.status !== 'offline' && (
        <div
          className={`
            absolute bottom-0 right-0
            w-3 h-3
            ${statusColors[user.status]}
            rounded-full
            border-2 border-white
          `}
        />
      )}
    </div>
  );
}
