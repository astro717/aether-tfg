import { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface PremiumDatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: Date;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function PremiumDatePicker({
  value,
  onChange,
  placeholder = "Select a date",
  minDate,
}: PremiumDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse selected date
  const selectedDate = useMemo(() => {
    return value ? new Date(value) : null;
  }, [value]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding (fill to 42 cells for 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewDate]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (date: Date) => {
    // Fix: Use local date components into YYYY-MM-DD to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localIsoDate = `${year}-${month}-${day}`;

    onChange(localIsoDate);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isDisabled = (date: Date) => {
    if (!minDate) return false;
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const minDateOnly = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    return dateOnly < minDateOnly;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-2 px-4 py-3
          bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl
          text-sm cursor-pointer transition-all
          ${isOpen ? "ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500" : "hover:bg-gray-100 dark:hover:bg-zinc-700"}
        `}
      >
        <Calendar size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <span className={`flex-1 ${value ? "text-gray-800 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        {value && (
          <button
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X size={14} className="text-gray-400 dark:text-gray-500" />
          </button>
        )}
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div
          className="premium-calendar absolute top-full left-0 mt-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-zinc-700/60 rounded-2xl shadow-xl z-50 p-4 w-[300px]"
          style={{
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="w-9 h-8 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const disabled = isDisabled(date);
              const selected = isSelected(date);
              const today = isToday(date);

              return (
                <button
                  key={index}
                  onClick={() => !disabled && isCurrentMonth && handleSelectDate(date)}
                  disabled={disabled || !isCurrentMonth}
                  className={`
                    premium-calendar-day
                    ${selected ? "selected" : ""}
                    ${today && !selected ? "today" : ""}
                    ${disabled ? "disabled" : ""}
                    ${!isCurrentMonth ? "other-month" : "text-gray-700 dark:text-gray-300"}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-zinc-700">
            <button
              onClick={() => handleSelectDate(new Date())}
              className="text-xs font-medium text-[#007AFF] hover:text-[#0066DD] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                handleSelectDate(nextWeek);
              }}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Next week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
