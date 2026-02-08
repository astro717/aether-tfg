import { useState, useEffect, useCallback, useRef } from 'react';
import { messagingApi, type Message, type MessageUser } from '../api/messagingApi';
import { useInterval } from './useInterval';
import { type UploadedFile } from '../../../hooks/useFileUpload';

const POLLING_INTERVAL = 3000; // 3 seconds

export interface UseMessagesResult {
  messages: Message[];
  otherUser: MessageUser | null;
  loading: boolean;
  error: Error | null;
  sendMessage: (content: string, currentUserId: string, attachments?: UploadedFile[]) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useMessages(userId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<MessageUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if initial load for this userId has completed
  const hasLoadedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Silent fetch - doesn't trigger loading state, doesn't mark as read
  const silentFetch = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await messagingApi.getMessages(userId);
      setMessages(data.messages);
      setOtherUser(data.user);
      setError(null);
    } catch (err) {
      // Only log, don't break UI on polling failure
      console.error('Error fetching messages:', err);
    }
  }, [userId]);

  // Initial fetch with loading state and mark as read
  const initialFetch = useCallback(async () => {
    if (!userId) {
      setMessages([]);
      setOtherUser(null);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await messagingApi.getMessages(userId);
      setMessages(data.messages);
      setOtherUser(data.user);
      hasLoadedRef.current = true;

      // Mark messages as read only on initial fetch (user opened the conversation)
      await messagingApi.markAsRead(userId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Reset and fetch when userId changes
  useEffect(() => {
    if (userId !== currentUserIdRef.current) {
      hasLoadedRef.current = false;
      currentUserIdRef.current = userId;
      initialFetch();
    }
  }, [userId, initialFetch]);

  // Polling for real-time updates (silent, only when userId is active and loaded)
  useInterval(
    silentFetch,
    userId && hasLoadedRef.current ? POLLING_INTERVAL : null
  );

  const sendMessage = useCallback(async (content: string, currentUserId: string, attachments?: UploadedFile[]) => {
    if (!userId) return;

    // Must have either content or attachments
    const hasContent = content.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;
    if (!hasContent && !hasAttachments) return;

    // Create optimistic message
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: currentUserId,
      receiver_id: userId,
      content: hasContent ? content.trim() : null,
      created_at: new Date().toISOString(),
      read_at: null,
      sender: {
        id: currentUserId,
        username: '',
        email: '',
      },
      attachments: attachments?.map((att, index) => ({
        id: `optimistic-att-${index}`,
        message_id: optimisticId,
        file_path: att.filePath,
        file_url: att.fileUrl,
        file_name: att.fileName,
        file_size: att.fileSize,
        file_type: att.fileType,
        created_at: new Date().toISOString(),
      })),
    };

    // Optimistically add message to the list
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Send to server
      const serverMessage = await messagingApi.sendMessage({
        receiverId: userId,
        content: hasContent ? content.trim() : undefined,
        attachments: attachments?.map(att => ({
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize,
          fileType: att.fileType,
          fileUrl: att.fileUrl,
        })),
      });

      // Replace optimistic message with server response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === optimisticId ? serverMessage : msg
        )
      );
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      throw err;
    }
  }, [userId]);

  return {
    messages,
    otherUser,
    loading,
    error,
    sendMessage,
    refetch: silentFetch, // Use silent refetch for manual calls
  };
}
