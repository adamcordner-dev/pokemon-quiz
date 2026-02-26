// ============================================
// useTimer Hook
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerParams {
  totalSeconds: number;
  onExpire: () => void;
  isPaused: boolean;
}

export function useTimer({ totalSeconds, onExpire, isPaused }: UseTimerParams) {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Always keep the callback ref up-to-date (avoids stale closures)
  onExpireRef.current = onExpire;

  // Reset when totalSeconds changes (new question)
  useEffect(() => {
    setTimeRemaining(totalSeconds);
    expiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (isPaused || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeRemaining]);

  // Fire onExpire once when time hits 0
  useEffect(() => {
    if (timeRemaining === 0 && !expiredRef.current && !isPaused) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, [timeRemaining, isPaused]);

  const percentRemaining = (timeRemaining / totalSeconds) * 100;

  const reset = useCallback(() => {
    setTimeRemaining(totalSeconds);
    expiredRef.current = false;
  }, [totalSeconds]);

  return { timeRemaining, percentRemaining, reset };
}
