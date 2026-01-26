import type { ReactNode } from "react";
import { Search, Sidebar as SidebarIcon, Plus } from "lucide-react";

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen w-full bg-[#E8E9EC] font-sans text-[#18181B]">
            {/* Sidebar */}
            <aside className="w-[280px] h-full flex flex-col bg-[#FCFCFD] border-r border-gray-100 flex-shrink-0">
                {/* Header / Logo */}
                <div className="px-6 py-6 flex items-center justify-between">
                    <h1 className="text-xl font-semibold tracking-tight">aether.</h1>
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
                        A
                    </div>
                    <span className="font-medium text-gray-700 text-sm">Alejandro Rouco</span>
                </div>

                {/* Tasks Section */}
                <div className="px-6 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-gray-500 font-medium text-xs uppercase tracking-wide">Tasks</h3>
                        <button className="text-gray-400 hover:text-gray-600">
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="space-y-0.5">
                        <TaskItem label="Build API" active hasDot dotColor="bg-red-400" />
                        <TaskItem label="UI for checkout page" hasDot dotColor="bg-yellow-400" />
                        <TaskItem label="Add docker support" hasDot dotColor="bg-yellow-400" />
                        <TaskItem
                            label="Improve deployment script"
                            hasDot
                            dotColor="bg-green-500"
                        />
                    </div>
                </div>

                {/* Messages Section */}
                <div className="px-6 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-gray-500 font-medium text-xs uppercase tracking-wide">Messages</h3>
                        <button className="text-gray-400 hover:text-gray-600">
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="space-y-1">
                        <MessageItem
                            name="Steve Jobs"
                            preview="Commented on your task"
                            active={false}
                        />
                        <MessageItem
                            name="Tim Cook..."
                            preview="I found a bug in your code ..."
                            active={false}
                        />
                        <MessageItem
                            name="Lisa Brennan"
                            preview="Hey, quick question. Do ..."
                            active={false}
                        />
                        <MessageItem
                            name="Mike Markkula"
                            preview="Can we pair on this later?"
                            active={false}
                        />
                        <MessageItem
                            name="Ron Wayne"
                            preview="Your ok"
                            active={false}
                        />
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

function TaskItem({
    label,
    active = false,
    hasDot = false,
    dotColor = "",
}: {
    label: string;
    active?: boolean;
    hasDot?: boolean;
    dotColor?: string;
}) {
    return (
        <button
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                ? "bg-[#E6E8EB] text-gray-900 shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
                }`}
        >
            <span>{label}</span>
            {hasDot && <div className={`w-2 h-2 rounded-full ${dotColor}`} />}
        </button>
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
