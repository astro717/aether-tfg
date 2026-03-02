import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasksApi';
import type { KanbanData, Task } from '../api/tasksApi';

// Task columns (excludes 'totals')
type TaskColumn = 'pending_validation' | 'todo' | 'pending' | 'in_progress' | 'done';

// Unique cache key factory
export const kanbanKeys = {
  all: (orgId: string) => ['kanban', orgId] as const,
};

export function useKanbanData(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  // 1. Fetching (replaces the old useEffect + useState pattern)
  const { data, isLoading, error, refetch } = useQuery<KanbanData, Error>({
    queryKey: organizationId ? kanbanKeys.all(organizationId) : ['kanban', 'none'],
    queryFn: () => tasksApi.getKanbanData(organizationId!),
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5, // 5 minutes of freshness
  });

  // 2. Optimistic Mutation (the heart of zero-latency UI)
  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: Task['status']; insertIndex?: number }) =>
      tasksApi.updateTask(taskId, { status: newStatus }),

    // onMutate fires BEFORE the network request is sent
    onMutate: async ({ taskId, newStatus, insertIndex }) => {
      if (!organizationId) return;
      const queryKey = kanbanKeys.all(organizationId);

      // Cancel outgoing requests to avoid collisions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state (for rollback)
      const previousData = queryClient.getQueryData<KanbanData>(queryKey);

      // Mutate cache synchronously (pure zero-latency)
      if (previousData) {
        // Find source column and isolate task
        const columns: TaskColumn[] = ['todo', 'pending', 'in_progress', 'done', 'pending_validation'];
        let sourceCol: TaskColumn | undefined;
        let pTask: Task | undefined;

        for (const col of columns) {
          const found = previousData[col].find((t) => t.id === taskId);
          if (found) {
            sourceCol = col;
            pTask = found;
            break;
          }
        }

        if (sourceCol && pTask && sourceCol !== newStatus) {
          queryClient.setQueryData<KanbanData>(queryKey, (old) => {
            if (!old) return old;

            const targetCol = newStatus as TaskColumn;

            // Remove from source
            const newSourceArray = old[sourceCol].filter((t) => t.id !== taskId);

            // Add to target with updated status at the correct position
            const movedTask = { ...pTask!, status: newStatus };
            const newTargetArray = [...old[targetCol]];
            if (insertIndex !== undefined && insertIndex >= 0) {
              // Insert at the drop position
              newTargetArray.splice(insertIndex, 0, movedTask);
            } else {
              // Append to end (dropped on empty column area)
              newTargetArray.push(movedTask);
            }

            return {
              ...old,
              [sourceCol]: newSourceArray,
              [targetCol]: newTargetArray,
              totals: {
                ...old.totals,
                [sourceCol]: old.totals[sourceCol] - 1,
                [targetCol]: old.totals[targetCol] + 1,
              },
            };
          });
        }
      }

      // Return snapshot for rollback
      return { previousData, queryKey };
    },

    // onError: Automatic rollback using snapshot
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
        console.error('Optimistic UI Rollback executed due to API failure:', err);
      }
    },

    // onSettled: Silent background refetch to guarantee server truth
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });

  return {
    data: data || null,
    loading: isLoading,
    error,
    refetch,
    updateTaskStatus,
  };
}
