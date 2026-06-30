import { create } from 'zustand';

// Global "is the backend degraded" signal (R0.1).
//
// Set by the api-client when a request returns a 5xx (e.g. a Neon compute-quota
// 402 now surfaces as a 503 from the public pitch endpoints instead of a fake-empty
// 200), and cleared on the next successful response. A single <ServiceDegradedBanner>
// subscribes to this so an outage reads as "temporarily unavailable" app-wide rather
// than rendering as a silently-empty marketplace.

// `stale` (R8) is a distinct degraded sub-state: the request succeeded (HTTP 200)
// but the worker served last-good CACHED discovery data because the live DB read
// failed (X-Pitchey-Stale header). The banner shows stale-specific copy so users
// know the data isn't live — separate from the generic 5xx "can't reach servers".
interface ServiceStatusState {
  degraded: boolean;
  stale: boolean;
  reason?: string;
  setDegraded: (degraded: boolean) => void;
  setStatus: (degraded: boolean, stale: boolean, reason?: string) => void;
}

export const useServiceStatusStore = create<ServiceStatusState>((set, get) => ({
  degraded: false,
  stale: false,
  reason: undefined,
  // Guard so a 2xx on every request doesn't churn subscribers when nothing changed.
  setStatus: (degraded: boolean, stale: boolean, reason?: string) => {
    const s = get();
    if (s.degraded !== degraded || s.stale !== stale || s.reason !== reason) {
      set({ degraded, stale, reason });
    }
  },
  // Back-compat: a plain degraded toggle clears any stale sub-state.
  setDegraded: (degraded: boolean) => {
    get().setStatus(degraded, false, degraded ? 'error' : undefined);
  },
}));
