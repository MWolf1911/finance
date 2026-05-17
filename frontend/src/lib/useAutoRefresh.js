'use client';

import { useEffect } from 'react';

const DEFAULT_INTERVAL_MS = 10000;

export function useAutoRefresh(revalidators, intervalMs = DEFAULT_INTERVAL_MS) {
  useEffect(() => {
    if (!Array.isArray(revalidators) || revalidators.length === 0) {
      return;
    }

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      for (const revalidate of revalidators) {
        if (typeof revalidate === 'function') {
          revalidate();
        }
      }
    };

    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, revalidators]);
}
