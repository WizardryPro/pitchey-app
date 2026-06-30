import { AlertTriangle } from 'lucide-react';
import { useServiceStatusStore } from '../../../store/serviceStatusStore';

// App-wide degraded banner (R0.1). Shows when any API request returns a 5xx —
// e.g. a Neon compute-quota 402 now surfaces as a 503 from the public pitch
// endpoints, so an outage reads as "temporarily unavailable" here instead of as a
// silently-empty marketplace. Auto-hides on the next successful (non-5xx) response.
export function ServiceDegradedBanner() {
  const degraded = useServiceStatusStore((s) => s.degraded);
  const stale = useServiceStatusStore((s) => s.stale);
  if (!degraded) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[1000] bg-amber-500 text-white shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center text-sm font-medium">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
        {stale ? (
          <span>
            Showing recent cached results &mdash; live data is temporarily unavailable.
            We&rsquo;ll refresh automatically once it&rsquo;s back.
          </span>
        ) : (
          <span>
            We&rsquo;re having trouble reaching our servers. Some content may be temporarily
            unavailable &mdash; please try again shortly.
          </span>
        )}
      </div>
    </div>
  );
}

export default ServiceDegradedBanner;
