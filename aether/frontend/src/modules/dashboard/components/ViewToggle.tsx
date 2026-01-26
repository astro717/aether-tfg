import { User, Building2 } from "lucide-react";

interface ViewToggleProps {
    view: "personal" | "org";
    onChange: (view: "personal" | "org") => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
    return (
        <div className="relative flex items-center p-1 bg-gray-100/50 backdrop-blur-sm rounded-full w-fit">
            {/* Sliding Background */}
            <div
                className={`absolute h-[calc(100%-8px)] w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-all duration-300 ease-out ${view === "org" ? "translate-x-[calc(100%)]" : "translate-x-0"
                    }`}
            />

            <button
                onClick={() => onChange("personal")}
                className={`relative z-10 flex items-center justify-center w-11 h-11 transition-colors duration-200 ${view === "personal" ? "text-[#007AFF]" : "text-gray-400 hover:text-gray-600"
                    }`}
                title="Personal View"
            >
                {/* User Icon - Filled style by using fill="currentColor" if appropriate or just the icon */}
                <User size={20} className={view === "personal" ? "fill-current" : ""} strokeWidth={2.5} />
            </button>
            <button
                onClick={() => onChange("org")}
                className={`relative z-10 flex items-center justify-center w-11 h-11 transition-colors duration-200 ${view === "org" ? "text-[#007AFF]" : "text-gray-400 hover:text-gray-600"
                    }`}
                title="Organization View"
            >
                <Building2 size={20} strokeWidth={2.5} />
            </button>
        </div>
    );
}
