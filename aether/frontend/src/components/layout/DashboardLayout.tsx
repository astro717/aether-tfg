import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Search, Sidebar as SidebarIcon, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { tasksApi, type Task } from "../../modules/dashboard/api/tasksApi";

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user } = useAuth();
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    useEffect(() => {
        const fetchMyTasks = async () => {
            if (!user) {
                setTasksLoading(false);
                return;
            }

            try {
                setTasksLoading(true);
                const tasks = await tasksApi.getMyTasks();
                // Filter to show only pending and in_progress tasks (not done)
                const activeTasks = tasks.filter(t => t.status !== 'done');
                setMyTasks(activeTasks);
            } catch (err) {
                console.error('Error fetching my tasks:', err);
            } finally {
                setTasksLoading(false);
            }
        };

        fetchMyTasks();
    }, [user]);

    const userInitials = user?.username
        ? user.username.substring(0, 1).toUpperCase()
        : 'U';

    const userName = user?.username || 'User';

    return (
        <div className="flex h-screen w-full bg-[#E8E9EC] font-sans text-[#18181B]">
            {/* Sidebar */}
            <aside className="w-[280px] h-full flex flex-col bg-[#FCFCFD] border-r border-gray-100 flex-shrink-0">
                {/* Header / Logo */}
                <div className="px-6 py-6 flex items-center justify-between">
                    <Link to="/dashboard" className="cursor-pointer hover:opacity-80 transition-opacity block">
                        <h1 className="text-xl font-semibold tracking-tight">aether.</h1>
                    </Link>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                        <SidebarIcon size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 mb-6">
                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            size={14}
                        />
                        <input
                            type="text"
                            placeholder="Search"
                            className="w-full h-9 pl-9 pr-4 bg-[#F4F5F7] rounded-xl text-xs outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-gray-200 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* User Profile */}
                <div className="px-6 mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-gray-500 font-medium text-sm">
                        {userInitials}
                    </div>
                    <span className="font-medium text-gray-700 text-sm">{userName}</span>
                </div>

                {/* Scrollable Tasks + Messages */}
                <div className="flex-1 overflow-y-auto px-6 space-y-6 min-h-0">
                    {/* Tasks Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-gray-500 font-medium text-xs uppercase tracking-wide">Tasks</h3>
                            <button className="text-gray-400 hover:text-gray-600">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-0.5">
                            {tasksLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            ) : myTasks.length === 0 ? (
                                <p className="text-gray-400 text-sm py-2 px-4">No tasks assigned</p>
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
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Messages Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Link to="/messages" className="text-gray-500 font-medium text-xs uppercase tracking-wide hover:text-gray-700 transition-colors">
                                Messages
                            </Link>
                            <Link to="/messages" className="text-gray-400 hover:text-gray-600">
                                <Plus size={16} />
                            </Link>
                        </div>
                        <div className="space-y-1">
                            <Link to="/messages">
                                <MessageItem
                                    name="Steve Jobs"
                                    preview="One more thing..."
                                    active={false}
                                />
                            </Link>
                            <Link to="/messages">
                                <MessageItem
                                    name="Tim Cook"
                                    preview="The quarterly reports look great"
                                    active={false}
                                />
                            </Link>
                            <Link to="/messages">
                                <MessageItem
                                    name="Jony Ive"
                                    preview="The new design is absolutely beautiful"
                                    active={false}
                                />
                            </Link>
                            <Link to="/messages">
                                <MessageItem
                                    name="Craig Federighi"
                                    preview="Hair Force One is ready for WWDC!"
                                    active={false}
                                />
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden flex flex-col relative h-full">
                {children}
            </main>
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
}: {
    taskId: string;
    label: string;
    active?: boolean;
    hasDot?: boolean;
    dotColor?: string;
    onClick?: () => void;
}) {
    return (
        <Link
            to={`/tasks/${taskId}`}
            onClick={onClick}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                ? "bg-[#E6E8EB] text-gray-900 shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
                }`}
        >
            <span className="truncate max-w-[180px]">{label}</span>
            {hasDot && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />}
        </Link>
    );
}

function MessageItem({
    name,
    preview,
    active = false,
}: {
    name: string;
    preview: string;
    active?: boolean;
}) {
    return (
        <div
            className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${active ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
        >
            {/* Avatar placeholder */}
            <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex flex-col text-left overflow-hidden">
                <span className="text-sm font-semibold text-gray-800 truncate">
                    {name}
                </span>
                <span className="text-xs text-gray-400 truncate w-full">
                    {preview}
                </span>
            </div>
            <div className="ml-auto w-2 h-2 rounded-full bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}
