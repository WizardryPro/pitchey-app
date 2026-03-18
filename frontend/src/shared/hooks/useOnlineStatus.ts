import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

/**
 * Returns the current online/offline status of the browser.
 * Uses `useSyncExternalStore` per React docs recommendation.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
