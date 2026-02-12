import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { Sidebar as SidebarIcon, Plus, Loader2, Settings } from "lucide-react";
import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { tasksApi, type Task } from "../../modules/dashboard/api/tasksApi";
import { messagingApi, type Conversation } from "../../modules/messaging/api/messagingApi";
import { CreateTaskModal } from "../../modules/tasks/components/CreateTaskModal";
import { SidebarSearch } from "./SidebarSearch";
import { NotificationsPopover } from "../../modules/notifications/components/NotificationsPopover";
import { CriticalModal } from "../../modules/notifications/components/CriticalModal";
import { useNotifications } from "../../modules/notifications/context/NotificationsContext";
import { UserAvatar } from "../ui/UserAvatar";

interface DashboardLayoutProps {
    children: ReactNode;
}

const MESSAGES_POLLING_INTERVAL = 4000; // 4 seconds
const DISMISSED_CRITICAL_KEY = 'aether_dismissed_critical_tasks';
const DISMISS_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DismissedCriticalTasks {
    [taskId: string]: number; // timestamp
}

function getDismissedCriticalTasks(): DismissedCriticalTasks {
    try {
        const stored = localStorage.getItem(DISMISSED_CRITICAL_KEY);
        if (!stored) return {};
        return JSON.parse(stored);
    } catch {
        return {};
    }
}

function setDismissedCriticalTask(taskId: string): void {
    const dismissed = getDismissedCriticalTasks();
    dismissed[taskId] = Date.now();
    localStorage.setItem(DISMISSED_CRITICAL_KEY, JSON.stringify(dismissed));
}

function isTaskDismissed(taskId: string): boolean {
    const dismissed = getDismissedCriticalTasks();
    const timestamp = dismissed[taskId];
    if (!timestamp) return false;
    // Check if expired (> 24h)
    return Date.now() - timestamp < DISMISS_EXPIRY_MS;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const location = useLocation();
    const isSettingsActive = location.pathname === '/settings';
    const [searchParams] = useSearchParams();
    const activeUserId = searchParams.get("user");

    // Sidebar collapse state
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Messages state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(true);
    const hasLoadedMessagesRef = useRef(false);

    // Create task modal state
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

    // Critical Alert State
    const [criticalTask, setCriticalTask] = useState<Task | null>(null);
    const [hasDismissedCritical, setHasDismissedCritical] = useState(false);
    const { playNotificationSound } = useNotifications();

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

            // Check for critical tasks (due in < 24h)
            if (!hasDismissedCritical && !silent) {
                const now = new Date();
                const critical = activeTasks.find(t => {
                    if (!t.due_date) return false;
                    // Skip if already dismissed (persisted in localStorage)
                    if (isTaskDismissed(t.id)) return false;
                    const due = new Date(t.due_date);
                    const diff = due.getTime() - now.getTime();
                    // Due within 24 hours (86400000ms) or overdue
                    return diff < 86400000;
                });

                if (critical) {
                    setCriticalTask(critical);
                    playNotificationSound('critical');
                }
            }
        } catch (err) {
            console.error('Error fetching my tasks:', err);
        } finally {
            if (!silent) setTasksLoading(false);
        }
    }, [user, hasDismissedCritical, playNotificationSound]);

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

    const userName = user?.username || 'User';

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    return (
        <div className="flex h-screen w-full bg-[#E8E9EC] dark:bg-transparent font-sans text-[#18181B] dark:text-[#FAFAFA] transition-colors duration-200">
            {/* Sidebar */}
            <aside
                className={`
                    ${isCollapsed ? 'w-[72px]' : 'w-[280px]'}
                    h-full flex flex-col bg-[#FCFCFD] dark:bg-[#18181B] border-r border-gray-100 dark:border-zinc-800 flex-shrink-0
                    transition-all duration-300 ease-in-out relative z-40
                `}
            >
                {/* Header / Logo */}
                <div className={`py-6 flex items-center ${isCollapsed ? 'px-4 justify-center' : 'px-6 justify-between'}`}>
                    {!isCollapsed && (
                        <Link to="/dashboard" className="cursor-pointer hover:opacity-80 transition-opacity block">
                            <h1 className="text-xl font-semibold tracking-tight dark:text-white">aether.</h1>
                        </Link>
                    )}
                    <div className="flex items-center gap-1">
                        <NotificationsPopover isCollapsed={isCollapsed} />
                        <button
                            onClick={toggleSidebar}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
                            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <SidebarIcon size={18} />
                        </button>
                    </div>
                </div>

                {/* Search - Hidden when collapsed */}
                {!isCollapsed && (
                    <div className="px-6 mb-6">
                        <SidebarSearch
                            tasks={myTasks}
                            conversations={conversations}
                        />
                    </div>
                )}

                {/* User Profile */}
                <div className={`mb-6 ${isCollapsed ? 'px-2' : 'px-4'}`}>
                    <button
                        className={`
                            w-full flex items-center group
                            ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 gap-3'}
                            rounded-xl transition-all duration-200
                            cursor-pointer outline-none
                            ${isSettingsActive ? 'bg-[#E6E8EB] dark:bg-zinc-800 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50'}
                        `}
                        onClick={() => navigate('/settings')}
                    >
                        <UserAvatar
                            username={userName}
                            avatarColor={user?.avatar_color}
                            size="sm"
                        />
                        {!isCollapsed && (
                            <>
                                <span className={`font-medium text-sm truncate flex-1 text-left ${isSettingsActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{userName}</span>
                                <Settings
                                    size={16}
                                    className={`transition-all duration-200 ${isSettingsActive ? 'text-gray-600 dark:text-gray-400 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
                                />
                            </>
                        )}
                    </button>
                </div>

                {/* Scrollable Tasks + Messages */}
                <div className={`flex-1 overflow-y-auto space-y-6 min-h-0 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                    {/* Tasks Section */}
                    <div>
                        <div className={`flex items-center mb-3 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
                            {!isCollapsed && (
                                <h3 className="text-gray-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wide">Tasks</h3>
                            )}
                            <button
                                onClick={() => setIsCreateTaskModalOpen(true)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
                                        label={task.title || "Untitled Task"}
                                        active={location.pathname === `/tasks/${task.id}`}
                                        hasDot
                                        dotColor={getPriorityDotColor(task.due_date)}
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
                                <Link to="/messages" className="text-gray-500 dark:text-gray-400 font-medium text-xs uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                    Messages
                                </Link>
                            )}
                            <Link to="/messages" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
                                        : (conv.lastMessage.content || '');
                                    return (
                                        <Link key={conv.user.id} to={`/messages?user=${conv.user.id}`}>
                                            <MessageItem
                                                name={conv.user.username || 'User'}
                                                preview={preview}
                                                unreadCount={conv.unreadCount}
                                                active={location.pathname === '/messages' && activeUserId === conv.user.id}
                                                isCollapsed={isCollapsed}
                                                avatarColor={conv.user.avatar_color}
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

            {/* Critical Deadline Alert */}
            {criticalTask && (
                <CriticalModal
                    isOpen={!!criticalTask}
                    onClose={() => {
                        // Persist dismiss to localStorage
                        setDismissedCriticalTask(criticalTask.id);
                        setCriticalTask(null);
                        setHasDismissedCritical(true);
                    }}
                    title="Deadline Approaching"
                    description={`The task "${criticalTask.title}" is due soon. Please prioritize this item.`}
                    dueDate={new Date(criticalTask.due_date!)}
                    onAction={() => navigate(`/tasks/${criticalTask.id}`)}
                    actionLabel="View Task"
                />
            )}
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
                    ${active ? "bg-[#E6E8EB] dark:bg-zinc-800 shadow-sm" : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"}
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
                ${active ? "bg-[#E6E8EB] dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50"}
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
    avatarColor,
}: {
    name: string;
    preview: string;
    active?: boolean;
    unreadCount?: number;
    isCollapsed?: boolean;
    avatarColor?: string;
}) {
    // Collapsed: show only centered avatar with optional unread indicator
    if (isCollapsed) {
        return (
            <div
                className={`
                    relative flex items-center justify-center py-2 rounded-xl cursor-pointer transition-colors
                    ${active ? "bg-gray-100 dark:bg-zinc-800" : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"}
                `}
                title={`${name}: ${preview}`}
            >
                <div className="relative">
                    <UserAvatar
                        username={name}
                        avatarColor={avatarColor}
                        size="sm"
                    />
                    {/* Unread indicator badge */}
                    {unreadCount > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-[#FCFCFD] dark:border-[#18181B]" />
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
                ${active ? "bg-gray-100 dark:bg-zinc-800" : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"}
            `}
        >
            {/* Avatar with initials */}
            <UserAvatar
                username={name}
                avatarColor={avatarColor}
                size="sm"
            />
            <div className="flex flex-col text-left overflow-hidden flex-1">
                <span className={`text-sm truncate ${unreadCount > 0 ? "font-bold text-gray-900 dark:text-white" : "font-semibold text-gray-800 dark:text-gray-200"}`}>
                    {name}
                </span>
                <span className={`text-xs truncate w-full ${unreadCount > 0 ? "text-gray-600 dark:text-gray-400 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
                    {preview}
                </span>
            </div>
            {/* Unread dot indicator - aligned */}
            {unreadCount > 0 && (
                <div className="w-2 h-2 rounded-full flex-shrink-0 mr-0.5" style={{ backgroundColor: '#B4B4B4' }} />
            )}
        </div>
    );
}
