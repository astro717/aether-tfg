import { useState, useCallback, useMemo } from "react";
import { ThreadsList } from "./ThreadsList";
import { ChatView } from "./ChatView";
import { UserSearchModal } from "./UserSearchModal";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { messagingApi, type MessageUser } from "../api/messagingApi";
import type { OrganizationMember } from "@/modules/organization/api/organizationApi";
import { type UploadedFile } from "../../../hooks/useFileUpload";

// Draft recipient state for new conversations
interface DraftRecipient {
  id: string;
  username: string;
  email: string;
}

export function MessagingLayout() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const [draftRecipient, setDraftRecipient] = useState<DraftRecipient | null>(null);

  // Fetch conversations
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations
  } = useConversations();

  // Fetch messages for selected user (only if not in draft mode)
  const activeUserId = draftRecipient ? null : selectedUserId;
  const {
    messages,
    otherUser,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
  } = useMessages(activeUserId);

  // Get list of user IDs that already have conversations
  const existingConversationUserIds = useMemo(
    () => conversations.map(c => c.user.id),
    [conversations]
  );

  // Handle selecting a conversation from the list
  const handleSelectUser = useCallback((userId: string) => {
    setDraftRecipient(null); // Clear draft state when selecting existing conversation
    setSelectedUserId(userId);
  }, []);

  // Handle opening the new message modal
  const handleOpenNewMessage = useCallback(() => {
    setIsNewMessageModalOpen(true);
  }, []);

  // Handle selecting a user from the modal
  const handleSelectNewUser = useCallback((member: OrganizationMember) => {
    // Check if conversation already exists
    const existingConv = conversations.find(c => c.user.id === member.id);

    if (existingConv) {
      // Select the existing conversation
      setSelectedUserId(member.id);
      setDraftRecipient(null);
    } else {
      // Create draft state for new conversation
      setDraftRecipient({
        id: member.id,
        username: member.username,
        email: member.email,
      });
      setSelectedUserId(null);
    }
  }, [conversations]);

  // Handle sending a message (both for existing and draft conversations)
  const handleSendMessage = useCallback(async (content: string, attachments?: UploadedFile[]) => {
    if (!user?.id) return;

    if (draftRecipient) {
      // Sending first message to a new recipient
      await messagingApi.sendMessage({
        receiverId: draftRecipient.id,
        content: content.trim() || undefined,
        attachments: attachments?.map(att => ({
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize,
          fileType: att.fileType,
          fileUrl: att.fileUrl,
        })),
      });

      // Clear draft and select the new conversation
      const recipientId = draftRecipient.id;
      setDraftRecipient(null);
      setSelectedUserId(recipientId);

      // Refetch conversations to show the new one
      refetchConversations();
    } else {
      // Sending to existing conversation
      await sendMessage(content, user.id, attachments);
      refetchConversations();
    }
  }, [user?.id, draftRecipient, sendMessage, refetchConversations]);

  // Determine the displayed user and messages based on draft state
  const displayedUser: MessageUser | null = draftRecipient || otherUser;
  const displayedMessages = draftRecipient ? [] : messages;
  const displayedUserId = draftRecipient?.id || selectedUserId;

  // Auto-select first conversation when conversations load
  // and no conversation is selected and not in draft mode
  if (!selectedUserId && !draftRecipient && conversations.length > 0 && !conversationsLoading) {
    setSelectedUserId(conversations[0].user.id);
  }

  return (
    <>
      {/* Main Layout */}
      <div className="h-full w-full p-6 flex gap-6">
        {/* Threads Panel (Left) - w-80 shrink-0 */}
        <div
          className="
            w-80 shrink-0
            bg-white/50 dark:bg-white/5 backdrop-blur-xl
            rounded-[32px]
            border border-white/40 dark:border-white/10
            shadow-xl
            overflow-hidden
          "
        >
          <ThreadsList
            conversations={conversations}
            loading={conversationsLoading}
            error={conversationsError}
            selectedUserId={draftRecipient ? null : selectedUserId}
            onSelectUser={handleSelectUser}
            onNewMessage={handleOpenNewMessage}
          />
        </div>

        {/* Chat Panel (Right) - flex-1 */}
        <div
          className="
            flex-1
            bg-white/50 dark:bg-white/5 backdrop-blur-xl
            rounded-[32px]
            border border-white/40 dark:border-white/10
            shadow-xl
            overflow-hidden
          "
        >
          <ChatView
            userId={displayedUserId}
            messages={displayedMessages}
            otherUser={displayedUser}
            loading={draftRecipient ? false : messagesLoading}
            error={draftRecipient ? null : messagesError}
            currentUserId={user?.id || ''}
            onSendMessage={handleSendMessage}
            isDraft={!!draftRecipient}
          />
        </div>
      </div>

      {/* New Message Modal */}
      <UserSearchModal
        isOpen={isNewMessageModalOpen}
        onClose={() => setIsNewMessageModalOpen(false)}
        onSelectUser={handleSelectNewUser}
        existingConversationUserIds={existingConversationUserIds}
        currentUserId={user?.id || ''}
      />
    </>
  );
}
