import { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Calendar, Loader2, Inbox } from 'lucide-react';
import { managerApi, type PendingTask } from '../api/managerApi';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { useToast } from '../../../components/ui/Toast';

interface TaskValidationListProps {
  onTaskValidated?: () => void;
}

export function TaskValidationList({ onTaskValidated }: TaskValidationListProps) {
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const pendingTasks = await managerApi.getPendingValidationTasks(currentOrganization.id);
      setTasks(pendingTasks);
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      showToast('Failed to load pending tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, showToast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleValidate = async (taskId: string) => {
    try {
      setActionLoading(taskId);
      await managerApi.validateTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      showToast('Task approved successfully', 'success');
      onTaskValidated?.();
    } catch (error) {
      console.error('Error validating task:', error);
      showToast(error instanceof Error ? error.message : 'Failed to approve task', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (taskId: string) => {
    try {
      setActionLoading(taskId);
      await managerApi.rejectTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      showToast('Task rejected', 'success');
      onTaskValidated?.();
    } catch (error) {
      console.error('Error rejecting task:', error);
      showToast(error instanceof Error ? error.message : 'Failed to reject task', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium mb-1">All caught up!</p>
        <p className="text-sm text-gray-400">No tasks pending validation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Pending Validation ({tasks.length})
        </h3>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="
              relative overflow-hidden rounded-2xl
              bg-white/60 dark:bg-zinc-900/60
              backdrop-blur-xl
              border border-white/20 dark:border-zinc-700/50
              shadow-lg shadow-black/5 dark:shadow-black/20
              p-5 transition-all duration-200
              hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30
              hover:border-white/30 dark:hover:border-zinc-600/50
            "
          >
            {/* Task Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                    #{task.readable_id}
                  </span>
                  {task.repos && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400">
                      {task.repos.name}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {task.title}
                </h4>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleReject(task.id)}
                  disabled={actionLoading === task.id}
                  className="
                    p-2.5 rounded-xl
                    bg-red-50 dark:bg-red-900/20
                    text-red-600 dark:text-red-400
                    hover:bg-red-100 dark:hover:bg-red-900/30
                    transition-colors duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  title="Reject task"
                >
                  {actionLoading === task.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleValidate(task.id)}
                  disabled={actionLoading === task.id}
                  className="
                    p-2.5 rounded-xl
                    bg-emerald-50 dark:bg-emerald-900/20
                    text-emerald-600 dark:text-emerald-400
                    hover:bg-emerald-100 dark:hover:bg-emerald-900/30
                    transition-colors duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  title="Approve task"
                >
                  {actionLoading === task.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Task Description */}
            {task.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Task Meta */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {/* Assignee */}
              {task.users_tasks_assignee_idTousers && (
                <div className="flex items-center gap-2">
                  <UserAvatar
                    username={task.users_tasks_assignee_idTousers.username}
                    avatarColor={task.users_tasks_assignee_idTousers.avatar_color}
                    size="xs"
                  />
                  <span>{task.users_tasks_assignee_idTousers.username}</span>
                </div>
              )}

              {/* Due Date */}
              {task.due_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(task.due_date)}</span>
                </div>
              )}

              {/* Created */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Created {formatDate(task.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
