import { useState } from "react";
import { Plus } from "lucide-react";
import { ViewToggle } from "../components/ViewToggle";
import { OrganizationView } from "../components/OrganizationView";
import { PersonalView } from "../components/PersonalView";
import { OrganizationSwitcher } from "../../organization/components/OrganizationSwitcher";
import { CreateTaskModal } from "../../tasks/components/CreateTaskModal";
import { useAuth } from "../../auth/context/AuthContext";

export function MainDashboardPage() {
    const { user } = useAuth();
    const [view, setView] = useState<"personal" | "org">("org");
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

    const isManager = user?.role === "manager";

    return (
        <div className="h-full flex flex-col p-0 w-full overflow-y-auto custom-scrollbar relative">
            {/* Header Bar - Flex container with bottom alignment */}
            <div className="absolute top-8 left-8 right-8 z-50 flex items-end justify-between">
                {/* View Toggle - Left */}
                <ViewToggle view={view} onChange={setView} />

                {/* Organization Switcher - Right */}
                <OrganizationSwitcher />
            </div>

            {/* Manager Quick Create Button - Positioned above Kanban */}
            {isManager && (
                <div className="absolute top-[68px] left-1/2 -translate-x-1/2 z-40">
                    <button
                        onClick={() => setIsCreateTaskModalOpen(true)}
                        className="
                            flex items-center gap-2 px-5 py-2
                            bg-white/60 hover:bg-white/80
                            backdrop-blur-sm
                            border border-gray-200/60
                            rounded-full
                            text-sm font-medium text-gray-700 hover:text-gray-900
                            transition-all duration-200
                            shadow-sm hover:shadow
                        "
                    >
                        Create new Task
                        <Plus size={16} className="text-gray-500" />
                    </button>
                </div>
            )}

            {/* Content Area */}
            {/* Added pt-20 to push content down below absolute headers, but allowing full scroll */}
            <div className="flex-1 w-full pt-20">
                {view === "org" ? <OrganizationView /> : <PersonalView />}
            </div>

            {/* Create Task Modal */}
            <CreateTaskModal
                isOpen={isCreateTaskModalOpen}
                onClose={() => setIsCreateTaskModalOpen(false)}
            />
        </div>
    );
}
