import { useState, useMemo } from "react";
import { Plus, Calendar } from "lucide-react";
import { ViewToggle } from "../components/ViewToggle";
import { OrganizationView } from "../components/OrganizationView";
import { PersonalView } from "../components/PersonalView";
import { OrganizationSwitcher } from "../../organization/components/OrganizationSwitcher";
import { CreateTaskModal } from "../../tasks/components/CreateTaskModal";
import { PremiumCalendarModal } from "../components/PremiumCalendarModal";
import { useOrganization } from "../../organization/context/OrganizationContext";
import { useKanbanData } from "../hooks/useKanbanData";

export function MainDashboardPage() {
    const [view, setView] = useState<"personal" | "org">("org");
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [isOrgCalendarModalOpen, setIsOrgCalendarModalOpen] = useState(false);

    const { isManager, currentOrganization } = useOrganization();
    const { data: kanbanData } = useKanbanData(currentOrganization?.id);

    // Consolidate all tasks for the calendar view
    const allTasks = useMemo(() => {
        if (!kanbanData) return [];
        return [
            ...(kanbanData.pending_validation || []),
            ...(kanbanData.todo || []),
            ...(kanbanData.pending || []),
            ...(kanbanData.in_progress || []),
            ...(kanbanData.done || []),
        ];
    }, [kanbanData]);

    return (
        <div className="h-full flex flex-col p-0 w-full overflow-hidden relative">
            {/* Header Bar - Flex container with bottom alignment */}
            <div className="absolute top-8 left-8 right-8 z-50 flex items-end justify-between">
                {/* View Toggle - Left */}
                <ViewToggle view={view} onChange={setView} />

                {/* Organization Switcher - Right */}
                <OrganizationSwitcher />
            </div>

            {/* Manager Quick Actions - Positioned above Kanban */}
            {isManager && (
                <div className="absolute top-[68px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
                    <button
                        onClick={() => setIsCreateTaskModalOpen(true)}
                        className="
                            flex items-center gap-2 px-5 py-2
                            bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20
                            backdrop-blur-sm
                            border border-gray-200/60 dark:border-white/20
                            rounded-full
                            text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white
                            transition-all duration-200
                            shadow-sm hover:shadow
                        "
                    >
                        Create new Task
                        <Plus size={16} className="text-gray-500 dark:text-gray-400" />
                    </button>

                    {/* Organization Calendar Button - Only visible in Org View */}
                    {view === "org" && (
                        <button
                            onClick={() => setIsOrgCalendarModalOpen(true)}
                            className="
                                flex items-center justify-center w-10 h-10
                                bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20
                                backdrop-blur-sm
                                border border-gray-200/60 dark:border-white/20
                                rounded-full
                                text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white
                                transition-all duration-200
                                shadow-sm hover:shadow
                            "
                            title="Organization Calendar"
                        >
                            <Calendar size={18} />
                        </button>
                    )}
                </div>
            )}

            {/* Content Area */}
            {/* Added pt-20 to push content down below absolute headers, but allowing full scroll */}
            <div className="flex-1 w-full pt-20 min-h-0">
                {view === "org" ? <OrganizationView /> : <PersonalView />}
            </div>

            {/* Create Task Modal */}
            <CreateTaskModal
                isOpen={isCreateTaskModalOpen}
                onClose={() => setIsCreateTaskModalOpen(false)}
            />

            {/* Organization Calendar Modal */}
            <PremiumCalendarModal
                isOpen={isOrgCalendarModalOpen}
                onClose={() => setIsOrgCalendarModalOpen(false)}
                tasks={allTasks}
                viewMode="org"
            />
        </div>
    );
}
