'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_INTERVAL_MS = 10000;

export function useAutoRefresh(revalidators, intervalMs = DEFAULT_INTERVAL_MS) {
  const revalidatorsRef = useRef(revalidators);
  const refreshInFlightRef = useRef(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    revalidatorsRef.current = revalidators;
  }, [revalidators]);

  useEffect(() => {
    if (!Array.isArray(revalidatorsRef.current) || revalidatorsRef.current.length === 0) {
      return;
    }

    if (!intervalMs || intervalMs < 1000) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;
      if (!cancelled) {
        setIsRefreshing(true);
      }

      try {
        await Promise.all((revalidatorsRef.current || []).map((revalidate) => {
          if (typeof revalidate === 'function') {
            return revalidate();
          }
          return Promise.resolve();
        }));
        if (!cancelled) {
          setLastRefreshedAt(Date.now());
        }
      } finally {
        refreshInFlightRef.current = false;
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return {
    intervalMs,
    isEnabled: Boolean(intervalMs && intervalMs >= 1000),
    isRefreshing,
    lastRefreshedAt,
  };
}
