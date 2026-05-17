'use client';

import { useEffect, useState } from 'react';

export function usePersistentState(storageKey, initialValue) {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null) {
        setState(JSON.parse(saved));
      }
    } catch {
      setState(initialValue);
    }
  }, [storageKey, initialValue]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore storage failures so the UI still works.
    }
  }, [storageKey, state]);

  return [state, setState];
}
