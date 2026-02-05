import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { organizationApi, type OrganizationMember } from "@/modules/organization/api/organizationApi";

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: OrganizationMember) => void;
  existingConversationUserIds: string[];
  currentUserId: string;
}

export function UserSearchModal({
  isOpen,
  onClose,
  onSelectUser,
  existingConversationUserIds,
  currentUserId,
}: UserSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch organization members on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchMembers = async () => {
      const orgId = localStorage.getItem("currentOrganizationId");
      if (!orgId) {
        setError("No organization selected");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const orgMembers = await organizationApi.getOrganizationMembers(orgId);
        // Filter out the current user
        setMembers(orgMembers.filter(m => m.id !== currentUserId));
      } catch (err) {
        setError("Failed to load members");
        console.error("Error fetching members:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [isOpen, currentUserId]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelectUser = useCallback((user: OrganizationMember) => {
    onSelectUser(user);
    onClose();
  }, [onSelectUser, onClose]);

  // Filter members based on search query
  const filteredMembers = members.filter(member => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.username.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  });

  // Check if a user already has a conversation
  const hasExistingConversation = (userId: string) =>
    existingConversationUserIds.includes(userId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          relative z-10
          w-full max-w-md
          mx-4
          bg-white/70 backdrop-blur-xl
          rounded-2xl
          border border-white/40
          shadow-2xl
          overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/30">
          <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
          <button
            onClick={onClose}
            className="
              w-8 h-8 rounded-full
              flex items-center justify-center
              text-gray-500 hover:text-gray-700
              hover:bg-white/60
              transition-all duration-150
            "
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-5 py-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="To: Search by name or email"
              className="
                w-full h-10 pl-10 pr-4
                bg-white/50 backdrop-blur-sm
                rounded-full
                text-sm text-gray-800
                placeholder:text-gray-400
                outline-none
                border border-white/30
                focus:bg-white/70 focus:border-gray-300
                transition-all duration-200
              "
            />
          </div>
        </div>

        {/* Members List */}
        <div className="px-3 pb-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-gray-400 text-sm">
                {searchQuery ? "No members found" : "No organization members"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMembers.map((member) => (
                <MemberItem
                  key={member.id}
                  member={member}
                  hasExistingConversation={hasExistingConversation(member.id)}
                  onClick={() => handleSelectUser(member)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MemberItemProps {
  member: OrganizationMember;
  hasExistingConversation: boolean;
  onClick: () => void;
}

function MemberItem({ member, hasExistingConversation, onClick }: MemberItemProps) {
  const initials = member.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || member.username.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="
        w-full flex items-center gap-3 p-3 rounded-xl
        text-left
        hover:bg-white/60
        transition-all duration-150
      "
    >
      {/* Avatar */}
      <div
        className="
          w-10 h-10 flex-shrink-0
          rounded-full
          bg-gradient-to-br from-gray-200 to-gray-300
          flex items-center justify-center
          font-semibold text-gray-600 text-sm
        "
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 truncate">
            {member.username}
          </span>
          {hasExistingConversation && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              (existing)
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{member.email}</p>
      </div>
    </button>
  );
}
