import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

interface VerifyResult {
  sealed: boolean;
  sealed_at?: string;
  content_version?: number;
  creator_username?: string;
  pitch_title?: string;
  pitch_id?: number;
}

/**
 * Public provenance certificate page (/verify/p/:hash). Anyone with the hash can
 * confirm the pitch's content was sealed on Pitchey at a date — the artifact a
 * creator shows to prove priority of idea. Shows date/creator/title only; never
 * the protected content.
 */
export default function ProvenanceVerify() {
  const { hash = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/verify/p/${encodeURIComponent(hash)}`);
        const data = (await res.json().catch(() => ({ sealed: false }))) as VerifyResult;
        if (live) setResult(data);
      } catch {
        if (live) setResult({ sealed: false });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [hash]);

  const sealedDate = result?.sealed_at
    ? new Date(result.sealed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
            <Loader2 className="h-7 w-7 animate-spin" />
            Verifying certificate…
          </div>
        ) : result?.sealed ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Provenance verified</h1>
            <p className="mt-1 text-sm text-gray-500">
              This content was sealed on Pitchey and has not changed since.
            </p>

            <dl className="mt-6 divide-y divide-gray-100 text-left text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-400">Pitch</dt>
                <dd className="font-medium text-gray-900">
                  {result.pitch_id
                    ? <Link to={`/pitch/${result.pitch_id}`} className="text-indigo-600 hover:underline">{result.pitch_title}</Link>
                    : result.pitch_title}
                </dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-400">Creator</dt>
                <dd className="font-medium text-gray-900">@{result.creator_username}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-gray-400">Sealed on</dt>
                <dd className="font-medium text-gray-900">{sealedDate}</dd>
              </div>
              {result.content_version && result.content_version > 1 && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-gray-400">Version</dt>
                  <dd className="font-medium text-gray-900">v{result.content_version}</dd>
                </div>
              )}
              <div className="py-2.5">
                <dt className="text-gray-400 mb-1">Content hash (SHA-256)</dt>
                <dd className="font-mono text-[11px] break-all text-gray-600">{hash}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 ring-1 ring-inset ring-gray-200">
              <ShieldX className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-gray-900">No matching seal</h1>
            <p className="mt-1 text-sm text-gray-500">
              This hash doesn't match any sealed pitch on Pitchey. It may have been mistyped, or the content has changed since it was sealed.
            </p>
            <Link to="/" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">Back to Pitchey</Link>
          </div>
        )}
      </div>
    </div>
  );
}
