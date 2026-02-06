import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Search, Sidebar as SidebarIcon, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { tasksApi, type Task } from "../../modules/dashboard/api/tasksApi";
import { messagingApi, type Conversation } from "../../modules/messaging/api/messagingApi";
import { CreateTaskModal } from "../../modules/tasks/components/CreateTaskModal";

interface DashboardLayoutProps {
    children: ReactNode;
}

const MESSAGES_POLLING_INTERVAL = 4000; // 4 seconds

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user } = useAuth();
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Sidebar collapse state
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Messages state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(true);
    const hasLoadedMessagesRef = useRef(false);

    // Create task modal state
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

    const fetchMyTasks = useCallback(async (silent = false) => {
        if (!user) {
            setTasksLoading(false);
            return;
        }

        try {
            if (!silent) setTasksLoading(true);
            const tasks = await tasksApi.getMyTasks();
            // Filter to show only pending and in_progress tasks (not done)
            const activeTasks = tasks.filter(t => t.status !== 'done');
            setMyTasks(activeTasks);
        } catch (err) {
            console.error('Error fetching my tasks:', err);
        } finally {
            if (!silent) setTasksLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMyTasks();
    }, [fetchMyTasks]);

    // Fetch conversations (initial + polling)
    const fetchConversations = useCallback(async (silent = false) => {
        if (!user) {
            setMessagesLoading(false);
            return;
        }

        try {
            if (!silent) setMessagesLoading(true);
            const data = await messagingApi.getConversations();
            setConversations(data);
            hasLoadedMessagesRef.current = true;
        } catch (err) {
            console.error('Error fetching conversations:', err);
        } finally {
            if (!silent) setMessagesLoading(false);
        }
    }, [user]);

    // Initial fetch
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Polling for real-time updates
    useEffect(() => {
        if (!hasLoadedMessagesRef.current) return;

        const interval = setInterval(() => {
            fetchConversations(true); // Silent fetch
        }, MESSAGES_POLLING_INTERVAL);

        return () => clearInterval(interval);
    }, [fetchConversations]);

    const userInitials = user?.username
        ? user.username.substring(0, 1).toUpperCase()
        : 'U';

    const userName = user?.username || 'User';

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    return (
        <div className="flex h-screen w-full bg-[#E8E9EC] font-sans text-[#18181B]">
            {/* Sidebar */}
            <aside
                className={`
                    ${isCollapsed ? 'w-[72px]' : 'w-[280px]'}
                    h-full flex flex-col bg-[#FCFCFD] border-r border-gray-100 flex-shrink-0
                    transition-all duration-300 ease-in-out
                `}
            >
                {/* Header / Logo */}
                <div className={`py-6 flex items-center ${isCollapsed ? 'px-4 justify-center' : 'px-6 justify-between'}`}>
                    {!isCollapsed && (
                        <Link to="/dashboard" className="cursor-pointer hover:opacity-80 transition-opacity block">
                            <h1 className="text-xl font-semibold tracking-tight">aether.</h1>
                        </Link>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <SidebarIcon size={18} />
                    </button>
                </div>

                {/* Search - Hidden when collapsed */}
                {!isCollapsed && (
                    <div className="px-6 mb-6">
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                size={15}
                            />
                            <input
                                type="text"
                                placeholder="Search"
                                className="
                                    w-full h-9 pl-9 pr-4
                                    bg-gray-100 hover:bg-gray-200/60
                                    rounded-full
                                    text-sm text-gray-900
                                    placeholder:text-gray-500
                                    outline-none
                                    border-none
                                    focus:bg-white focus:ring-2 focus:ring-gray-200
                                    transition-all duration-200
                                "
                            />
                        </div>
                    </div>
                )}

                {/* User Profile */}
                <div className={`mb-8 flex items-center ${isCollapsed ? 'px-4 justify-center' : 'px-6 gap-3'}`}>
                    <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-gray-500 font-medium text-sm flex-shrink-0">
                        {userInitials}
                    </div>
                    {!isCollapsed && (
                        <span className="font-medium text-gray-700 text-sm truncate">{userName}</span>
                    )}
                </div>

                {/* Scrollable Tasks + Messages */}
                <div className={`flex-1 overflow-y-auto space-y-6 min-h-0 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                    {/* Tasks Section */}
                    <div>
                        <div className={`flex items-center mb-3 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
                            {!isCollapsed && (
                                <h3 className="text-gray-500 font-medium text-xs uppercase tracking-wide">Tasks</h3>
                            )}
                            <button
                                onClick={() => setIsCreateTaskModalOpen(true)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                title="Create new task"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-0.5">
                            {tasksLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            ) : myTasks.length === 0 ? (
                                !isCollapsed && <p className="text-gray-400 text-sm py-2 px-3">No tasks assigned</p>
                            ) : (
                                myTasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        taskId={task.id}
                                        label={task.title}
                                        active={selectedTaskId === task.id}
                                        hasDot
                                        dotColor={getPriorityDotColor(task.due_date)}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        isCollapsed={isCollapsed}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Messages Section */}
                    <div>
                        <div className={`flex items-center mb-3 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
                            {!isCollapsed && (
                                <Link to="/messages" className="text-gray-500 font-medium text-xs uppercase tracking-wide hover:text-gray-700 transition-colors">
                                    Messages
                                </Link>
                            )}
                            <Link to="/messages" className="text-gray-400 hover:text-gray-600">
                                <Plus size={16} />
                            </Link>
                        </div>
                        <div className="space-y-1">
                            {messagesLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            ) : conversations.length === 0 ? (
                                !isCollapsed && <p className="text-gray-400 text-sm py-2 px-3">No messages yet</p>
                            ) : (
                                conversations.slice(0, 5).map((conv) => {
                                    const isComment = conv.lastMessage.type === 'comment_notification';
                                    const preview = isComment
                                        ? 'Commented on your task'
                                        : conv.lastMessage.content;
                                    return (
                                        <Link key={conv.user.id} to={`/messages?user=${conv.user.id}`}>
                                            <MessageItem
                                                name={conv.user.username}
                                                preview={preview}
                                                unreadCount={conv.unreadCount}
                                                active={false}
                                                isCollapsed={isCollapsed}
                                            />
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden flex flex-col relative h-full">
                {children}
            </main>

            {/* Create Task Modal */}
            <CreateTaskModal
                isOpen={isCreateTaskModalOpen}
                onClose={() => setIsCreateTaskModalOpen(false)}
                onSuccess={() => fetchMyTasks(true)}
            />
        </div>
    );
}

// Apple-like priority colors
const APPLE_COLORS = {
    green: '#28C840',   // Safe
    yellow: '#FEBC2E',  // Warning
    red: '#FF3B30',     // Urgent
};

function getPriorityDotColor(dueDate: string | null): string {
    if (!dueDate) return APPLE_COLORS.green;

    const now = new Date();
    const deadline = new Date(dueDate);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return APPLE_COLORS.red; // Overdue
    if (diffDays <= 3) return APPLE_COLORS.red; // High priority
    if (diffDays <= 7) return APPLE_COLORS.yellow; // Medium priority
    return APPLE_COLORS.green; // Low priority
}

function TaskItem({
    taskId,
    label,
    active = false,
    hasDot = false,
    dotColor = "",
    onClick,
    isCollapsed = false,
}: {
    taskId: string;
    label: string;
    active?: boolean;
    hasDot?: boolean;
    dotColor?: string;
    onClick?: () => void;
    isCollapsed?: boolean;
}) {
    // Collapsed: show only centered dot
    if (isCollapsed) {
        return (
            <Link
                to={`/tasks/${taskId}`}
                onClick={onClick}
                className={`
                    w-full flex items-center justify-center py-3 rounded-xl transition-all
                    ${active ? "bg-[#E6E8EB] shadow-sm" : "hover:bg-gray-50"}
                `}
                title={label}
            >
                {hasDot && (
                    <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: dotColor }}
                    />
                )}
            </Link>
        );
    }

    // Expanded: show full item with aligned dot
    return (
        <Link
            to={`/tasks/${taskId}`}
            onClick={onClick}
            className={`
                w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${active ? "bg-[#E6E8EB] text-gray-900 shadow-sm" : "text-gray-600 hover:bg-gray-50"}
            `}
        >
            <span className="truncate flex-1 pr-3">{label}</span>
            {hasDot && (
                <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mr-0.5"
                    style={{ backgroundColor: dotColor }}
                />
            )}
        </Link>
    );
}

function MessageItem({
    name,
    preview,
    active = false,
    unreadCount = 0,
    isCollapsed = false,
}: {
    name: string;
    preview: string;
    active?: boolean;
    unreadCount?: number;
    isCollapsed?: boolean;
}) {
    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || name.slice(0, 2).toUpperCase();

    // Collapsed: show only centered avatar with optional unread indicator
    if (isCollapsed) {
        return (
            <div
                className={`
                    relative flex items-center justify-center py-2 rounded-xl cursor-pointer transition-colors
                    ${active ? "bg-gray-100" : "hover:bg-gray-50"}
                `}
                title={`${name}: ${preview}`}
            >
                <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {initials}
                    </div>
                    {/* Unread indicator badge */}
                    {unreadCount > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-[#FCFCFD]" />
                    )}
                </div>
            </div>
        );
    }

    // Expanded: show full item with aligned dot
    return (
        <div
            className={`
                group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors
                ${active ? "bg-gray-100" : "hover:bg-gray-50"}
            `}
        >
            {/* Avatar with initials */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-gray-600">
                {initials}
            </div>
            <div className="flex flex-col text-left overflow-hidden flex-1">
                <span className={`text-sm truncate ${unreadCount > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}>
                    {name}
                </span>
                <span className={`text-xs truncate w-full ${unreadCount > 0 ? "text-gray-600 font-medium" : "text-gray-400"}`}>
                    {preview}
                </span>
            </div>
            {/* Unread dot indicator - aligned */}
            {unreadCount > 0 ? (
                <div className="w-2 h-2 rounded-full flex-shrink-0 mr-0.5" style={{ backgroundColor: '#B4B4B4' }} />
            ) : (
                <div className="w-2 h-2 rounded-full bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mr-0.5" />
            )}
        </div>
    );
}
