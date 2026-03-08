import { Info } from 'lucide-react';
import { useRef, useState } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [actualAlign, setActualAlign] = useState<'left' | 'right'>(align);

  const handleMouseEnter = () => {
    if (!containerRef.current) return;

    // Get the position of the tooltip container icon
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = 256; // 64 * 4px = 256px (w-64)

    // Check if the requested alignment would overflow the window
    if (align === 'right') {
      // If we want to align 'right' (tooltip stretches to the right), 
      // check if there's enough space on the right of the icon
      const spaceOnRight = window.innerWidth - rect.left;
      if (spaceOnRight < tooltipWidth && rect.right > tooltipWidth) {
        setActualAlign('left'); // Flip to left if no space on right but space on left
      } else {
        setActualAlign('right');
      }
    } else {
      // If we want to align 'left' (tooltip stretches to the left),
      // check if there's enough space on the left of the icon
      const spaceOnLeft = rect.right;
      if (spaceOnLeft < tooltipWidth && window.innerWidth - rect.left > tooltipWidth) {
        setActualAlign('right'); // Flip to right if no space on left but space on right
      } else {
        setActualAlign('left');
      }
    }
  };

  const handleMouseLeave = () => {
    // Optional: reset to default, but usually keeping it as is until next hover is fine
    // setActualAlign(align); 
  };

  const isLeft = actualAlign === 'left';

  return (
    <div
      ref={containerRef}
      className="absolute bottom-3 right-3 group/tooltip z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
