import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, BadgeCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_URL } from '@/config';

type Status = 'none' | 'requires_input' | 'processing' | 'verified' | 'canceled';

/**
 * Creator identity verification (Stripe Identity). OPT-IN — never required to
 * publish. Verifies the PERSON (real, named human) → unlocks the Silver tier;
 * distinct from pitch provenance, which seals the IDEA. Uses retrieve-on-return:
 * the backend reads the result on return, so no Stripe webhook is involved.
 */
export default function IdentityVerificationCard() {
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState<Status>('none');

  const refresh = async () => {
    try {
      const res = await fetch(`${API_URL}/api/identity/refresh`, { method: 'POST', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      const d = json?.data ?? json;
      setVerified(!!d?.verified);
      setStatus((d?.status as Status) ?? 'none');
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // Returning from the Stripe hosted flow: the session may still be 'processing'
    // for a beat, so re-check shortly after.
    const params = new URLSearchParams(window.location.search);
    if (params.get('identity') === 'return') {
      const t = setTimeout(() => { void refresh(); }, 1800);
      return () => clearTimeout(t);
    }
     
  }, []);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch(`${API_URL}/api/identity/start`, { method: 'POST', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      const url = (json?.data ?? json)?.url;
      if (url) { window.location.href = url; return; }
      toast.error('Could not start identity verification. Please try again.');
    } catch {
      toast.error('Could not start identity verification. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <BadgeCheck className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="text-xl font-bold tracking-tight text-gray-900">Identity verification</h3>
      </div>
      <p className="mb-5 pl-[3.05rem] text-sm text-gray-500">
        Confirm you're a real person to earn a verified badge. Optional — your pitches stay free to publish either way. We never store your ID; Stripe handles the check.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 pl-0.5 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
        </div>
      ) : verified ? (
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <ShieldCheck className="h-4 w-4" /> Identity verified
        </div>
      ) : (
        <div className="space-y-2">
          {status === 'processing' && (
            <p className="text-sm text-amber-600">Your verification is processing — check back shortly.</p>
          )}
          {(status === 'requires_input' || status === 'canceled') && (
            <p className="text-sm text-gray-500">Your last attempt didn't complete. You can try again.</p>
          )}
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
          >
            {starting && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'processing' || status === 'requires_input' || status === 'canceled' ? 'Try again' : 'Verify my identity'}
          </button>
        </div>
      )}
    </div>
  );
}
