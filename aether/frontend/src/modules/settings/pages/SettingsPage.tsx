import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Bell,
    Shield,
    LogOut,
    Trash2,
    Camera,
    Palette,
    Link2,
    Sparkles,
    Github,
    Key,
    Monitor,
    Moon,
    Sun,
    Clock,
    Check,
    ChevronDown,
    Laptop,
    Smartphone,
    AlertCircle,
    Copy,
    Eye,
    EyeOff,
    Plus,
    Trash,
} from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";
import { useNavigate } from "react-router-dom";

type SettingsTab = "profile" | "appearance" | "notifications" | "security" | "integrations" | "ai";

const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "ai", label: "AI", icon: Sparkles },
];

type UserStatus = "online" | "focus" | "away";

const statusOptions: { id: UserStatus; label: string; color: string }[] = [
    { id: "online", label: "Online", color: "#22C55E" },
    { id: "focus", label: "Focus Mode", color: "#F59E0B" },
    { id: "away", label: "Away", color: "#9CA3AF" },
];

type Theme = "light" | "dark" | "system";
type AnalysisDepth = "concise" | "standard" | "detailed";

export function SettingsPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

    // Profile states
    const [name, setName] = useState(user?.username || "");
    const [email, setEmail] = useState(user?.email || "");
    const [jobTitle, setJobTitle] = useState("");
    const [bio, setBio] = useState("");
    const [status, setStatus] = useState<UserStatus>("online");
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

    // Appearance states
    const [theme, setTheme] = useState<Theme>("system");
    const [sidebarBehavior, setSidebarBehavior] = useState<"expanded" | "remember">("remember");

    // Notification states
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [inAppNotifications, setInAppNotifications] = useState(true);
    const [taskAssignment, setTaskAssignment] = useState(true);
    const [taskComments, setTaskComments] = useState(true);
    const [mentions, setMentions] = useState(true);
    const [dueDateReminders, setDueDateReminders] = useState(true);

    // AI states
    const [aiLanguage, setAiLanguage] = useState("en");
    const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>("standard");
    const [gitContext, setGitContext] = useState(true);

    // API Keys state (mock)
    const [apiKeys, setApiKeys] = useState<{ id: string; name: string; created: string; lastUsed: string }[]>([
        { id: "1", name: "CLI Integration", created: "Jan 15, 2025", lastUsed: "2 hours ago" },
    ]);
    const [showApiKey, setShowApiKey] = useState<string | null>(null);

    const userInitials = user?.username
        ? user.username.substring(0, 2).toUpperCase()
        : "U";

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const currentStatus = statusOptions.find(s => s.id === status)!;

    return (
        <div className="h-full w-full overflow-auto bg-[#FCFCFD]">
            <div className="max-w-5xl mx-auto px-6 py-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-10"
                >
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                        Settings
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Manage your account and preferences
                    </p>
                </motion.div>

                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <motion.nav
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="w-56 flex-shrink-0"
                    >
                        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-2 sticky top-6">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                                            transition-all duration-200 outline-none
                                            ${isActive
                                                ? "bg-[#F4F4F5] text-gray-900"
                                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            }
                                        `}
                                    >
                                        <Icon size={18} className={isActive ? "text-gray-900" : "text-gray-400"} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.nav>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            {/* ==================== PROFILE TAB ==================== */}
                            {activeTab === "profile" && (
                                <motion.div
                                    key="profile"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {/* Public Profile Card */}
                                    <SettingsCard
                                        title="Public Profile"
                                        action={
                                            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100 flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                Visible to everyone
                                            </span>
                                        }
                                    >
                                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
                                            {/* Avatar Section */}
                                            <div className="relative group flex-shrink-0">
                                                <div className="w-32 h-32 rounded-full bg-gradient-to-b from-[#F2F2F7] to-[#E5E5EA] border-[4px] border-white shadow-lg flex items-center justify-center overflow-hidden ring-1 ring-black/5">
                                                    <span className="text-4xl font-[350] text-gray-500 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                                                        {userInitials}
                                                    </span>
                                                </div>

                                                {/* Edit Overlay */}
                                                <button className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-[2px]">
                                                    <Camera size={28} className="text-white mb-1" />
                                                    <span className="text-white text-[10px] font-medium tracking-wide uppercase">Change</span>
                                                </button>

                                                {/* Status Indicator Badge */}
                                                <div className="absolute bottom-1 right-1 p-1 bg-white rounded-full shadow-sm">
                                                    <div
                                                        className="w-5 h-5 rounded-full border-[3px] border-white"
                                                        style={{ backgroundColor: currentStatus.color }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Info & Status Selector */}
                                            <div className="flex-1 w-full text-center sm:text-left pt-2">
                                                <h3 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">
                                                    {user?.username}
                                                </h3>
                                                <p className="text-gray-500 text-sm mb-6 flex items-center justify-center sm:justify-start gap-2">
                                                    {user?.email}
                                                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                    <span className="text-gray-400">@{user?.username?.toLowerCase().replace(/\s+/g, '')}</span>
                                                </p>

                                                {/* Premium Status Selector */}
                                                <div className="relative inline-block text-left">
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                                                        Current Status
                                                    </label>
                                                    <button
                                                        onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                                        className="group flex items-center gap-3 pl-3 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm 
                                                            hover:border-gray-300 hover:shadow-sm transition-all duration-200 min-w-[200px]"
                                                    >
                                                        <div className="relative">
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full transition-transform duration-300 group-hover:scale-110"
                                                                style={{ backgroundColor: currentStatus.color }}
                                                            />
                                                            <div
                                                                className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-20"
                                                                style={{ backgroundColor: currentStatus.color }}
                                                            />
                                                        </div>
                                                        <span className="flex-1 text-left font-medium text-gray-700">{currentStatus.label}</span>
                                                        <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                                                    </button>

                                                    {statusDropdownOpen && (
                                                        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white border border-gray-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                            {statusOptions.map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    onClick={() => {
                                                                        setStatus(opt.id);
                                                                        setStatusDropdownOpen(false);
                                                                    }}
                                                                    className={`
                                                                        flex items-center gap-3 px-4 py-2.5 w-full hover:bg-gray-50 transition-colors
                                                                        ${status === opt.id ? "bg-gray-50/50" : ""}
                                                                    `}
                                                                >
                                                                    <div
                                                                        className="w-2 h-2 rounded-full"
                                                                        style={{ backgroundColor: opt.color }}
                                                                    />
                                                                    <span className={`flex-1 text-left text-sm ${status === opt.id ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                                                                        {opt.label}
                                                                    </span>
                                                                    {status === opt.id && <Check size={14} className="text-gray-900" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </SettingsCard>

                                    {/* Personal Information */}
                                    <SettingsCard title="Personal Information">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <InputField
                                                label="Display Name"
                                                value={name}
                                                onChange={setName}
                                                placeholder="Your display name"
                                            />
                                            <InputField
                                                label="Email Address"
                                                type="email"
                                                value={email}
                                                onChange={setEmail}
                                                placeholder="you@example.com"
                                            />
                                            <InputField
                                                label="Job Title"
                                                value={jobTitle}
                                                onChange={setJobTitle}
                                                placeholder="e.g., Senior Frontend Developer"
                                            />
                                        </div>
                                        <div className="mt-5">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Bio
                                            </label>
                                            <textarea
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                rows={3}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm
                                                    placeholder:text-gray-400 resize-none
                                                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                                                    transition-all duration-200"
                                                placeholder="Tell your team a bit about yourself..."
                                            />
                                        </div>
                                        <div className="mt-6 flex justify-end">
                                            <SaveButton />
                                        </div>
                                    </SettingsCard>

                                    {/* Danger Zone */}
                                    <div className="bg-white border border-red-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
                                        <h2 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h2>
                                        <p className="text-sm text-gray-500 mb-6">
                                            Irreversible and destructive actions
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl
                                                    hover:bg-gray-200 transition-all duration-200"
                                            >
                                                <LogOut size={16} />
                                                Sign Out
                                            </button>
                                            <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-xl
                                                hover:bg-red-100 transition-all duration-200">
                                                <Trash2 size={16} />
                                                Delete Account
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* ==================== APPEARANCE TAB ==================== */}
                            {activeTab === "appearance" && (
                                <motion.div
                                    key="appearance"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {/* Theme */}
                                    <SettingsCard title="Theme">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Choose how Aether looks to you
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                            <ThemeOption
                                                icon={Sun}
                                                label="Light"
                                                selected={theme === "light"}
                                                onClick={() => setTheme("light")}
                                            />
                                            <ThemeOption
                                                icon={Moon}
                                                label="Dark"
                                                selected={theme === "dark"}
                                                onClick={() => setTheme("dark")}
                                            />
                                            <ThemeOption
                                                icon={Monitor}
                                                label="System"
                                                selected={theme === "system"}
                                                onClick={() => setTheme("system")}
                                            />
                                        </div>
                                    </SettingsCard>

                                    {/* Sidebar Behavior */}
                                    <SettingsCard title="Sidebar">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Configure sidebar behavior
                                        </p>
                                        <div className="space-y-3">
                                            <RadioOption
                                                label="Always expanded"
                                                description="Sidebar stays open at all times"
                                                selected={sidebarBehavior === "expanded"}
                                                onClick={() => setSidebarBehavior("expanded")}
                                            />
                                            <RadioOption
                                                label="Remember last state"
                                                description="Sidebar remembers if you collapsed or expanded it"
                                                selected={sidebarBehavior === "remember"}
                                                onClick={() => setSidebarBehavior("remember")}
                                            />
                                        </div>
                                    </SettingsCard>
                                </motion.div>
                            )}

                            {/* ==================== NOTIFICATIONS TAB ==================== */}
                            {activeTab === "notifications" && (
                                <motion.div
                                    key="notifications"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {/* Channels */}
                                    <SettingsCard title="Notification Channels">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Choose how you want to receive notifications
                                        </p>
                                        <div className="space-y-1">
                                            <ToggleRow
                                                label="Email notifications"
                                                description="Receive notifications via email"
                                                checked={emailNotifications}
                                                onChange={setEmailNotifications}
                                            />
                                            <ToggleRow
                                                label="In-app notifications"
                                                description="See notifications inside Aether"
                                                checked={inAppNotifications}
                                                onChange={setInAppNotifications}
                                            />
                                        </div>
                                    </SettingsCard>

                                    {/* Triggers */}
                                    <SettingsCard title="Notification Triggers">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Control which events trigger notifications
                                        </p>
                                        <div className="space-y-1">
                                            <ToggleRow
                                                label="Task assignments"
                                                description="When someone assigns you a task"
                                                checked={taskAssignment}
                                                onChange={setTaskAssignment}
                                            />
                                            <ToggleRow
                                                label="Comments on followed tasks"
                                                description="When someone comments on a task you're following"
                                                checked={taskComments}
                                                onChange={setTaskComments}
                                            />
                                            <ToggleRow
                                                label="Mentions"
                                                description="When someone @mentions you"
                                                checked={mentions}
                                                onChange={setMentions}
                                            />
                                            <ToggleRow
                                                label="Due date reminders"
                                                description="24 hours before a task is due"
                                                checked={dueDateReminders}
                                                onChange={setDueDateReminders}
                                            />
                                        </div>
                                    </SettingsCard>
                                </motion.div>
                            )}

                            {/* ==================== SECURITY TAB ==================== */}
                            {activeTab === "security" && (
                                <motion.div
                                    key="security"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {/* Password */}
                                    <SettingsCard title="Password">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Update your password to keep your account secure
                                        </p>
                                        <button className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl
                                            hover:bg-gray-200 transition-all duration-200">
                                            Change Password
                                        </button>
                                    </SettingsCard>

                                    {/* Active Sessions */}
                                    <SettingsCard title="Active Sessions">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Manage devices where you're currently logged in
                                        </p>
                                        <div className="space-y-3">
                                            <SessionItem
                                                icon={Laptop}
                                                device="MacBook Pro"
                                                browser="Chrome on macOS"
                                                location="San Francisco, CA"
                                                lastActive="Now"
                                                current
                                            />
                                            <SessionItem
                                                icon={Smartphone}
                                                device="iPhone 15 Pro"
                                                browser="Safari on iOS"
                                                location="San Francisco, CA"
                                                lastActive="2 hours ago"
                                            />
                                        </div>
                                    </SettingsCard>

                                    {/* Security Log */}
                                    <SettingsCard title="Security History">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Recent security-related activity on your account
                                        </p>
                                        <div className="space-y-3">
                                            <SecurityLogItem
                                                action="Password changed"
                                                date="Jan 10, 2025"
                                                time="2:34 PM"
                                            />
                                            <SecurityLogItem
                                                action="Email updated"
                                                date="Dec 28, 2024"
                                                time="10:15 AM"
                                            />
                                            <SecurityLogItem
                                                action="Account created"
                                                date="Nov 15, 2024"
                                                time="9:00 AM"
                                            />
                                        </div>
                                    </SettingsCard>
                                </motion.div>
                            )}

                            {/* ==================== INTEGRATIONS TAB ==================== */}
                            {activeTab === "integrations" && (
                                <motion.div
                                    key="integrations"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {/* GitHub */}
                                    <SettingsCard title="GitHub">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center">
                                                    <Github size={24} className="text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-900">GitHub</h3>
                                                    <p className="text-sm text-gray-500">Connect your repositories</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    Connected
                                                </span>
                                                <button className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                                                    Disconnect
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <p className="text-xs text-gray-500">
                                                Connected as <span className="font-medium text-gray-700">@{user?.username || "username"}</span>
                                            </p>
                                        </div>
                                    </SettingsCard>

                                    {/* API Keys */}
                                    <SettingsCard
                                        title="API Keys"
                                        action={
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
                                                <Plus size={14} />
                                                Generate Key
                                            </button>
                                        }
                                    >
                                        <p className="text-sm text-gray-500 mb-4">
                                            Personal access tokens for CLI and API integrations
                                        </p>
                                        <div className="space-y-3">
                                            {apiKeys.map((key) => (
                                                <div
                                                    key={key.id}
                                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                                                            <Key size={18} className="text-gray-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{key.name}</p>
                                                            <p className="text-xs text-gray-500">
                                                                Created {key.created} · Last used {key.lastUsed}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                                                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                                        >
                                                            {showApiKey === key.id ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                                            <Copy size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setApiKeys(apiKeys.filter(k => k.id !== key.id))}
                                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {apiKeys.length === 0 && (
                                                <div className="text-center py-8 text-gray-500 text-sm">
                                                    No API keys generated yet
                                                </div>
                                            )}
                                        </div>
                                    </SettingsCard>
                                </motion.div>
                            )}

                            {/* ==================== AI TAB ==================== */}
                            {activeTab === "ai" && (
                                <motion.div
                                    key="ai"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-6"
                                >
                                    {/* Output Language */}
                                    <SettingsCard title="Output Language">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Choose the language for AI-generated content
                                        </p>
                                        <select
                                            value={aiLanguage}
                                            onChange={(e) => setAiLanguage(e.target.value)}
                                            className="w-full max-w-xs px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm
                                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                                                transition-all duration-200 cursor-pointer"
                                        >
                                            <option value="en">English</option>
                                            <option value="es">Español</option>
                                            <option value="fr">Français</option>
                                            <option value="de">Deutsch</option>
                                            <option value="pt">Português</option>
                                            <option value="zh">中文</option>
                                            <option value="ja">日本語</option>
                                        </select>
                                    </SettingsCard>

                                    {/* Analysis Depth */}
                                    <SettingsCard title="Analysis Depth">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Control how detailed AI analysis should be
                                        </p>
                                        <div className="space-y-3">
                                            <DepthOption
                                                label="Concise"
                                                description="Bullet points and key conclusions only. Best for managers and quick reviews."
                                                selected={analysisDepth === "concise"}
                                                onClick={() => setAnalysisDepth("concise")}
                                            />
                                            <DepthOption
                                                label="Standard"
                                                description="Balanced analysis with context and recommendations."
                                                selected={analysisDepth === "standard"}
                                                onClick={() => setAnalysisDepth("standard")}
                                            />
                                            <DepthOption
                                                label="Detailed"
                                                description="Full technical analysis with code snippets and deep insights."
                                                selected={analysisDepth === "detailed"}
                                                onClick={() => setAnalysisDepth("detailed")}
                                            />
                                        </div>
                                    </SettingsCard>

                                    {/* Git Context */}
                                    <SettingsCard title="Git Context">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 mr-4">
                                                <p className="text-sm text-gray-500">
                                                    Allow AI to read linked commit messages to understand why changes were made,
                                                    not just the current code state.
                                                </p>
                                                <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
                                                    <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs text-blue-700">
                                                        When enabled, AI can provide richer context about code evolution and decision history.
                                                    </p>
                                                </div>
                                            </div>
                                            <Toggle checked={gitContext} onChange={setGitContext} />
                                        </div>
                                    </SettingsCard>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== REUSABLE COMPONENTS ====================

function SettingsCard({
    title,
    children,
    action,
}: {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                {action}
            </div>
            {children}
        </div>
    );
}

function InputField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm
                    placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                    transition-all duration-200"
                placeholder={placeholder}
            />
        </div>
    );
}

function SaveButton() {
    return (
        <button className="px-5 py-2.5 bg-[#18181B] text-white text-sm font-medium rounded-xl
            hover:bg-opacity-90 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-gray-900/20">
            Save Changes
        </button>
    );
}

function Toggle({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`
                relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
                ${checked ? "bg-[#18181B]" : "bg-gray-200"}
            `}
        >
            <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                animate={{ left: checked ? "calc(100% - 20px)" : "4px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
        </button>
    );
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
    );
}

function ThemeOption({
    icon: Icon,
    label,
    selected,
    onClick,
}: {
    icon: typeof Sun;
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200
                ${selected
                    ? "border-[#18181B] bg-gray-50"
                    : "border-gray-100 hover:border-gray-200 bg-white"
                }
            `}
        >
            <Icon size={24} className={selected ? "text-gray-900" : "text-gray-400"} />
            <span className={`text-sm font-medium ${selected ? "text-gray-900" : "text-gray-600"}`}>
                {label}
            </span>
            {selected && (
                <div className="w-5 h-5 rounded-full bg-[#18181B] flex items-center justify-center">
                    <Check size={12} className="text-white" />
                </div>
            )}
        </button>
    );
}

function RadioOption({
    label,
    description,
    selected,
    onClick,
}: {
    label: string;
    description: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-start gap-3 p-4 rounded-xl border-2 w-full text-left transition-all duration-200
                ${selected
                    ? "border-[#18181B] bg-gray-50"
                    : "border-gray-100 hover:border-gray-200 bg-white"
                }
            `}
        >
            <div className={`
                w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                ${selected ? "border-[#18181B] bg-[#18181B]" : "border-gray-300"}
            `}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </button>
    );
}

function DepthOption({
    label,
    description,
    selected,
    onClick,
}: {
    label: string;
    description: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-start gap-3 p-4 rounded-xl border-2 w-full text-left transition-all duration-200
                ${selected
                    ? "border-[#18181B] bg-gray-50"
                    : "border-gray-100 hover:border-gray-200 bg-white"
                }
            `}
        >
            <div className={`
                w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                ${selected ? "border-[#18181B] bg-[#18181B]" : "border-gray-300"}
            `}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </button>
    );
}

function SessionItem({
    icon: Icon,
    device,
    browser,
    location,
    lastActive,
    current = false,
}: {
    icon: typeof Laptop;
    device: string;
    browser: string;
    location: string;
    lastActive: string;
    current?: boolean;
}) {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                    <Icon size={18} className="text-gray-500" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {device}
                        {current && (
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
                                Current
                            </span>
                        )}
                    </p>
                    <p className="text-xs text-gray-500">{browser} · {location}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {lastActive}
                </span>
                {!current && (
                    <button className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors">
                        Revoke
                    </button>
                )}
            </div>
        </div>
    );
}

function SecurityLogItem({
    action,
    date,
    time,
}: {
    action: string;
    date: string;
    time: string;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <p className="text-sm font-medium text-gray-900">{action}</p>
            <p className="text-sm text-gray-500">{date} at {time}</p>
        </div>
    );
}
