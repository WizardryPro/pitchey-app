import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Provenance {
  sealed_at: string;
  content_hash: string;
}

/**
 * "Sealed [date]" provenance badge. Proves the pitch's content existed on Pitchey
 * at a date (priority-of-idea) — protects the IDEA, distinct from the creator's
 * verification tier (which is about the PERSON). Links to the public certificate.
 * Renders nothing if the pitch was never sealed.
 */
export default function SealBadge({ provenance, className = '' }: { provenance?: Provenance | null; className?: string }) {
  if (!provenance?.sealed_at || !provenance?.content_hash) return null;

  const date = new Date(provenance.sealed_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Link
      to={`/verify/p/${provenance.content_hash}`}
      title="This pitch's content was sealed with a tamper-evident timestamp. Click to verify."
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      Sealed {date}
    </Link>
  );
}
