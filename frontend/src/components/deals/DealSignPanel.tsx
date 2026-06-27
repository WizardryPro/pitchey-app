import { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldCheck, PenLine, AlertTriangle } from 'lucide-react';
import apiClient from '../../lib/api-client';

// Binding deal-sheet e-signature (deal-servicing P5.0). Deal-scoped, role-neutral —
// shared by the creator deal inbox and the production deals page, mounted next to
// DealThread. A co-signed, hash-sealed deal sheet living on Pitchey is the cheapest
// real on-platform lock-in: no payments, no take-rate — just switching cost.

interface DealSignature {
  party: 'creator' | 'production';
  signedName: string;
  signedAt: string;
  contentHash: string;
  matchesCurrent: boolean;
}

interface SignatureState {
  dealId: number;
  currentHash: string;
  algorithm: string;
  fullyExecuted: boolean;
  hasStaleSignature: boolean;
  viewerParty: 'creator' | 'production';
  viewerSigned: boolean;
  signatures: DealSignature[];
}

const PARTY_LABEL: Record<string, string> = { creator: 'Creator', production: 'Production' };
const shortHash = (h: string) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '');

export default function DealSignPanel({ dealId }: { dealId: number }) {
  const [state, setState] = useState<SignatureState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<SignatureState>(`/api/deals/${dealId}/signatures`);
      setState(res?.success && res.data ? res.data : null);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const sign = useCallback(async () => {
    if (!fullName.trim() || !agreed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<{ fullyExecuted: boolean }>(
        `/api/deals/${dealId}/sign`,
        { fullName: fullName.trim(), agreed: true },
      );
      if (!res?.success) {
        const msg = typeof res?.error === 'string' ? res.error : (res?.error as { message?: string } | undefined)?.message;
        setError(msg || 'Could not sign the deal sheet. Please try again.');
        return;
      }
      setFullName('');
      setAgreed(false);
      await load();
    } catch {
      setError('Could not sign the deal sheet. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [dealId, fullName, agreed, load]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading deal sheet…
      </div>
    );
  }
  if (!state) return null;

  const signedParties = new Set(state.signatures.filter(s => s.matchesCurrent).map(s => s.party));

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
      {/* Header — seal status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${state.fullyExecuted ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm font-medium text-gray-800">Binding deal sheet</span>
          {state.fullyExecuted ? (
            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-green-100 text-green-700">
              Fully executed
            </span>
          ) : (
            <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
              Awaiting signatures
            </span>
          )}
        </div>
        {state.currentHash && (
          <span className="font-mono text-[10px] text-gray-400" title={`${state.algorithm}: ${state.currentHash}`}>
            seal {shortHash(state.currentHash)}
          </span>
        )}
      </div>

      {/* Tamper warning */}
      {state.hasStaleSignature && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            A deal term changed after a party signed. Earlier signatures no longer match the current
            sheet and are shown as stale — re-sign to bind the updated terms.
          </p>
        </div>
      )}

      {/* Both-party signature status */}
      <ul className="mt-3 space-y-1.5">
        {(['creator', 'production'] as const).map((party) => {
          const sig = state.signatures.find(s => s.party === party);
          const current = signedParties.has(party);
          return (
            <li key={party} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{PARTY_LABEL[party]}</span>
              {sig ? (
                <span className={`text-xs ${current ? 'text-green-700' : 'text-amber-700'}`}>
                  {current ? 'Signed' : 'Signed (stale)'} · {sig.signedName}
                  <span className="text-gray-400"> · {new Date(sig.signedAt).toLocaleDateString()}</span>
                </span>
              ) : (
                <span className="text-xs text-gray-400">Not signed</span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Sign action — only the viewer's own side, only if they haven't signed the current sheet */}
      {state.viewerSigned ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-green-700">
          <ShieldCheck className="w-3.5 h-3.5" /> You signed this version as {PARTY_LABEL[state.viewerParty]}.
        </p>
      ) : (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <label className="block text-xs text-gray-500 mb-1" htmlFor={`sign-name-${dealId}`}>
            Type your full legal name to sign as {PARTY_LABEL[state.viewerParty]}
          </label>
          <input
            id={`sign-name-${dealId}`}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            placeholder="Full legal name"
          />
          <label className="mt-2 flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the deal terms shown above. My typed name is my electronic signature and
              binds the same as a handwritten one; this signature seals the current terms.
            </span>
          </label>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <button
            type="button"
            disabled={busy || !fullName.trim() || !agreed}
            onClick={() => void sign()}
            className="mt-2 inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
            Sign deal sheet
          </button>
        </div>
      )}
    </div>
  );
}
