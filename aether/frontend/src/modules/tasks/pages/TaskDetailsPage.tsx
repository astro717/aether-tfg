import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
    Plus,
    Loader2,
    AlertCircle,
    ArrowLeft,
    Copy,
    CheckCheck,
    RefreshCw,
    Clock,
    GitCommit,
    Archive,
    Pin,
    FileText,
    Download,
    X as XIcon,
    Trash2,
} from "lucide-react";
import { tasksApi, type Task, type TaskComment, type CommitDiff, type TaskCommentAttachment } from "../../dashboard/api/tasksApi";
import { type UploadedFile } from "../../../hooks/useFileUpload";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { useAuth } from "../../auth/context/AuthContext";
import { useOrganization } from "../../organization/context/OrganizationContext";
import { formatTimeAgo } from "../../../lib/utils";
import { CommentModal } from "../components/CommentModal";
import { LinkCommitModal } from "../components/LinkCommitModal";
import { CommitSelectionModal } from "../components/CommitSelectionModal";
import { CommitCodeViewer } from "../components/CommitCodeViewer";
import { AICommitExplanationCard } from "../components/AICommitExplanationCard";
import { AICodeAnalysisCard } from "../components/AICodeAnalysisCard";
import { AITaskReportCard } from "../components/AITaskReportCard";
import { ConfirmationDialog } from "../../../components/ui/ConfirmationDialog";

export function TaskDetailsPage() {
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();
    const navigate = useNavigate();
    const { taskId } = useParams<{ taskId: string }>();
    const [task, setTask] = useState<Task | null>(null);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [commitDiff, setCommitDiff] = useState<CommitDiff | null>(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [isLinkCommitModalOpen, setIsLinkCommitModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isRefreshingCommits, setIsRefreshingCommits] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    const [pinningCommentId, setPinningCommentId] = useState<string | null>(null);

    // Commit selection state
    const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
    const [isCommitSelectionModalOpen, setIsCommitSelectionModalOpen] = useState(false);
    const [pendingCommitSha, setPendingCommitSha] = useState<string | null>(null);

    const refreshCommits = async () => {
        if (!taskId) return;
        setIsRefreshingCommits(true);
        try {
            const taskData = await tasksApi.getTask(taskId);
            setTask(taskData);
        } catch (err) {
            console.error("Failed to refresh task:", err);
        } finally {
            setIsRefreshingCommits(false);
        }
    };

    const handleCopyTaskId = () => {
        if (task) {
            navigator.clipboard.writeText(task.readable_id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleArchiveTask = () => {
        setShowArchiveDialog(true);
    };

    const executeArchive = async () => {
        if (!task || !taskId) return;

        setIsArchiving(true);
        setShowArchiveDialog(false);
        try {
            await tasksApi.archiveTask(taskId);
            // Navigate back to dashboard after successful archive
            navigate('/dashboard');
        } catch (err) {
            console.error('Failed to archive task:', err);
            alert('Failed to archive task. Please try again.');
        } finally {
            setIsArchiving(false);
        }
    };

    // CRITICAL: Reset ALL state when taskId changes to prevent stale data
    // This must also reset 'task' to null to prevent the initialize effect from using stale data
    useEffect(() => {
        setSelectedCommitSha(null);
        setCommitDiff(null);
        setPendingCommitSha(null);
        setTask(null);
        setComments([]);
        setError(null);
    }, [taskId]);

    useEffect(() => {
        async function fetchTaskAndComments() {
            if (!taskId) return;
            try {
                setLoading(true);
                const [taskData, commentsData] = await Promise.all([
                    tasksApi.getTask(taskId),
                    tasksApi.getComments(taskId),
                ]);
                setTask(taskData);
                setComments(commentsData);
            } catch (err) {
                console.error("Failed to fetch task:", err);
                setError("Task not found or failed to load");
            } finally {
                setLoading(false);
            }
        }

        fetchTaskAndComments();
    }, [taskId]);

    // Initialize selectedCommitSha when task data loads
    // This effect validates that the selected commit belongs to the current task
    useEffect(() => {
        if (!task) return; // Wait for task to load

        const linkedShas = task.task_commits?.map(tc => tc.commit_sha) || [];

        // Case 1: Task has no commits - ensure selection is cleared
        if (linkedShas.length === 0) {
            if (selectedCommitSha !== null) {
                setSelectedCommitSha(null);
                setCommitDiff(null);
            }
            return;
        }

        // Case 2: Valid selection exists for THIS task - keep it
        if (selectedCommitSha && linkedShas.includes(selectedCommitSha)) {
            return;
        }

        // Case 3: No selection or stale selection - select latest commit from THIS task
        const latestCommit = task.task_commits![task.task_commits!.length - 1];
        setSelectedCommitSha(latestCommit.commit_sha);
    }, [task, selectedCommitSha]);

    // Fetch commit diff based on selected commit
    useEffect(() => {
        async function fetchCommitDiff() {
            if (!selectedCommitSha) {
                setCommitDiff(null);
                return;
            }

            try {
                setDiffLoading(true);
                const diff = await tasksApi.getCommitDiff(selectedCommitSha);
                setCommitDiff(diff);
            } catch (err) {
                console.error("Failed to fetch commit diff:", err);
                setCommitDiff(null);
            } finally {
                setDiffLoading(false);
            }
        }

        fetchCommitDiff();
    }, [selectedCommitSha]);

    const handleAddComment = async (content: string, attachments?: UploadedFile[]) => {
        if (!taskId || !currentOrganization) return;
        const mappedAttachments = attachments?.map((a) => ({
            file_path: a.filePath,
            file_url: a.fileUrl,
            file_name: a.fileName,
            file_size: a.fileSize,
            file_type: a.fileType,
        }));
        const newComment = await tasksApi.addComment(taskId, content, currentOrganization.id, mappedAttachments);
        setComments((prev) => [...prev, newComment]);
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await tasksApi.deleteComment(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
    };

    const handleTogglePin = async (commentId: string) => {
        if (!taskId) return;
        setPinningCommentId(commentId);
        try {
            const updatedComment = await tasksApi.toggleCommentPin(taskId, commentId);
            setComments((prev) =>
                prev.map((c) => (c.id === commentId ? updatedComment : c))
            );
        } catch (err) {
            console.error('Failed to toggle pin:', err);
        } finally {
            setPinningCommentId(null);
        }
    };

    const handleLinkSuccess = async () => {
        // Refetch task data to show the newly linked commit
        if (!taskId) return;
        try {
            const updatedTask = await tasksApi.getTask(taskId);
            setTask(updatedTask);
        } catch (err) {
            console.error("Failed to refresh task:", err);
        }
    };

    const handleCommitClick = (commitSha: string) => {
        if (commitSha === selectedCommitSha) return; // Already selected
        setPendingCommitSha(commitSha);
        setIsCommitSelectionModalOpen(true);
    };

    const handleConfirmCommitSwitch = () => {
        if (pendingCommitSha) {
            setSelectedCommitSha(pendingCommitSha);
            setPendingCommitSha(null);
        }
        setIsCommitSelectionModalOpen(false);
    };

    const handleCancelCommitSwitch = () => {
        setPendingCommitSha(null);
        setIsCommitSelectionModalOpen(false);
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-gray-500 font-medium">{error || "Task not found"}</p>
                <Link to="/dashboard" className="text-blue-500 hover:underline">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    // Helper for formatting dates
    const formatDate = (dateString: string | null) => {
        if (!dateString) return "No date";
        return new Date(dateString).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
        });
    };

    // Format deadline for header (e.g., "13 October 12AM")
    const formatDeadline = (dateString: string | null) => {
        if (!dateString) return "No deadline";
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleDateString("en-US", { month: "long" });
        const hours = date.getHours();
        const ampm = hours >= 12 ? "PM" : "AM";
        const hour12 = hours % 12 || 12;
        return `${day} ${month} ${hour12}${ampm}`;
    };

    // Apple-like priority colors
    const APPLE_COLORS = {
        green: '#28C840',   // Safe
        yellow: '#FEBC2E',  // Warning
        red: '#FF3B30',     // Urgent
        gray: '#A1A1AA',    // No date
    };

    // Get urgency color for deadline
    const getDeadlineColor = (dateString: string | null) => {
        if (!dateString) return APPLE_COLORS.gray;
        const now = new Date();
        const due = new Date(dateString);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return APPLE_COLORS.red; // Overdue
        if (diffDays <= 3) return APPLE_COLORS.red; // < 3 days
        if (diffDays <= 7) return APPLE_COLORS.yellow; // < 7 days
        return APPLE_COLORS.green; // Safe
    };

    const calculateTimeLeft = (dateString: string | null) => {
        if (!dateString) return "No deadline";
        const now = new Date();
        const due = new Date(dateString);
        const diffMs = due.getTime() - now.getTime();

        if (diffMs < 0) return "Overdue";

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days} days ${hours} hours`;
        return `${hours} hours`;
    };

    return (
        <div className="h-full overflow-y-auto p-4 pb-32">
            <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-4 h-full items-stretch">
                {/* LEFT COLUMN (Main Content) */}
                <div className="col-span-8 flex flex-col gap-8 h-full">
                    {/* Header */}
                    <div>
                        <Link to="/dashboard" className="inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-4 transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back
                        </Link>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl font-semibold text-gray-900 dark:text-white">
                                {task.title}
                            </h1>
                            {/* Task ID Badge - Liquid Glass / Pill Style */}
                            <div className="relative group">
                                <button
                                    onClick={handleCopyTaskId}
                                    className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/60 dark:border-white/20 hover:bg-white/70 dark:hover:bg-white/20 hover:border-gray-200/50 transition-all cursor-pointer"
                                >
                                    <span>{task.readable_id}</span>
                                    {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />}
                                </button>
                                {/* Tooltip */}
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {copied ? "Copied!" : "Copy Task ID"}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${task.status === 'done' ? 'bg-green-100 text-green-700' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                {task.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {/* Archive Button - only show for done tasks and assignee/manager */}
                            {task.status === 'done' && (user?.id === task.assignee_id || user?.role === 'manager' || user?.role === 'admin') && (
                                <button
                                    onClick={handleArchiveTask}
                                    disabled={isArchiving}
                                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-600 hover:text-orange-600 bg-white/50 hover:bg-orange-50 dark:bg-white/10 dark:hover:bg-orange-500/10 rounded-full border border-gray-200 dark:border-white/20 hover:border-orange-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Archive this task"
                                >
                                    {isArchiving ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Archiving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Archive size={14} />
                                            <span>Archive</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Description - Ghost style */}
                    <div>
                        <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-3">Description</h3>
                        <div className="bg-white/30 dark:bg-white/5 rounded-xl p-6 text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-200 dark:border-white/10 min-h-[100px]">
                            {task.description || "No description provided for this task."}
                        </div>
                    </div>

                    {/* Stats & Commit List (2 Columns) */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* Left: Stats */}
                        <div className="col-span-5 space-y-4 py-2">
                            <StatRow label="Linked commits" value={String(task.task_commits?.length || 0)} />
                            <StatRow label="Duration" value="1 week" />
                            <StatRow label="Due date" value={formatDate(task.due_date)} />
                            <StatRow label="Time left" value={calculateTimeLeft(task.due_date)} />
                        </div>

                        {/* Right: Commit List */}
                        <div className="col-span-7">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-gray-500 dark:text-gray-400 font-medium">
                                    Linked commits
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={refreshCommits}
                                        disabled={isRefreshingCommits}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-50"
                                        title="Refresh commits"
                                    >
                                        <RefreshCw size={16} className={isRefreshingCommits ? "animate-spin" : ""} />
                                    </button>
                                    <button
                                        onClick={() => setIsLinkCommitModalOpen(true)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"
                                        title="Link commit manually"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="bg-white/30 dark:bg-white/5 rounded-xl p-4 space-y-3 max-h-[195px] overflow-y-auto border border-gray-200 dark:border-white/10 premium-scrollbar">
                                {task.task_commits && task.task_commits.length > 0 ? (
                                    [...task.task_commits]
                                        .sort((a, b) => new Date(b.commits.committed_at).getTime() - new Date(a.commits.committed_at).getTime())
                                        .map((tc) => (
                                            <CommitItem
                                                key={tc.commit_sha}
                                                hash={tc.commits.sha.substring(0, 7)}
                                                date={new Date(tc.commits.committed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                message={tc.commits.message || 'No message'}
                                                author={tc.commits.author_login || 'Unknown'}
                                                isSelected={tc.commit_sha === selectedCommitSha}
                                                onClick={() => handleCommitClick(tc.commit_sha)}
                                            />
                                        ))
                                ) : (
                                    <div className="text-center text-gray-400 text-sm py-4">
                                        No commits linked yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Last Commit (Diff View) - Premium Code Viewer */}
                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {selectedCommitSha ? (
                                    <>
                                        <h3 className="text-gray-500 dark:text-gray-400 font-medium">Viewing snapshot:</h3>
                                        <code className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/30">
                                            {selectedCommitSha.substring(0, 7)}
                                        </code>
                                        {(() => {
                                            const selectedCommit = task?.task_commits?.find(
                                                tc => tc.commit_sha === selectedCommitSha
                                            );
                                            if (selectedCommit) {
                                                const timeAgo = formatTimeAgo(selectedCommit.commits.committed_at);
                                                return (
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {timeAgo}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </>
                                ) : (
                                    <h3 className="text-gray-500 dark:text-gray-400 font-medium">Last commit</h3>
                                )}
                            </div>
                            {commitDiff && (
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-green-500 font-mono">+{commitDiff.stats.additions}</span>
                                    <span className="text-red-500 font-mono">-{commitDiff.stats.deletions}</span>
                                    <span className="text-gray-400">{commitDiff.files.length} files</span>
                                </div>
                            )}
                        </div>
                        {diffLoading ? (
                            <div className="bg-slate-900 rounded-xl flex-1 flex items-center justify-center border border-slate-700/50">
                                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                            </div>
                        ) : (
                            <CommitCodeViewer
                                files={commitDiff?.files || []}
                                className="flex-1 min-h-[300px]"
                            />
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN (Sidebar) */}
                <div className="col-span-4 flex flex-col h-full gap-4">
                    {/* Deadline (New Location) */}
                    <div className="flex justify-end">
                        <span className="text-sm font-medium" style={{ color: getDeadlineColor(task.due_date) }}>
                            Due date {formatDeadline(task.due_date)}
                        </span>
                    </div>

                    {/* Comments - Ghost style */}
                    <div className="h-[562px] bg-white/30 dark:bg-white/5 rounded-xl p-4 flex flex-col overflow-hidden border border-gray-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="text-gray-500 dark:text-gray-400 font-medium text-sm">Comments</h3>
                            <button
                                onClick={() => setIsCommentModalOpen(true)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 px-1 -mx-1">
                            {comments.length > 0 ? (
                                comments.map((comment) => (
                                    <CommentCard
                                        key={comment.id}
                                        author={comment.users.username}
                                        avatarColor={comment.users.avatar_color}
                                        content={comment.content}
                                        createdAt={comment.created_at}
                                        isMe={user?.id === comment.user_id}
                                        isPinned={comment.is_pinned}
                                        onTogglePin={() => handleTogglePin(comment.id)}
                                        isPinning={pinningCommentId === comment.id}
                                        attachments={comment.attachments}
                                        onDelete={user?.id === comment.user_id ? () => handleDeleteComment(comment.id) : undefined}
                                    />
                                ))
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic h-full">
                                    No comments yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comment Modal */}
                    <CommentModal
                        isOpen={isCommentModalOpen}
                        onClose={() => setIsCommentModalOpen(false)}
                        onSubmit={handleAddComment}
                    />

                    {/* Link Commit Modal */}
                    <LinkCommitModal
                        isOpen={isLinkCommitModalOpen}
                        onClose={() => setIsLinkCommitModalOpen(false)}
                        taskId={task.id}
                        repoId={task.repo_id}
                        linkedCommitShas={task.task_commits?.map((tc) => tc.commit_sha) || []}
                        onLinkSuccess={handleLinkSuccess}
                    />

                    {/* Commit Selection Modal */}
                    <CommitSelectionModal
                        isOpen={isCommitSelectionModalOpen}
                        onClose={handleCancelCommitSwitch}
                        onConfirm={handleConfirmCommitSwitch}
                        commitHash={pendingCommitSha}
                        commitMessage={
                            task?.task_commits?.find(tc => tc.commit_sha === pendingCommitSha)?.commits.message || undefined
                        }
                    />

                    {/* Archive Confirmation Dialog */}
                    <ConfirmationDialog
                        isOpen={showArchiveDialog}
                        onClose={() => setShowArchiveDialog(false)}
                        onConfirm={executeArchive}
                        title="Archive Task"
                        message={`Archive task "${task.title}"? It will be hidden from the board but preserved in the database.`}
                        confirmLabel="Archive"
                        variant="warning"
                        isLoading={isArchiving}
                    />

                    {/* AI Actions (Grows to fill space) */}
                    <div className="flex-1 flex flex-col gap-4 min-h-[200px]">
                        {/* Card 1: AI Commit Explanation - Premium Component */}
                        <AICommitExplanationCard
                            taskId={task.id}
                            commitSha={selectedCommitSha}
                            className="flex-1"
                        />

                        {/* Row with 2 cards: Expands */}
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <AICodeAnalysisCard
                                taskId={task.id}
                                commitSha={selectedCommitSha}
                                className="h-full"
                            />
                            <AITaskReportCard
                                taskId={task.id}
                                commitSha={selectedCommitSha}
                                className="h-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-components

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline mb-3 last:mb-0">
            <span className="text-[#A1A1AA] dark:text-gray-500 w-32 font-medium">{label}</span>
            <span className="text-[#A1A1AA] dark:text-gray-600 hidden sm:inline mr-4">|</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">{value}</span>
        </div>
    );
}

function CommitItem({
    hash,
    date,
    message,
    author,
    isSelected = false,
    onClick
}: {
    hash: string;
    date: string;
    message: string;
    author?: string;
    isSelected?: boolean;
    onClick?: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={`rounded-[16px] p-3 flex items-center gap-3 transition-all ${isSelected
                ? 'bg-blue-50 dark:bg-blue-500/20 border-2 border-blue-200 dark:border-blue-500/30'
                : 'bg-white dark:bg-white/5 border-2 border-transparent hover:bg-gray-50 dark:hover:bg-white/10'
                } ${onClick ? 'cursor-pointer' : ''}`}
        >
            <code className={`text-xs px-2 py-1 rounded font-mono ${isSelected ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20' : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/10'
                }`}>
                {hash}
            </code>
            <span className="text-xs text-gray-400 dark:text-gray-500">{date}</span>
            {author && <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{author}</span>}
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{message}</span>
            {isSelected && (
                <GitCommit size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
            )}
        </div>
    );
}

function CommentCard({
    author,
    avatarColor,
    content,
    createdAt,
    isMe = false,
    isPinned = false,
    onTogglePin,
    isPinning = false,
    attachments = [],
    onDelete,
}: {
    author: string;
    avatarColor?: string;
    content: string | null;
    createdAt?: string;
    isMe?: boolean;
    isPinned?: boolean;
    onTogglePin?: () => void;
    isPinning?: boolean;
    attachments?: TaskCommentAttachment[];
    onDelete?: () => void;
}) {
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const formatTime = (dateString?: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const imageAttachments = attachments.filter((a) => a.file_type.startsWith("image/"));
    const documentAttachments = attachments.filter((a) => !a.file_type.startsWith("image/"));

    return (
        <>
        <div className={`group/card relative bg-[#FCFCFD] dark:bg-white/5 rounded-[24px] p-5 shadow-sm transition-all ${
            isPinned ? 'ring-2 ring-[#C15F3C]/40 dark:ring-[#C15F3C]/30 bg-[#C15F3C]/5 dark:bg-[#C15F3C]/5' : ''
        }`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <UserAvatar
                        username={author}
                        avatarColor={avatarColor}
                        size="xs"
                        className="w-5 h-5 text-[10px]"
                    />
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {author} {isMe && <span className="text-gray-400 font-normal ml-1">(You)</span>}
                    </span>
                    {/* Small decorative pin — always visible when pinned */}
                    {isPinned && (
                        <Pin size={12} className="fill-current" style={{ color: '#C15F3C' }} />
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Pin button — hover-only always, regardless of pinned state */}
                    {onTogglePin && (
                        <button
                            onClick={onTogglePin}
                            disabled={isPinning}
                            className={`p-1.5 rounded-full transition-all duration-150 opacity-0 group-hover/card:opacity-100 disabled:opacity-50 ${
                                isPinned
                                    ? 'bg-[#C15F3C]/10 dark:bg-[#C15F3C]/20 hover:bg-[#C15F3C]/20'
                                    : 'hover:bg-[#C15F3C]/10 dark:hover:bg-[#C15F3C]/20'
                            }`}
                            style={{ color: isPinned ? '#C15F3C' : undefined }}
                            title={isPinned ? 'Unpin from AI context' : 'Pin for AI context'}
                        >
                            {isPinning ? (
                                <Loader2 size={14} className="animate-spin" style={{ color: '#C15F3C' }} />
                            ) : (
                                <Pin size={14} className={isPinned ? 'fill-current' : 'text-gray-400'} style={isPinned ? { color: '#C15F3C' } : undefined} />
                            )}
                        </button>
                    )}

                    {/* Delete — hover-only, inline confirmation */}
                    {onDelete && !confirmingDelete && (
                        <button
                            onClick={() => setConfirmingDelete(true)}
                            className="p-1.5 rounded-full opacity-0 group-hover/card:opacity-100 transition-all duration-150 text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete comment"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    {onDelete && confirmingDelete && (
                        <div className="flex items-center gap-1 animate-in fade-in duration-150">
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 mr-0.5">Delete?</span>
                            <button
                                onClick={() => { onDelete(); setConfirmingDelete(false); }}
                                className="px-2 py-0.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setConfirmingDelete(false)}
                                className="px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded-xl transition-colors"
                            >
                                No
                            </button>
                        </div>
                    )}

                    {createdAt && !confirmingDelete && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{formatTime(createdAt)}</span>
                    )}
                </div>
            </div>

            {content && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium mb-3">
                    {content}
                </p>
            )}

            {/* Image grid */}
            {imageAttachments.length > 0 && (
                <div className={`grid gap-2 mb-3 ${
                    imageAttachments.length === 1 ? "grid-cols-1" :
                    imageAttachments.length === 2 ? "grid-cols-2" : "grid-cols-3"
                }`}>
                    {imageAttachments.slice(0, 6).map((att, index) => (
                        <button
                            key={att.id}
                            onClick={() => setLightboxImage(att.file_url)}
                            className="relative aspect-square overflow-hidden rounded-xl group/img"
                        >
                            <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover transition-transform group-hover/img:scale-105" loading="lazy" />
                            {index === 5 && imageAttachments.length > 6 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">+{imageAttachments.length - 6}</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Document attachments */}
            {documentAttachments.length > 0 && (
                <div className="space-y-2">
                    {documentAttachments.map((att) => (
                        <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group/doc"
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText size={16} className="text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{att.file_name}</p>
                                <p className="text-[10px] text-gray-400">{formatFileSize(att.file_size)}</p>
                            </div>
                            <Download size={14} className="text-gray-400 group-hover/doc:text-gray-600 dark:group-hover/doc:text-gray-300 transition-colors" />
                        </a>
                    ))}
                </div>
            )}
        </div>

        {/* Lightbox */}
        {lightboxImage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
                <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <XIcon size={24} className="text-white" />
                </button>
                <img src={lightboxImage} alt="Full size" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
            </div>
        )}
        </>
    );
}

