import { useState } from "react";
import { ViewToggle } from "../components/ViewToggle";
import { OrganizationView } from "../components/OrganizationView";
import { PersonalView } from "../components/PersonalView";
import { OrganizationSwitcher } from "../../organization/components/OrganizationSwitcher";

export function MainDashboardPage() {
    const [view, setView] = useState<"personal" | "org">("org");

    return (
        <div className="h-full flex flex-col p-0 w-full overflow-y-auto custom-scrollbar relative">
            {/* Header Areas - Absolute Positioning for Alignment */}

            {/* View Toggle - Top Left, aligned with content top */}
            <div className="absolute top-8 left-8 z-50">
                <ViewToggle view={view} onChange={setView} />
            </div>

            {/* Organization Switcher - Top Right */}
            <div className="absolute top-8 right-8 z-50">
                <OrganizationSwitcher />
            </div>

            {/* Content Area */}
            {/* Added pt-20 to push content down below absolute headers, but allowing full scroll */}
            <div className="flex-1 w-full pt-20">
                {view === "org" ? <OrganizationView /> : <PersonalView />}
            </div>
        </div>
    );
}
