import { useState, useEffect, useRef } from "react";
import { Search, X, CheckSquare, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type Task } from "../../modules/dashboard/api/tasksApi";
import { type Conversation } from "../../modules/messaging/api/messagingApi";

interface SidebarSearchProps {
    tasks: Task[];
    conversations: Conversation[];
    onNavigate?: () => void;
}

type SearchResult = {
    id: string;
    type: "task" | "conversation";
    title: string; // Task title or Username
    subtitle?: string; // Task status or last message
    data: Task | Conversation;
};

export function SidebarSearch({ tasks, conversations, onNavigate }: SidebarSearchProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter logic
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();

        const taskResults: SearchResult[] = tasks
            .filter(t => t.title.toLowerCase().includes(lowerQuery) || String(t.readable_id).toLowerCase().includes(lowerQuery))
            .map(t => ({
                id: t.id,
                type: "task",
                title: t.title,
                subtitle: `#${t.readable_id} • ${t.status.replace('_', ' ')}`,
                data: t
            }));

        const conversationResults: SearchResult[] = conversations
            .filter(c => c.user.username?.toLowerCase().includes(lowerQuery))
            .map(c => ({
                id: c.user.id,
                type: "conversation",
                title: c.user.username || "Unknown User",
                subtitle: c.lastMessage.content || undefined,
                data: c
            }));

        setResults([...conversationResults, ...taskResults].slice(0, 8)); // Limit to 8 results
    }, [query, tasks, conversations]);

    const handleSelect = (result: SearchResult) => {
        if (result.type === "task") {
            navigate(`/tasks/${result.id}`);
        } else {
            navigate(`/messages?user=${result.id}`);
        }
        setQuery("");
        setIsOpen(false);
        onNavigate?.();
    };

    return (
        <div ref={containerRef} className="relative z-50">
            <div className="relative">
                <Search
                    className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isOpen ? "text-blue-500" : "text-gray-400"}`}
                    size={15}
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search"
                    className="
                        w-full h-9 pl-9 pr-9
                        bg-gray-100 hover:bg-gray-200/60
                        rounded-full
                        text-sm text-gray-900
                        placeholder:text-gray-500
                        outline-none
                        border-none
                        focus:bg-white focus:ring-2 focus:ring-blue-100 focus:shadow-sm
                        transition-all duration-200
                    "
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery("");
                            setIsOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition-all"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && query.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[280px]">
                    {results.length > 0 ? (
                        <div className="py-2">
                            {/* Group logic if needed, or flat list with icons */}
                            {results.map((result) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleSelect(result)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-3 group transition-colors"
                                >
                                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${result.type === 'task'
                                        ? 'bg-blue-50 text-blue-500 group-hover:bg-blue-100'
                                        : 'bg-purple-50 text-purple-500 group-hover:bg-purple-100'
                                        }`}>
                                        {result.type === 'task' ? <CheckSquare size={16} /> : <MessageSquare size={16} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                                {result.type === 'task' ? 'TASK' : 'CHAT'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Search size={20} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-900 font-medium">No results found</p>
                            <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
                        </div>
                    )}

                    {/* Footer / Tip */}
                    <div className="bg-gray-50 px-4 py-2 text-[10px] text-gray-400 flex items-center justify-between border-t border-gray-100">
                        <span>Search tasks by name or ID (#123)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
