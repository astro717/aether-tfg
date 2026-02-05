import { useState, useEffect, useCallback, useRef } from 'react';
import { messagingApi, type Conversation } from '../api/messagingApi';
import { useInterval } from './useInterval';

const POLLING_INTERVAL = 4000; // 4 seconds

export interface UseConversationsResult {
  conversations: Conversation[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if initial load has completed
  const hasLoadedRef = useRef(false);

  // Silent fetch - doesn't trigger loading state
  const silentFetch = useCallback(async () => {
    try {
      const data = await messagingApi.getConversations();
      setConversations(data);
      setError(null);
    } catch (err) {
      // Only set error if we had data before (don't break the UI on polling failure)
      if (!hasLoadedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch conversations'));
      }
      console.error('Error fetching conversations:', err);
    }
  }, []);

  // Initial fetch with loading state
  const initialFetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await messagingApi.getConversations();
      setConversations(data);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch conversations'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    initialFetch();
  }, [initialFetch]);

  // Polling for real-time updates (silent)
  useInterval(silentFetch, hasLoadedRef.current ? POLLING_INTERVAL : null);

  return {
    conversations,
    loading,
    error,
    refetch: silentFetch, // Use silent refetch for manual calls
  };
}
