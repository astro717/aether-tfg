import { Info } from 'lucide-react';

interface MetricTooltipProps {
  title: string;
  description: React.ReactNode;
  /** Popover alignment: 'left' opens above-left, 'right' opens above-right */
  align?: 'left' | 'right';
}

/**
 * Glassmorphism tooltip for KPI metric cards.
 * Position the parent container as `relative` and this component
 * aligns to bottom-right of the card.
 */
export function MetricTooltip({ title, description, align = 'left' }: MetricTooltipProps) {
  const isLeft = align === 'left';

  return (
    <div className="absolute bottom-3 right-3 group/tooltip z-50">
      <button
        type="button"
        className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
        aria-label={title}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {/* Glassmorphism Popover */}
      <div
        className={`absolute bottom-full mb-2 w-64 p-4 rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 bg-zinc-900/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50 ${isLeft ? 'right-0' : 'left-0'
          }`}
      >
        <h4 className="text-sm font-semibold text-white mb-2">{title}</h4>
        <p className="text-xs text-zinc-300 leading-relaxed">{description}</p>
        {/* Arrow pointing down */}
        <div
          className={`absolute -bottom-1.5 w-3 h-3 bg-zinc-900/95 dark:bg-zinc-900/95 rotate-45 border-r border-b border-zinc-700/50 ${isLeft ? 'right-3' : 'left-3'
            }`}
        />
      </div>
    </div>
  );
}
