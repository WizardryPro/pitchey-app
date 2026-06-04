import { useEffect, useState } from 'react';
import { Users, KeyRound, Copy, Check, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

async function api(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`${API}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body } as { ok: boolean; status: number; body: any };
  } catch {
    // Network failure (or an unmocked fetch in tests) — degrade gracefully rather
    // than throwing an unhandled rejection. All callers handle ok:false.
    return { ok: false, status: 0, body: {} as any };
  }
}

/**
 * Creator-side: redeem a production company's join code to become a seated member
 * (B3). Posts to /api/teams/join.
 */
export function JoinCompanyCard() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    const { ok, status, body } = await api('/api/teams/join', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });
    setBusy(false);
    if (ok) {
      setMsg({ kind: 'ok', text: `You've joined ${body?.data?.teamName || 'the production company'}.` });
      setCode('');
    } else {
      const text =
        status === 404 ? 'That code is invalid or expired.' :
        status === 409 ? "You're already a member of this company." :
        status === 403 ? (body?.error || 'You cannot join with this code.') :
        body?.error || 'Could not join. Please try again.';
      setMsg({ kind: 'err', text });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Join a Production Company</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Got a join code from a production company? Enter it to collaborate on their projects.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ENTER CODE"
          maxLength={12}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg uppercase tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
      {msg && (
        <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </div>
  );
}

/**
 * Production-side: generate/rotate and share a join code so creators can join the
 * company team (B3). Resolves the company team via /api/teams, reads/sets the code.
 */
export function CompanyJoinCodeCard() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [seats, setSeats] = useState<{ used: number; limit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { ok, body } = await api('/api/teams');
      if (!ok) return;
      const teams = body?.data?.teams || body?.teams || [];
      const company = teams.find((t: any) => t.is_company_team) || teams[0];
      if (!company) return;
      setTeamId(company.id);
      const codeRes = await api(`/api/teams/${company.id}/code`);
      if (codeRes.ok) {
        setCode(codeRes.body?.data?.code ?? null);
        setSeats({ used: codeRes.body?.data?.seatsUsed ?? 0, limit: codeRes.body?.data?.seatLimit ?? 0 });
      }
    })();
  }, []);

  const generate = async () => {
    if (!teamId) return;
    setBusy(true);
    setErr(null);
    const { ok, body } = await api(`/api/teams/${teamId}/generate-code`, { method: 'POST' });
    setBusy(false);
    if (ok) {
      setCode(body?.data?.code ?? null);
      setSeats({ used: body?.data?.seatsUsed ?? 0, limit: body?.data?.seatLimit ?? 0 });
    } else {
      setErr(body?.error || 'Could not generate a code.');
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  if (teamId === null) return null; // no company team yet — nothing to show

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Invite Creators (Join Code)</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Share this code with creators so they can join your company and collaborate on your pitches.
        {seats && <span className="ml-1 font-medium text-gray-700">{seats.used}/{seats.limit} seats used.</span>}
      </p>
      {code ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono tracking-widest text-lg text-gray-900">{code}</code>
          <button onClick={copy} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Copy code">
            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-600" />}
          </button>
          <button onClick={generate} disabled={busy} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50" title="Generate a new code (revokes the old one)">
            <RefreshCw className={`w-5 h-5 text-gray-600 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      ) : (
        <button onClick={generate} disabled={busy} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {busy ? 'Generating…' : 'Generate Join Code'}
        </button>
      )}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
