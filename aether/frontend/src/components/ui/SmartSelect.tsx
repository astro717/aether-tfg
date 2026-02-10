import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, Loader2 } from "lucide-react";

export interface SmartSelectOption {
  id: string;
  label: string;
  avatar?: string;
}

interface SmartSelectProps {
  options: SmartSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  disabledValue?: SmartSelectOption;
}

export function SmartSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  loading = false,
  disabledValue,
}: SmartSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Find selected option
  const selectedOption = options.find((opt) => opt.id === value);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    } else if (e.key === "Enter" && filteredOptions.length > 0) {
      onChange(filteredOptions[0].id);
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  // Render disabled state with pre-selected value
  if (disabled && disabledValue) {
    return (
      <div className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl text-sm text-gray-600 dark:text-gray-400 cursor-not-allowed">
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
          {disabledValue.label.charAt(0).toUpperCase()}
        </div>
        <span>{disabledValue.label}</span>
        <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto">(assigned to you)</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button / Search Input */}
      <div
        onClick={() => !loading && setIsOpen(true)}
        className={`
          w-full flex items-center gap-2 px-4 py-3
          bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl
          text-sm text-gray-800 dark:text-white
          transition-all cursor-pointer
          ${isOpen ? "ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500" : "hover:bg-gray-100 dark:hover:bg-zinc-700"}
        `}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-gray-400 dark:text-gray-500 flex-1">
            <Loader2 size={14} className="animate-spin" />
            Loading members...
          </span>
        ) : isOpen ? (
          <>
            <Search size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search..."
              className="flex-1 bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 dark:text-white"
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : selectedOption ? (
          <span className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
              {selectedOption.label.charAt(0).toUpperCase()}
            </div>
            {selectedOption.label}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 flex-1">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={`text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && !loading && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-zinc-700/60 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50"
          style={{
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5)",
          }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
              {searchQuery ? "No results found" : "No options available"}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5
                  hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left
                  ${index === 0 ? "rounded-t-2xl" : ""}
                  ${index === filteredOptions.length - 1 ? "rounded-b-2xl" : ""}
                  ${value === option.id ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}
                `}
              >
                <span className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    {option.label.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-800 dark:text-white">{option.label}</span>
                </span>
                {value === option.id && (
                  <Check size={16} className="text-blue-500" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
