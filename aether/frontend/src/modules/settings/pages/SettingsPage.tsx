import { useState, useRef } from "react";
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
    AlertCircle,
    Copy,
    Eye,
    EyeOff,
    Plus,
    Trash,
    Lock,
    Mail,
    CheckCircle,
    Loader2,
    BookOpen,
} from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { useNavigate } from "react-router-dom";
import { changePassword, sendResetEmailToCurrentUser, updateProfile } from "../../auth/api/authApi";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { OnboardingModal } from "../../../components/ui/OnboardingModal";

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

export function SettingsPage() {
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const {
        aiLanguage,
        setAiLanguage,
        analysisDepth,
        setAnalysisDepth,
        soundSettings,
        updateSoundSettings,
        notificationSettings,
        notificationSettingsLoading,
        updateNotificationSettings,
    } = useSettings();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

    // Profile states
    const [name, setName] = useState(user?.username || "");
    const [email, setEmail] = useState(user?.email || "");
    const [jobTitle, setJobTitle] = useState("");
    const [bio, setBio] = useState("");
    const [status, setStatus] = useState<UserStatus>("online");
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await updateProfile({
                username: name,
                email,
                jobTitle,
                bio,
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to update profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Appearance states
    const [sidebarBehavior, setSidebarBehavior] = useState<"expanded" | "remember">("remember");

    // Deadline reminder options for multi-select
    const deadlineReminderOptions = [
        { value: 1, label: "1 hour before" },
        { value: 2, label: "2 hours before" },
        { value: 6, label: "6 hours before" },
        { value: 24, label: "24 hours before" },
        { value: 48, label: "2 days before" },
    ];

    // Handler for updating notification settings
    const handleNotificationSettingChange = async (key: string, value: boolean | number[]) => {
        try {
            await updateNotificationSettings({ [key]: value });
        } catch (error) {
            console.error("Failed to update setting:", error);
        }
    };

    // AI states (aiLanguage and analysisDepth now come from SettingsContext)
    const [gitContext, setGitContext] = useState(true);

    // API Keys state (mock)
    const [apiKeys, setApiKeys] = useState<{ id: string; name: string; created: string; lastUsed: string }[]>([
        { id: "1", name: "CLI Integration", created: "Jan 15, 2025", lastUsed: "2 hours ago" },
    ]);
    const [showApiKey, setShowApiKey] = useState<string | null>(null);

    // Onboarding replay state
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const currentStatus = statusOptions.find(s => s.id === status)!;

    return (
        <div className="h-full w-full overflow-auto bg-[#FCFCFD] dark:bg-transparent transition-colors duration-200">
            <div className="max-w-5xl mx-auto px-6 py-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-10"
                >
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        Settings
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
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
                        <div className="bg-white dark:bg-[#18181B] border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none p-2 sticky top-6 transition-colors duration-200">
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
                                                ? "bg-[#F4F4F5] dark:bg-zinc-800 text-gray-900 dark:text-white"
                                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-white"
                                            }
                                        `}
                                    >
                                        <Icon size={18} className={isActive ? "text-gray-900 dark:text-white" : "text-gray-400"} />
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
                                                <div className="w-32 h-32 rounded-full border-[4px] border-white shadow-lg flex items-center justify-center overflow-hidden ring-1 ring-black/5">
                                                    <UserAvatar
                                                        username={user?.username || ''}
                                                        avatarColor={user?.avatar_color}
                                                        size="2xl"
                                                        className="w-full h-full text-4xl"
                                                        displayInitials={user?.username?.substring(0, 2).toUpperCase()}
                                                    />
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
                                                        className="group flex items-center gap-3 pl-3 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm 
                                                            hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all duration-200 min-w-[200px]"
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
                                                        <span className="flex-1 text-left font-medium text-gray-700 dark:text-gray-200">{currentStatus.label}</span>
                                                        <ChevronDown size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                                                    </button>

                                                    {statusDropdownOpen && (
                                                        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                            {statusOptions.map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    onClick={() => {
                                                                        setStatus(opt.id);
                                                                        setStatusDropdownOpen(false);
                                                                    }}
                                                                    className={`
                                                                        flex items-center gap-3 px-4 py-2.5 w-full hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors
                                                                        ${status === opt.id ? "bg-gray-50/50 dark:bg-zinc-700/50" : ""}
                                                                    `}
                                                                >
                                                                    <div
                                                                        className="w-2 h-2 rounded-full"
                                                                        style={{ backgroundColor: opt.color }}
                                                                    />
                                                                    <span className={`flex-1 text-left text-sm ${status === opt.id ? "text-gray-900 dark:text-white font-medium" : "text-gray-600 dark:text-gray-400"}`}>
                                                                        {opt.label}
                                                                    </span>
                                                                    {status === opt.id && <Check size={14} className="text-gray-900 dark:text-white" />}
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
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white text-sm
                                                    placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none
                                                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                                                    transition-all duration-200"
                                                placeholder="Tell your team a bit about yourself..."
                                            />
                                        </div>
                                        <div className="mt-6 flex items-center justify-between">
                                            {saveSuccess ? (
                                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium animate-in fade-in slide-in-from-left-2">
                                                    <CheckCircle size={16} />
                                                    Saved successfully
                                                </div>
                                            ) : <div />}
                                            <SaveButton onClick={handleSaveProfile} loading={isSaving} />
                                        </div>
                                    </SettingsCard>

                                    {/* Quick Guide */}
                                    <SettingsCard title="Quick Guide">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                                                    <BookOpen size={22} className="text-violet-500 dark:text-violet-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Welcome Tutorial</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Review the Aether quick start guide
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsOnboardingOpen(true)}
                                                className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-medium rounded-xl
                                                    hover:shadow-lg hover:shadow-violet-500/25 hover:scale-[1.02] transition-all duration-200"
                                            >
                                                Replay Guide
                                            </button>
                                        </div>
                                    </SettingsCard>

                                    {/* Danger Zone */}
                                    <div className="bg-white dark:bg-[#18181B] border border-red-100 dark:border-red-900/30 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none p-6 transition-colors duration-200">
                                        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                            Irreversible and destructive actions
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl
                                                    hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all duration-200"
                                            >
                                                <LogOut size={16} />
                                                Sign Out
                                            </button>
                                            <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl
                                                hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200">
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
                                    {/* Loading state */}
                                    {notificationSettingsLoading && (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 size={24} className="animate-spin text-gray-400" />
                                        </div>
                                    )}

                                    {/* Channels */}
                                    <SettingsCard title="Notification Channels">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Choose how you want to receive notifications
                                        </p>
                                        <div className="space-y-1">
                                            <ToggleRow
                                                label="Email notifications"
                                                description="Receive notifications via email"
                                                checked={notificationSettings?.notify_email_enabled ?? true}
                                                onChange={(v) => handleNotificationSettingChange("notify_email_enabled", v)}
                                            />
                                            <ToggleRow
                                                label="In-app notifications"
                                                description="See notifications inside Aether"
                                                checked={notificationSettings?.notify_inapp_enabled ?? true}
                                                onChange={(v) => handleNotificationSettingChange("notify_inapp_enabled", v)}
                                            />
                                        </div>
                                    </SettingsCard>

                                    {/* Sounds */}
                                    <SettingsCard title="Sound Preferences">
                                        <p className="text-sm text-gray-500 mb-6">
                                            Customize your notification sounds and volume
                                        </p>

                                        {/* Volume */}
                                        <div className="mb-8">
                                            <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                                                <span>Master Volume</span>
                                                <span className="text-gray-500">{Math.round((soundSettings.volume || 0.8) * 100)}%</span>
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={soundSettings.volume ?? 0.8}
                                                onChange={(e) => updateSoundSettings({ volume: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Message Sounds */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                    Message & Mention Sound
                                                </label>
                                                <SoundSelector
                                                    selected={soundSettings.notificationSound || "note_1.mp3"}
                                                    onSelect={(sound) => updateSoundSettings({ notificationSound: sound })}
                                                    volume={soundSettings.volume}
                                                    options={[
                                                        { id: "note_1.mp3", label: "Pebble" },
                                                        { id: "note_2.mp3", label: "Cosmic" },
                                                        { id: "note_3.mp3", label: "Ripple" },
                                                        { id: "note_4.mp3", label: "Chime" },
                                                    ]}
                                                />
                                            </div>

                                            {/* Critical Alert Sounds */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                    Critical Alert Sound
                                                </label>
                                                <SoundSelector
                                                    selected={soundSettings.criticalSound || "alert_1.mp3"}
                                                    onSelect={(sound) => updateSoundSettings({ criticalSound: sound })}
                                                    volume={soundSettings.volume}
                                                    isCritical
                                                    options={[
                                                        { id: "alert_1.mp3", label: "Radar" },
                                                        { id: "alert_2.mp3", label: "Pulse" },
                                                        { id: "alert_3.mp3", label: "Alarm" },
                                                        { id: "alert_4.mp3", label: "System" },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    </SettingsCard>

                                    {/* Email Triggers */}
                                    <SettingsCard title="Email Notification Triggers">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Control which events send you email notifications
                                        </p>
                                        <div className="space-y-1">
                                            <ToggleRow
                                                label="Task assignments"
                                                description="When someone assigns you a task"
                                                checked={notificationSettings?.notify_email_assignments ?? true}
                                                onChange={(v) => handleNotificationSettingChange("notify_email_assignments", v)}
                                            />
                                            <ToggleRow
                                                label="Comments on your tasks"
                                                description="When someone comments on a task you're assigned to"
                                                checked={notificationSettings?.notify_email_comments ?? true}
                                                onChange={(v) => handleNotificationSettingChange("notify_email_comments", v)}
                                            />
                                            <ToggleRow
                                                label="Mentions"
                                                description="When someone @mentions you"
                                                checked={notificationSettings?.notify_email_mentions ?? true}
                                                onChange={(v) => handleNotificationSettingChange("notify_email_mentions", v)}
                                            />
                                        </div>
                                    </SettingsCard>

                                    {/* Deadline Reminders */}
                                    <SettingsCard title="Deadline Reminders">
                                        <p className="text-sm text-gray-500 mb-4">
                                            Choose when to receive email reminders about upcoming deadlines
                                        </p>
                                        <div className="space-y-2">
                                            {deadlineReminderOptions.map((option) => {
                                                const isSelected = notificationSettings?.deadline_reminder_hours?.includes(option.value) ?? option.value === 24;
                                                return (
                                                    <label
                                                        key={option.value}
                                                        className={`
                                                            flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                                            ${isSelected
                                                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                                                : "bg-gray-50 dark:bg-zinc-800/50 border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
                                                            }
                                                        `}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                const currentHours = notificationSettings?.deadline_reminder_hours ?? [24];
                                                                const newHours = e.target.checked
                                                                    ? [...currentHours, option.value].sort((a, b) => a - b)
                                                                    : currentHours.filter((h) => h !== option.value);
                                                                handleNotificationSettingChange("deadline_reminder_hours", newHours);
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className={`text-sm font-medium ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                                                            {option.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </SettingsCard>
                                </motion.div>
                            )}

                            {/* ==================== SECURITY TAB ==================== */}
                            {activeTab === "security" && (
                                <SecurityTab />
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
                                                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">GitHub</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Connect your repositories</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium rounded-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    Connected
                                                </span>
                                                <button className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
                                                    Disconnect
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Connected as <span className="font-medium text-gray-700 dark:text-gray-300">@{user?.username || "username"}</span>
                                            </p>
                                        </div>
                                    </SettingsCard>

                                    {/* API Keys */}
                                    <SettingsCard
                                        title="API Keys"
                                        action={
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                                <Plus size={14} />
                                                Generate Key
                                            </button>
                                        }
                                    >
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                            Personal access tokens for CLI and API integrations
                                        </p>
                                        <div className="space-y-3">
                                            {apiKeys.map((key) => (
                                                <div
                                                    key={key.id}
                                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                                                            <Key size={18} className="text-gray-500 dark:text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{key.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                Created {key.created} · Last used {key.lastUsed}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                                                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                                        >
                                                            {showApiKey === key.id ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                        <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                                            <Copy size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setApiKeys(apiKeys.filter(k => k.id !== key.id))}
                                                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
                                            onChange={(e) => setAiLanguage(e.target.value as 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja')}
                                            className="w-full max-w-xs px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white text-sm
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
                                                <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                                    <AlertCircle size={16} className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs text-blue-700 dark:text-blue-300">
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

            {/* Onboarding Tutorial Modal (Replay from Settings) */}
            <OnboardingModal
                isOpen={isOnboardingOpen}
                onClose={() => setIsOnboardingOpen(false)}
            />
        </div >
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
        <div className="bg-white dark:bg-[#18181B] border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none p-6 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white text-sm
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400
                    transition-all duration-200"
                placeholder={placeholder}
            />
        </div>
    );
}

function SaveButton({ onClick, loading }: { onClick?: () => void; loading?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="px-5 py-2.5 bg-[#18181B] dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded-xl
            hover:bg-opacity-90 dark:hover:bg-gray-100 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Saving..." : "Save Changes"}
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
                ${checked ? "bg-[#18181B] dark:bg-white" : "bg-gray-200 dark:bg-zinc-700"}
            `}
        >
            <motion.div
                className={`absolute top-1 w-4 h-4 rounded-full shadow-sm ${checked ? "bg-white dark:bg-zinc-900" : "bg-white"}`}
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
        <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-zinc-800 last:border-0">
            <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
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
                    ? "border-[#18181B] dark:border-white bg-gray-50 dark:bg-zinc-800"
                    : "border-gray-100 dark:border-zinc-700 hover:border-gray-200 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
                }
            `}
        >
            <Icon size={24} className={selected ? "text-gray-900 dark:text-white" : "text-gray-400"} />
            <span className={`text-sm font-medium ${selected ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                {label}
            </span>
            {selected && (
                <div className="w-5 h-5 rounded-full bg-[#18181B] dark:bg-white flex items-center justify-center">
                    <Check size={12} className="text-white dark:text-zinc-900" />
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
                    ? "border-[#18181B] dark:border-white bg-gray-50 dark:bg-zinc-800"
                    : "border-gray-100 dark:border-zinc-700 hover:border-gray-200 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
                }
            `}
        >
            <div className={`
                w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                ${selected ? "border-[#18181B] dark:border-white bg-[#18181B] dark:bg-white" : "border-gray-300 dark:border-zinc-600"}
            `}>
                {selected && <div className="w-2 h-2 rounded-full bg-white dark:bg-zinc-900" />}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
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
                    ? "border-[#18181B] dark:border-white bg-gray-50 dark:bg-zinc-800"
                    : "border-gray-100 dark:border-zinc-700 hover:border-gray-200 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50"
                }
            `}
        >
            <div className={`
                w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                ${selected ? "border-[#18181B] dark:border-white bg-[#18181B] dark:bg-white" : "border-gray-300 dark:border-zinc-600"}
            `}>
                {selected && <div className="w-2 h-2 rounded-full bg-white dark:bg-zinc-900" />}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
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
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center">
                    <Icon size={18} className="text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {device}
                        {current && (
                            <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium rounded-full">
                                Current
                            </span>
                        )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{browser} · {location}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {lastActive}
                </span>
                {!current && (
                    <button className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium transition-colors">
                        Revoke
                    </button>
                )}
            </div>
        </div>
    );
}

function SoundSelector({
    selected,
    onSelect,
    options,
    volume = 0.5,
    isCritical: _isCritical = false,
}: {
    selected: string;
    onSelect: (sound: string) => void;
    options: { id: string; label: string }[];
    volume?: number;
    isCritical?: boolean;
}) {
    const [playing, setPlaying] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playSound = (sound: string) => {
        // Stop current if playing
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        const audio = new Audio(`/sounds/${sound}`);
        audio.volume = volume;
        audioRef.current = audio;

        setPlaying(sound);
        audio.play().catch(() => { });

        audio.onended = () => {
            setPlaying(null);
            audioRef.current = null;
        };
    };

    return (
        <div className="space-y-2">
            {options.map((option) => (
                <div
                    key={option.id}
                    onClick={() => onSelect(option.id)}
                    className={`
                        flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all duration-200
                        ${selected === option.id
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                            : "bg-gray-50 dark:bg-zinc-800/50 border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
                        }
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-4 h-4 rounded-full border flex items-center justify-center
                            ${selected === option.id
                                ? "border-blue-500 bg-blue-500"
                                : "border-gray-300 dark:border-zinc-600"
                            }
                        `}>
                            {selected === option.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className={`text-sm font-medium ${selected === option.id ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                            {option.label}
                        </span>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            playSound(option.id);
                        }}
                        className={`
                            w-8 h-8 flex items-center justify-center rounded-full transition-colors
                            ${playing === option.id
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5"
                            }
                        `}
                    >
                        {playing === option.id ? (
                            <div className="flex gap-0.5 items-end justify-center h-3 w-3">
                                <span className="w-0.5 bg-current animate-[pulse_0.5s_ease-in-out_infinite] h-full" />
                                <span className="w-0.5 bg-current animate-[pulse_0.6s_ease-in-out_infinite] h-2/3" />
                                <span className="w-0.5 bg-current animate-[pulse_0.7s_ease-in-out_infinite] h-full" />
                            </div>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                </div>
            ))}
        </div>
    );
}

function SecurityTab() {
    const { user } = useAuth();
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [sendingResetEmail, setSendingResetEmail] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

    const passwordStrength = () => {
        if (newPassword.length === 0) return null;
        if (newPassword.length < 8) return { label: "Too short", color: "bg-red-400", width: "33%" };
        if (newPassword.length < 12) return { label: "Fair", color: "bg-yellow-400", width: "66%" };
        return { label: "Strong", color: "bg-green-400", width: "100%" };
    };

    const strength = passwordStrength();

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsSubmitting(true);

        try {
            await changePassword(currentPassword, newPassword);
            setSuccess("Password changed successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowChangePassword(false);
            setTimeout(() => setSuccess(""), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to change password");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendResetEmail = async () => {
        setSendingResetEmail(true);
        setError("");

        try {
            await sendResetEmailToCurrentUser();
            setResetEmailSent(true);
            setTimeout(() => setResetEmailSent(false), 10000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send reset email");
        } finally {
            setSendingResetEmail(false);
        }
    };

    return (
        <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
        >
            {/* Success Message */}
            {success && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl"
                >
                    <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
                </motion.div>
            )}

            {/* Change Password Card */}
            <SettingsCard title="Password">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Update your password to keep your account secure
                </p>

                {!showChangePassword ? (
                    <button
                        onClick={() => setShowChangePassword(true)}
                        className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl
                            hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all duration-200"
                    >
                        Change Password
                    </button>
                ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        {/* Current Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white text-sm
                                        placeholder:text-gray-400 dark:placeholder:text-gray-500 pr-10
                                        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400
                                        transition-all duration-200 disabled:opacity-50"
                                    placeholder="Enter current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white text-sm
                                        placeholder:text-gray-400 dark:placeholder:text-gray-500 pr-10
                                        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400
                                        transition-all duration-200 disabled:opacity-50"
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {strength && (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${strength.color} transition-all`}
                                            style={{ width: strength.width }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{strength.label}</span>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white text-sm
                                        placeholder:text-gray-400 dark:placeholder:text-gray-500 pr-10
                                        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400
                                        transition-all duration-200 disabled:opacity-50"
                                    placeholder="Confirm new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                            )}
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                <AlertCircle size={16} className="text-red-500 dark:text-red-400" />
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowChangePassword(false);
                                    setCurrentPassword("");
                                    setNewPassword("");
                                    setConfirmPassword("");
                                    setError("");
                                }}
                                className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl
                                    hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || newPassword.length < 8 || newPassword !== confirmPassword}
                                className="px-4 py-2.5 bg-[#18181b] dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded-xl
                                    hover:bg-[#27272a] dark:hover:bg-gray-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                                    flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                                {isSubmitting ? "Saving..." : "Update Password"}
                            </button>
                        </div>
                    </form>
                )}
            </SettingsCard>

            {/* Forgot Password Card */}
            <SettingsCard title="Forgot Current Password?">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    If you don't remember your current password, we can send a reset link to your email ({user?.email})
                </p>

                {resetEmailSent ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <Mail size={20} className="text-green-600 dark:text-green-400" />
                        <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-300">Email Sent</p>
                            <p className="text-xs text-green-600 dark:text-green-400">Check your inbox for the reset link</p>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleSendResetEmail}
                        disabled={sendingResetEmail}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl
                            hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all duration-200 disabled:opacity-50"
                    >
                        {sendingResetEmail ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Mail size={16} />
                                Send Reset Link
                            </>
                        )}
                    </button>
                )}
            </SettingsCard>

            {/* Active Sessions */}
            <SettingsCard title="Active Sessions">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Manage devices where you're currently logged in
                </p>
                <div className="space-y-3">
                    <SessionItem
                        icon={Laptop}
                        device="Current Device"
                        browser="This browser session"
                        location="Current location"
                        lastActive="Now"
                        current
                    />
                </div>
            </SettingsCard>

            {/* Security Tips */}
            <SettingsCard title="Security Tips">
                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <Lock size={18} className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Use a strong password</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                At least 12 characters with a mix of letters, numbers, and symbols
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                        <Shield size={18} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Don't reuse passwords</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Use a unique password for each of your accounts
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsCard>
        </motion.div>
    );
}
