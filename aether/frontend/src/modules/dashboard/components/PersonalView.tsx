import {
    Maximize2,
    AlertTriangle,
    Zap,
    Check,
    MessageCircle
} from "lucide-react";

// --- Types & Mock Data ---

interface TimelineDay {
    label: string;
    isCurrent?: boolean;
}

interface TimelineTask {
    id: string;
    title: string;
    column: number; // 0 (left), 1 (middle), 2 (right) - Simplified for grid placement
    topOffset: string; // '12px', '48px', etc.
    colorClass: string;
    widthClass: string;
}

const DAYS: TimelineDay[] = [
    { label: "9 Oct" },
    { label: "10 Oct", isCurrent: true },
    { label: "11 Oct" },
    { label: "12 Oct" },
    { label: "13 Oct" }
];

const MOCK_TIMELINE_DATA: TimelineTask[] = [
    {
        id: "t1",
        title: "Refactor sidebar navigation",
        column: 0,
        topOffset: "3rem", // top-12
        colorClass: "border-gray-300",
        widthClass: "w-40"
    },
    {
        id: "t2",
        title: "Update app documentation",
        column: 1,
        topOffset: "12rem", // top-48
        colorClass: "border-yellow-400",
        widthClass: "w-40"
    },
    {
        id: "t3",
        title: "Build API",
        column: 2,
        topOffset: "3rem", // top-12
        colorClass: "border-red-400",
        widthClass: "w-32"
    }
];

export function PersonalView() {
    return (
        <div className="p-8 h-full w-full overflow-hidden flex flex-col">
            {/* 
               Main Grid Layout 
               - grid-rows-[minmax(0,3fr)_minmax(0,2fr)]: Ensures rows allow content to shrink (overflow) 
                 instead of expanding to fit min-content (default behavior of 'fr' if not 0-bounded).
               - Items are placed directly in the grid cells to ensure horizontal compliance.
            */}
            <div className="grid grid-cols-12 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-8 h-full w-full">

                {/* --- In Progress Section (Top Left) --- */}
                <section className="col-span-8 row-start-1 bg-white/40 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 shadow-sm relative overflow-hidden flex flex-col min-h-0 h-full">
                    <div className="flex items-center justify-between mb-6 flex-shrink-0">
                        <h2 className="text-gray-500 font-medium text-lg">In Progress</h2>
                        <button className="text-gray-400 hover:text-gray-600 transition-colors">
                            <Maximize2 size={18} />
                        </button>
                    </div>

                    <div className="space-y-4 overflow-y-auto pr-2 -mr-2 flex-1 min-h-0">
                        <InProgressCard
                            title="Build API"
                            date="13 Oct"
                            tag="urgent"
                        />
                        <InProgressCard
                            title="UI for checkout page"
                            date="16 Oct"
                            tag="important"
                        />
                        <InProgressCard
                            title="Improve deployment script"
                            date="21 Oct"
                            tag="far-deadline"
                            isLast
                        />
                    </div>
                </section>

                {/* --- Deadlines Section (Bottom Left) --- */}
                <section className="col-span-8 row-start-2 pt-4 flex flex-col min-h-0 h-full">
                    <h2 className="text-gray-500 font-medium text-lg mb-8 pl-2 flex-shrink-0">Deadlines</h2>

                    {/* Timeline Visualization */}
                    <div className="relative w-full flex-1">
                        {/* Dates Row - Dynamic Rendering */}
                        <div className="flex justify-between px-4 text-xs font-medium text-gray-400 mb-4">
                            {DAYS.map((day) => (
                                <span
                                    key={day.label}
                                    className={`${day.isCurrent ? 'bg-gray-300/50 rounded-full px-2 py-1 text-gray-600' : ''}`}
                                >
                                    {day.label}
                                </span>
                            ))}
                        </div>

                        {/* Timeline Grid Lines - Dynamic Rendering */}
                        <div className="absolute top-8 left-0 w-full h-full flex justify-between px-6 pointer-events-none">
                            {DAYS.map((day, index) => (
                                <div
                                    key={`line-${index}`}
                                    className={`h-full ${day.isCurrent ? 'border-l border-gray-300 w-px' : 'border-l border-dashed border-gray-200 opacity-0'}`} // Keep opacity-0 for dashed to match original design unless intended to be visible
                                ></div>
                            ))}
                        </div>

                        {/* Floating Cards - Dynamic Rendering from Data */}
                        {MOCK_TIMELINE_DATA.map((task) => (
                            <div
                                key={task.id}
                                className="absolute"
                                style={{
                                    top: task.topOffset,
                                    left: task.column === 0 ? '0' : task.column === 1 ? '38%' : 'auto', // Simple mapping for now based on original constrained design
                                    right: task.column === 2 ? '0' : 'auto'
                                }}
                            >
                                <div className={`bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-sm border-l-4 ${task.colorClass} ${task.widthClass}`}>
                                    <span className="text-[10px] text-gray-800 font-medium leading-tight block">
                                        {task.title}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- Assigned Section (Top Right) --- */}
                <section className="col-span-4 row-start-1 bg-white/40 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 shadow-sm flex flex-col min-h-0 h-full">
                    <h2 className="text-gray-500 font-medium text-lg mb-6 flex-shrink-0">Assigned</h2>

                    {/* 
                       Scrollbar Refinement: 
                       pr-7 (-mr-7) moves scrollbar 4px from edge.
                       Added min-h-0 to ensure flex child can shrink below min-content size to trigger scroll.
                    */}
                    <div className="space-y-4 overflow-y-auto pr-7 -mr-7 flex-1 min-h-0">
                        <AssignedCard
                            name="John Sculley"
                            action="Set up CI/CD pipeline"
                            date="21 Oct"
                        />
                        <AssignedCard
                            name="John Sculley"
                            action="Create webhook for orders"
                            date="21 Oct"
                        />
                        <AssignedCard
                            name="Steve Jobs"
                            action="re-build the middleware"
                            date="28 Oct"
                        />
                        <AssignedCard
                            name="Tim Cook"
                            action="Optimize database queries"
                            date="29 Oct"
                        />
                    </div>
                </section>

                {/* --- Awaiting Review Section (Bottom Right) --- */}
                <section className="col-span-4 row-start-2 bg-white/40 backdrop-blur-xl rounded-[40px] p-8 border border-white/40 shadow-sm flex flex-col min-h-0 h-full">
                    <h2 className="text-gray-500 font-medium text-lg mb-6 flex-shrink-0">Awaiting Review</h2>

                    <div className="bg-white/60 backdrop-blur-md rounded-[28px] p-4 px-6 shadow-sm border border-white/50 flex items-center justify-between hover:scale-[1.01] transition-transform duration-200 group">
                        <div className="flex flex-col justify-center">
                            <h3 className="text-gray-800 font-semibold text-sm tracking-tight leading-snug">
                                Analyze PRs for performance risks
                            </h3>
                            <div className="mt-1">
                                <span className="text-xs text-gray-400 font-medium">8 Oct</span>
                            </div>
                        </div>

                        <button className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-green-500 transition-colors flex-shrink-0 ml-4">
                            <Check size={14} />
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
}

// --- Sub Components ---

function InProgressCard({ title, date, tag, isLast }: { title: string, date: string, tag: 'urgent' | 'important' | 'far-deadline', isLast?: boolean }) {

    const tagStyles = {
        urgent: { bg: "bg-red-100", text: "text-red-500", icon: AlertTriangle, label: "urgent" },
        important: { bg: "bg-orange-100", text: "text-orange-500", icon: Zap, label: "important" },
        "far-deadline": { bg: "bg-green-100", text: "text-green-600", icon: MessageCircle, label: "far deadline" } // Using MessageCircle as placeholder for that speech bubble icon
    };

    const style = tagStyles[tag];
    const Icon = style.icon;

    return (
        <div className={`bg-white/60 backdrop-blur-lg rounded-[28px] p-4 px-6 flex items-center justify-between shadow-sm border border-white/50 hover:scale-[1.01] transition-transform duration-200 group ${isLast ? '' : ''}`}>
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold shadow-md group-hover:bg-gray-900">
                    J
                </div>
                <span className="text-gray-800 font-semibold text-sm tracking-tight">{title}</span>
            </div>

            <div className="flex items-center gap-6">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${style.bg} ${style.text}`}>
                    <Icon size={12} fill="currentColor" className="opacity-80" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{style.label}</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">{date}</span>
            </div>
        </div>
    )
}

function AssignedCard({ name, action, date }: { name: string, action: string, date: string }) {
    return (
        // Unified styling: Matches InProgressCard (rounded-28px, p-4)
        <div className="bg-white/60 backdrop-blur-lg rounded-[28px] p-4 px-5 shadow-sm border border-white/50 hover:scale-[1.02] transition-all duration-200">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                    J
                </div>
                <span className="text-xs text-gray-500">
                    by <span className="text-gray-800 font-bold">{name}</span>
                </span>
            </div>

            <div className="pl-7">
                <p className="text-gray-600 text-[13px] font-medium leading-relaxed mb-2">
                    {action}
                </p>
                <div className="flex justify-end">
                    <span className="text-[10px] text-gray-400 font-medium">{date}</span>
                </div>
            </div>
        </div>
    )
}
