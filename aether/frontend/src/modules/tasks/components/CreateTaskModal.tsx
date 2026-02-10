import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";
import { useOrganization } from "../../organization/context/OrganizationContext";
import { organizationApi, type OrganizationMember } from "../../organization/api/organizationApi";
import { tasksApi } from "../../dashboard/api/tasksApi";
import { SmartSelect, type SmartSelectOption } from "../../../components/ui/SmartSelect";
import { PremiumDatePicker } from "../../../components/ui/PremiumDatePicker";
import { useToast } from "../../../components/ui/Toast";
import { taskEvents } from "../../../lib/taskEvents";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState("");

  const titleInputRef = useRef<HTMLInputElement>(null);

  const isManager = user?.role === "manager";

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Fetch organization members for managers
  useEffect(() => {
    if (isOpen && isManager && currentOrganization) {
      setMembersLoading(true);
      organizationApi
        .getOrganizationMembers(currentOrganization.id)
        .then((data) => {
          setMembers(data);
        })
        .catch((err) => {
          console.error("Failed to fetch members:", err);
        })
        .finally(() => {
          setMembersLoading(false);
        });
    }
  }, [isOpen, isManager, currentOrganization]);

  // Set default assignee
  useEffect(() => {
    if (isOpen && user) {
      if (!isManager) {
        // Regular users assign to themselves
        setAssigneeId(user.id);
      } else {
        // Reset for managers
        setAssigneeId("");
      }
    }
  }, [isOpen, user, isManager]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setAssigneeId("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!assigneeId) {
      setError("Please select an assignee");
      return;
    }

    if (!currentOrganization) {
      setError("No organization selected");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await tasksApi.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        assignee_id: assigneeId,
        organization_id: currentOrganization.id,
      });

      // Show success toast
      showToast("Task created successfully", "success");

      // Emit event for Kanban refresh
      taskEvents.emitTaskCreated();

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to create task:", err);
      setError("Failed to create task. Please try again.");
      showToast("Failed to create task", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleSubmit();
    }
  };

  // Convert members to SmartSelect options
  const memberOptions: SmartSelectOption[] = members.map((m) => ({
    id: m.id,
    label: m.username,
  }));

  // Disabled value for regular users
  const disabledUserOption: SmartSelectOption | undefined = user
    ? { id: user.id, label: user.username }
    : undefined;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      {/* Modal Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg mx-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl transform transition-all duration-200 ease-out animate-modal-enter"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Task</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl text-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl resize-none text-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
            />
          </div>

          {/* Due Date - Premium DatePicker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Deadline
            </label>
            <PremiumDatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="Select a deadline"
              minDate={new Date()}
            />
          </div>

          {/* Assignee - Smart Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Assignee <span className="text-red-500">*</span>
            </label>
            <SmartSelect
              options={memberOptions}
              value={assigneeId}
              onChange={setAssigneeId}
              placeholder="Select a team member..."
              disabled={!isManager}
              loading={membersLoading}
              disabledValue={disabledUserOption}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-500 px-1">{error}</p>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Press ⌘ + Enter to create
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !assigneeId || isSubmitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </button>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-enter {
          animation: modal-enter 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
