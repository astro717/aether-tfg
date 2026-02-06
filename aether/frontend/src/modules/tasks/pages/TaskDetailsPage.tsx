import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    Plus,
    Bot,
    Loader2,
    AlertCircle,
    ArrowLeft,
    Copy,
    CheckCheck
} from "lucide-react";
import { tasksApi, type Task, type TaskComment, type CommitDiff } from "../../dashboard/api/tasksApi";
import { useAuth } from "../../auth/context/AuthContext";
import { CommentModal } from "../components/CommentModal";
import { CommitCodeViewer } from "../components/CommitCodeViewer";
import { AICommitExplanationCard } from "../components/AICommitExplanationCard";
import { AICodeAnalysisCard } from "../components/AICodeAnalysisCard";
import { AITaskReportCard } from "../components/AITaskReportCard";

export function TaskDetailsPage() {
    const { user } = useAuth();
    const { taskId } = useParams<{ taskId: string }>();
    const [task, setTask] = useState<Task | null>(null);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [commitDiff, setCommitDiff] = useState<CommitDiff | null>(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyTaskId = () => {
        if (task) {
            navigator.clipboard.writeText(`#${task.readable_id}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

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

    // Fetch commit diff when task has linked commits
    useEffect(() => {
        async function fetchCommitDiff() {
            if (!task?.task_commits?.length) {
                setCommitDiff(null);
                return;
            }

            // Get the most recent commit (last in array or first by date)
            const latestCommit = task.task_commits[task.task_commits.length - 1];
            if (!latestCommit?.commit_sha) return;

            try {
                setDiffLoading(true);
                const diff = await tasksApi.getCommitDiff(latestCommit.commit_sha);
                setCommitDiff(diff);
            } catch (err) {
                console.error("Failed to fetch commit diff:", err);
                setCommitDiff(null);
            } finally {
                setDiffLoading(false);
            }
        }

        fetchCommitDiff();
    }, [task?.task_commits]);

    const handleAddComment = async (content: string) => {
        if (!taskId) return;
        const newComment = await tasksApi.addComment(taskId, content);
        setComments((prev) => [...prev, newComment]);
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
        <div className="h-full overflow-y-auto p-8 pb-12">
            <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8 h-full items-stretch">
                {/* LEFT COLUMN (Main Content) */}
                <div className="col-span-8 flex flex-col gap-8 h-full">
                    {/* Header */}
                    <div>
                        <Link to="/dashboard" className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back
                        </Link>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl font-semibold text-gray-900">
                                {task.title}
                            </h1>
                            {/* Task ID Badge - Liquid Glass / Pill Style */}
                            <div className="relative group">
                                <button
                                    onClick={handleCopyTaskId}
                                    className="flex items-center gap-1.5 font-mono text-xs text-slate-500 bg-white/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/60 hover:bg-white/70 hover:border-gray-200/50 transition-all cursor-pointer"
                                >
                                    <span>#{task.readable_id}</span>
                                    {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />}
                                </button>
                                {/* Tooltip */}
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {copied ? "Copied!" : "Copy Task ID"}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${task.status === 'done' ? 'bg-green-100 text-green-700' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                {task.status.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Description - Ghost style */}
                    <div>
                        <h3 className="text-gray-500 font-medium mb-3">Description</h3>
                        <div className="bg-white/30 rounded-xl p-6 text-gray-600 leading-relaxed border border-gray-200 min-h-[100px]">
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
                            <h3 className="text-gray-500 font-medium mb-3">
                                Linked commits
                                <span className="text-gray-400 text-sm ml-2">
                                    (use #{task.readable_id} in commit messages)
                                </span>
                            </h3>
                            <div className="bg-white/30 rounded-xl p-4 space-y-3 max-h-[300px] overflow-y-auto border border-gray-200">
                                {task.task_commits && task.task_commits.length > 0 ? (
                                    task.task_commits.map((tc) => (
                                        <CommitItem
                                            key={tc.commit_sha}
                                            hash={tc.commits.sha.substring(0, 7)}
                                            date={new Date(tc.commits.committed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            message={tc.commits.message || 'No message'}
                                            author={tc.commits.author_login || 'Unknown'}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center text-gray-400 text-sm py-4">
                                        No commits linked yet. Use <code className="bg-gray-200 px-1 rounded">#{task.readable_id}</code> in your commit messages to link them.
                                    </div>
                                )}
                                {/* Mock data - kept for reference
                                <CommitItem
                                    hash="a1b2c3d"
                                    date="Jan 15"
                                    message="Fix authentication bug in login flow"
                                />
                                <CommitItem
                                    hash="e4f5g6h"
                                    date="Jan 14"
                                    message="Add validation for user input fields"
                                />
                                <CommitItem
                                    hash="i7j8k9l"
                                    date="Jan 13"
                                    message="Initial task implementation"
                                />
                                */}
                            </div>
                        </div>
                    </div>

                    {/* Last Commit (Diff View) - Premium Code Viewer */}
                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-gray-500 font-medium">Last commit</h3>
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
                    <div className="h-[562px] bg-white/30 rounded-xl p-4 flex flex-col overflow-hidden border border-gray-200">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="text-gray-500 font-medium text-sm">Comments</h3>
                            <button
                                onClick={() => setIsCommentModalOpen(true)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {comments.length > 0 ? (
                                comments.map((comment) => (
                                    <CommentCard
                                        key={comment.id}
                                        author={comment.users.username}
                                        role={comment.users.username.charAt(0).toUpperCase()}
                                        content={comment.content}
                                        createdAt={comment.created_at}
                                        isMe={user?.id === comment.user_id}
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

                    {/* AI Actions (Grows to fill space) */}
                    <div className="flex-1 flex flex-col gap-4 min-h-[200px]">
                        {/* Card 1: AI Commit Explanation - Premium Component */}
                        <AICommitExplanationCard
                            commitSha={task.task_commits?.[task.task_commits.length - 1]?.commit_sha || null}
                            className="flex-1"
                        />

                        {/* Row with 2 cards: Expands */}
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <AICodeAnalysisCard className="h-full" />
                            <AITaskReportCard className="h-full" />
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
            <span className="text-[#A1A1AA] w-32 font-medium">{label}</span>
            <span className="text-[#A1A1AA] hidden sm:inline mr-4">|</span>
            <span className="text-gray-600 font-medium">{value}</span>
        </div>
    );
}

function CommitItem({ hash, date, message, author }: { hash: string; date: string; message: string; author?: string }) {
    return (
        <div className="bg-white rounded-[16px] p-3 flex items-center gap-3">
            <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
                {hash}
            </code>
            <span className="text-xs text-gray-400">{date}</span>
            {author && <span className="text-xs text-gray-500 font-medium">{author}</span>}
            <span className="text-sm text-gray-700 truncate flex-1">{message}</span>
        </div>
    );
}

function CommentCard({
    author,
    role,
    content,
    createdAt,
    isMe = false,
}: {
    author: string;
    role: string;
    content: string;
    createdAt?: string;
    isMe?: boolean;
}) {
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

    return (
        <div className="bg-[#FCFCFD] rounded-[24px] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center text-[10px] text-white font-bold">
                        {role}
                    </div>
                    <span className="font-bold text-sm text-gray-900">
                        {author} {isMe && <span className="text-gray-400 font-normal ml-1">(You)</span>}
                    </span>
                </div>
                {createdAt && (
                    <span className="text-[10px] text-gray-400">{formatTime(createdAt)}</span>
                )}
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                {content}
            </p>
        </div>
    );
}

function AICard({ title, className = "" }: { title: string; className?: string }) {
    return (
        <div className={`bg-white/30 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer border border-gray-200 hover:bg-white/50 hover:border-gray-300 transition-all min-h-[120px] ${className}`}>
            <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">
                <Bot size={18} className="text-gray-600" />
            </div>
            <h4 className="text-gray-700 font-medium text-sm leading-tight">
                {title}
            </h4>
        </div>
    );
}
