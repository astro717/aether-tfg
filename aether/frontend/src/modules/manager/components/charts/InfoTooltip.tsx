/**
 * InfoTooltip Component
 * Portal-based glassmorphism tooltip that escapes stacking context constraints.
 * Renders at document body level to appear above all sibling components.
 */

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export interface InfoTooltipContent {
  title: string;
  description: string;
}

interface InfoTooltipProps {
  content: InfoTooltipContent;
  /** Size variant for the info icon */
  size?: 'sm' | 'md';
}

export function InfoTooltip({ content, size = 'md' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const buttonPadding = size === 'sm' ? 'p-0.5' : 'p-0.5';

  const showTooltip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
    setIsVisible(true);
  }, []);

  const hideTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${buttonPadding} rounded-full text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors`}
        aria-label={content.title}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        <Info className={iconSize} />
      </button>

      {isVisible &&
        createPortal(
          <div
            className="fixed z-[9999] w-72 p-4 rounded-xl bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-700/50 animate-in fade-in duration-150"
            style={{
              top: position.top,
              left: position.left,
              transform: 'translateX(-50%)',
            }}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          >
            <h4 className="text-sm font-semibold text-white mb-2">{content.title}</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">{content.description}</p>
            {/* Arrow */}
            <div
              className="absolute w-3 h-3 bg-zinc-900/95 rotate-45 border-l border-t border-zinc-700/50"
              style={{
                top: -6,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
