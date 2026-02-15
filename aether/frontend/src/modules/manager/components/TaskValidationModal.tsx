import { useEffect } from 'react';
import { X, Check, XCircle, Calendar, Clock, GitBranch, Loader2 } from 'lucide-react';
import { type PendingTask } from '../api/managerApi';
import { UserAvatar } from '../../../components/ui/UserAvatar';

interface TaskValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: PendingTask | null;
  onValidate: (taskId: string) => Promise<void>;
  onReject: (taskId: string) => Promise<void>;
  isLoading?: boolean;
}

export function TaskValidationModal({
  isOpen,
  onClose,
  task,
  onValidate,
  onReject,
  isLoading = false,
}: TaskValidationModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isLoading]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleValidate = async () => {
    if (task && !isLoading) {
      await onValidate(task.id);
    }
  };

  const handleReject = async () => {
    if (task && !isLoading) {
      await onReject(task.id);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={!isLoading ? onClose : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />

      {/* Modal Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl transform transition-all duration-200 ease-out animate-modal-enter"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-gray-200/50 dark:border-zinc-700/50">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                #{task.readable_id}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Pending Validation
              </span>
              {task.repos && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                  {task.repos.name}
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
              Description
            </h3>
            {task.description ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No description provided
              </p>
            )}
          </div>

          {/* Metadata Grid */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assignee */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-zinc-800/50">
                {task.users_tasks_assignee_idTousers ? (
                  <UserAvatar
                    username={task.users_tasks_assignee_idTousers.username}
                    avatarColor={task.users_tasks_assignee_idTousers.avatar_color}
                    size="sm"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Assignee</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {task.users_tasks_assignee_idTousers?.username || 'Unassigned'}
                  </div>
                </div>
              </div>

              {/* Repository */}
              {task.repos && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-zinc-800/50">
                  <GitBranch className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Repository</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {task.repos.name}
                    </div>
                  </div>
                </div>
              )}

              {/* Due Date */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-zinc-800/50">
                <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Due Date</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(task.due_date)}
                  </div>
                </div>
              </div>

              {/* Created At */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-zinc-800/50">
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Created</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(task.created_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200/50 dark:border-zinc-700/50">
          <button
            onClick={handleReject}
            disabled={isLoading}
            className="
              px-5 py-2.5 rounded-xl
              font-medium text-sm
              text-red-600 dark:text-red-400
              bg-red-50 dark:bg-red-900/20
              border border-red-200 dark:border-red-900/50
              hover:bg-red-100 dark:hover:bg-red-900/30
              hover:border-red-300 dark:hover:border-red-800
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Reject Task
              </>
            )}
          </button>
          <button
            onClick={handleValidate}
            disabled={isLoading}
            className="
              px-5 py-2.5 rounded-xl
              font-medium text-sm
              text-white
              bg-gradient-to-r from-emerald-500 to-emerald-600
              hover:from-emerald-600 hover:to-emerald-700
              shadow-md shadow-emerald-500/20
              hover:shadow-lg hover:shadow-emerald-500/30
              transition-all duration-150
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Approve Task
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
