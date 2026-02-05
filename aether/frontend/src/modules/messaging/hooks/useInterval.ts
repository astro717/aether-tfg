import { useEffect, useRef } from 'react';

/**
 * Custom hook for setting up intervals with proper cleanup.
 * The callback is memoized and the interval restarts when delay changes.
 *
 * @param callback - Function to call on each interval tick
 * @param delay - Interval delay in milliseconds, or null to pause
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const tick = () => {
      savedCallback.current();
    };

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
