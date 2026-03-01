import { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PremiumTimePickerProps {
    value: string;
    onChange: (time: string) => void;
    disabled?: boolean;
}

const COMMON_TIMES = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "20:00"
];

export function PremiumTimePicker({ value, onChange, disabled }: PremiumTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const toggleOpen = () => {
        if (!disabled) setIsOpen(!isOpen);
    };

    const handleSelect = (time: string) => {
        onChange(time);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-300 dark:hover:border-zinc-600"
                    }`}
            >
                <div className="flex items-center gap-2">
                    <Clock size={16} className={value ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
                    <span className={value ? "text-gray-900 dark:text-white font-medium" : "text-gray-400 dark:text-gray-500"}>
                        {value ? value : "Select Time"}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute z-50 w-full mt-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden"
                    >
                        <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 grid grid-cols-2 gap-1">
                            {COMMON_TIMES.map((time) => (
                                <button
                                    key={time}
                                    onClick={() => handleSelect(time)}
                                    type="button"
                                    className={`px-3 py-2 text-sm rounded-xl transition-colors text-center font-medium
                    ${value === time
                                            ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        }
                  `}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>

                        <div className="p-2 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20">
                            <input
                                type="time"
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                className="w-full text-center bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 dark:text-gray-300"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
        </div>
    );
}
