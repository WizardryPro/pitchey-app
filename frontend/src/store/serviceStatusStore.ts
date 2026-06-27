import { create } from 'zustand';

// Global "is the backend degraded" signal (R0.1).
//
// Set by the api-client when a request returns a 5xx (e.g. a Neon compute-quota
// 402 now surfaces as a 503 from the public pitch endpoints instead of a fake-empty
// 200), and cleared on the next successful response. A single <ServiceDegradedBanner>
// subscribes to this so an outage reads as "temporarily unavailable" app-wide rather
// than rendering as a silently-empty marketplace.

interface ServiceStatusState {
  degraded: boolean;
  setDegraded: (degraded: boolean) => void;
}

export const useServiceStatusStore = create<ServiceStatusState>((set, get) => ({
  degraded: false,
  // Guard so a 2xx on every request doesn't churn subscribers when nothing changed.
  setDegraded: (degraded: boolean) => {
    if (get().degraded !== degraded) set({ degraded });
  },
}));
