import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '../api/tasksApi';
import type { KanbanData } from '../api/tasksApi';

interface UseKanbanDataResult {
  data: KanbanData | null;
  loading: boolean;
  error: Error | null;
  refetch: (silent?: boolean) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<KanbanData | null>>;
}

export function useKanbanData(organizationId: string | undefined): UseKanbanDataResult {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError(null);
      const kanbanData = await tasksApi.getKanbanData(organizationId);
      setData(kanbanData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch kanban data'));
      console.error('Error fetching kanban data:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  };
}
