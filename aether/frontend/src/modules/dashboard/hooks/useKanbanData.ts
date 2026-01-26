import { useState, useEffect } from 'react';
import { tasksApi } from '../api/tasksApi';
import type { KanbanData } from '../api/tasksApi';

interface UseKanbanDataResult {
  data: KanbanData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useKanbanData(organizationId: string | undefined): UseKanbanDataResult {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const kanbanData = await tasksApi.getKanbanData(organizationId);
      setData(kanbanData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch kanban data'));
      console.error('Error fetching kanban data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
