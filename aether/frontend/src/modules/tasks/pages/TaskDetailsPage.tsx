import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    Plus,
    Bot,
    Loader2,
    AlertCircle,
    ArrowLeft
} from "lucide-react";
import { tasksApi, type Task, type TaskComment } from "../../dashboard/api/tasksApi";
import { useAuth } from "../../auth/context/AuthContext";
import { CommentModal } from "../components/CommentModal";

export function TaskDetailsPage() {
    const { user } = useAuth();
    const { taskId } = useParams<{ taskId: string }>();
    const [task, setTask] = useState<Task | null>(null);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

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
        <div className="h-full overflow-y-auto p-8">
            <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8 h-full">
                {/* LEFT COLUMN (Main Content) */}
                <div className="col-span-8 flex flex-col gap-8 h-full">
                    {/* Header */}
                    <div>
                        <Link to="/dashboard" className="inline-flex items-center text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back
                        </Link>
                        <h1 className="text-4xl font-semibold text-gray-900 mb-2">
                            {task.title}
                        </h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${task.status === 'done' ? 'bg-green-100 text-green-700' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                {task.status.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="text-gray-500 font-medium mb-3">Description</h3>
                        <div className="bg-[#EAEBED] rounded-[24px] p-6 text-gray-600 leading-relaxed shadow-sm min-h-[100px]">
                            {task.description || "No description provided for this task."}
                        </div>
                    </div>

                    {/* Stats & Commit List (2 Columns) */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* Left: Stats */}
                        <div className="col-span-5 space-y-4 py-2">
                            <StatRow label="Commit number" value="12" />
                            <StatRow label="Duration" value="1 week" />
                            <StatRow label="Due date" value={formatDate(task.due_date)} />
                            <StatRow label="Time left" value={calculateTimeLeft(task.due_date)} />
                        </div>

                        {/* Right: Commit List */}
                        <div className="col-span-7">
                            <h3 className="text-gray-500 font-medium mb-3">Commit list</h3>
                            <div className="bg-[#EAEBED] rounded-[24px] p-4 space-y-3">
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
                            </div>
                        </div>
                    </div>

                    {/* Last Commit (Diff View) */}
                    <div className="flex-1 flex flex-col min-h-[200px]">
                        <h3 className="text-gray-500 font-medium mb-3">Last commit</h3>
                        <div className="bg-[#1e1e1e] rounded-[24px] p-6 font-mono text-sm overflow-auto flex-1">
                            <div className="text-gray-400 mb-4">
                                <span className="text-gray-500">// src/auth/login.ts</span>
                            </div>
                            <div className="space-y-1">
                                <div className="text-red-400 bg-red-950/30 px-2 py-0.5 rounded">
                                    {"- const token = generateToken(user);"}
                                </div>
                                <div className="text-red-400 bg-red-950/30 px-2 py-0.5 rounded">
                                    {"- return { token };"}
                                </div>
                                <div className="text-green-400 bg-green-950/30 px-2 py-0.5 rounded">
                                    {"+ const token = generateSecureToken(user, options);"}
                                </div>
                                <div className="text-green-400 bg-green-950/30 px-2 py-0.5 rounded">
                                    {"+ const refreshToken = generateRefreshToken(user);"}
                                </div>
                                <div className="text-green-400 bg-green-950/30 px-2 py-0.5 rounded">
                                    {"+ return { token, refreshToken, expiresIn: 3600 };"}
                                </div>
                            </div>
                        </div>
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

                    {/* Comments (Fixed height) */}
                    <div className="h-[562px] bg-[#EAEBED] rounded-[24px] p-4 flex flex-col overflow-hidden">
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
                        {/* Card 1: Expands */}
                        <AICard title="Generate commit explanation" className="flex-1" />

                        {/* Row with 2 cards: Expands */}
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <AICard title="Analyze code and vulnerabilities" className="h-full" />
                            <AICard title="Generate task report" className="h-full" />
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

function CommitItem({ hash, date, message }: { hash: string; date: string; message: string }) {
    return (
        <div className="bg-white rounded-[16px] p-3 flex items-center gap-3">
            <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
                {hash}
            </code>
            <span className="text-xs text-gray-400">{date}</span>
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
        <div className={`bg-[#F4F4F5] rounded-[24px] p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-white hover:shadow-sm transition-all min-h-[120px] ${className}`}>
            <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center">
                <Bot size={18} className="text-gray-600" />
            </div>
            <h4 className="text-gray-700 font-medium text-sm leading-tight">
                {title}
            </h4>
        </div>
    );
}
