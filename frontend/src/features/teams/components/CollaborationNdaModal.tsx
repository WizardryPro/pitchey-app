import { useEffect, useState } from 'react';
import { X, Shield, Loader, CheckCircle } from 'lucide-react';
import apiClient from '../../../lib/api-client';
import { toast } from 'react-hot-toast';

interface CollaborationNdaModalProps {
  teamId: number;
  /** Company name — used for the disclosing-party autofill + copy. */
  company: string;
  /** Pre-fill the signer's legal name (e.g. the creator's account name). */
  defaultName?: string;
  onClose: () => void;
  /** Fired after a successful sign so the caller can refresh access state. */
  onSigned: () => void;
}

/**
 * One-screen click-to-sign for the company **collaboration NDA** (B3 Phase 2).
 * A creator who joined a production company via a code signs the Platform
 * Standard NDA once per company before the shared workspace unlocks. Distinct
 * from the credit-based, pitch-scoped access NDA. Renders the standard NDA text
 * (company autofill) + agree checkbox + legal name/address, POSTs to
 * `/api/teams/:id/collaboration-nda/sign`.
 */
export function CollaborationNdaModal({
  teamId, company, defaultName = '', onClose, onSigned,
}: CollaborationNdaModalProps) {
  const [content, setContent] = useState('');
  const [docName, setDocName] = useState('Pitchey Standard NDA');
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams({
      disclosingName: company,
      projectName: `all ${company} projects`,
    });
    if (defaultName) params.set('recipientName', defaultName);
    fetch(`${import.meta.env.VITE_API_URL}/api/ndas/standard?${params.toString()}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d?.success && d.data) {
          setContent(d.data.content || '');
          if (d.data.name) setDocName(d.data.name);
        } else {
          setLoadErr('Unable to load the NDA. Please try again.');
        }
      })
      .catch(() => live && setLoadErr('Unable to load the NDA. Please try again.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [company, defaultName]);

  const canSign = agreed && name.trim().length > 0 && !signing;

  const handleSign = async () => {
    if (!canSign) return;
    setSigning(true);
    try {
      const res: any = await apiClient.post(`/api/teams/${teamId}/collaboration-nda/sign`, {
        agreed: true,
        name: name.trim(),
        address: address.trim() || undefined,
      });
      const ok = res?.success ?? res?.data?.success;
      if (ok) {
        toast.success(`Signed — you can now collaborate with ${company}.`);
        onSigned();
        onClose();
      } else {
        toast.error(res?.error?.message || res?.error || 'Failed to sign the NDA.');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-inset ring-purple-100">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{docName}</h2>
              <p className="text-xs text-gray-500">Collaboration NDA with {company}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* NDA body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader className="mr-2 h-6 w-6 animate-spin" /> Loading…
            </div>
          ) : loadErr ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadErr}</div>
          ) : (
            <article className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <p className="mb-3 text-xs text-gray-500">
                You're signing once to collaborate on all of {company}'s projects. Blank lines
                (________________) are completed from the details you enter below.
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{content}</pre>
            </article>
          )}
        </div>

        {/* Sign block */}
        {!loading && !loadErr && (
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Full legal name <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Q. Creator"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Address <span className="text-gray-400">(optional)</span></span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, Country"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </label>
            </div>
            <label className="mt-3 flex items-start gap-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>I have read and agree to be bound by this Non-Disclosure Agreement.</span>
            </label>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleSign}
                disabled={!canSign}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signing ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Sign &amp; Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
