// Route: /admin/promo-codes
import { useState, useEffect, useCallback } from 'react';
import { Ticket, RefreshCw, Users, AlertCircle, Copy, Check, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { adminService, type PromoCodeReport } from '../services/admin.service';
import { toast } from 'react-hot-toast';
import { AdminPageHeader } from '../components/AdminPageHeader';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function UsageBar({ used, max }: { used: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const full = max != null && used >= max;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">
          {used}{max != null ? ` / ${max}` : ''} redeemed
        </span>
        {max != null && (
          <span className={full ? 'text-red-600 font-medium' : 'text-gray-500'}>
            {full ? 'Fully redeemed' : `${max - used} left`}
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-purple-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function cohortLabel(cohort: string): string {
  // 'film-industry' -> 'Film Industry'
  return cohort.split(/[-_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function InviteSection({ code, onSent }: { code: PromoCodeReport; onSent: () => void }) {
  const redeemed = code.used > 0 || code.redeemers.length > 0;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Enter a recipient name and email');
      return;
    }
    setSending(true);
    try {
      await adminService.sendPromoInvite(code.id, name.trim(), email.trim());
      toast.success(`Invite sent to ${name.trim()}`);
      setName('');
      setEmail('');
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  if (redeemed) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <CheckCircle2 className="w-4 h-4" />
        Redeemed{code.recipient ? ` · invited ${code.recipient}` : ''}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      {code.recipient ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="inline-flex items-center gap-1 text-blue-700 font-medium"><Send className="w-3.5 h-3.5" /> Sent</span>
            <span className="text-gray-700"> to {code.recipient}</span>
            {code.recipientEmail && <span className="text-gray-400"> ({code.recipientEmail})</span>}
            {code.sentAt && <span className="text-gray-400"> · {formatDate(code.sentAt)}</span>}
            <span className="text-gray-400"> · awaiting redemption</span>
          </div>
          <button
            onClick={() => { void send(); }}
            disabled={sending}
            className="text-xs text-purple-700 hover:text-purple-900 disabled:opacity-50"
            title="Re-send / reassign"
          >
            Resend / reassign below
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-2">Unassigned — send this code to a film-industry contact:</p>
      )}
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Recipient name"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@studio.com"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button
          onClick={() => { void send(); }}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send invite
        </button>
      </div>
    </div>
  );
}

function CodeCard({ code, onSent }: { code: PromoCodeReport; onSent: () => void }) {
  const pctLabel = code.percentOff != null ? `${code.percentOff}% off` : 'discount';
  const free = code.percentOff === 100;
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    void navigator.clipboard.writeText(code.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${free ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <code className="text-lg font-bold text-gray-900">{code.code}</code>
                <button
                  onClick={copyCode}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-purple-700 transition-colors"
                  title="Copy code to share with a recipient"
                >
                  {copied ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
                {code.cohort && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {cohortLabel(code.cohort)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {free ? 'Free access' : pctLabel}
                {!code.active && <span className="ml-2 text-red-600">(inactive)</span>}
                <span className="ml-2 text-gray-400">· recipients redeem it on the billing page</span>
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${free ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
            {pctLabel}
          </span>
        </div>
        <div className="mt-4">
          <UsageBar used={code.used} max={code.max} />
        </div>
        {code.cohort && (
          <div className="mt-4">
            <InviteSection code={code} onSent={onSent} />
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Users className="w-4 h-4" />
          Who signed up with this code
          <span className="text-gray-400 font-normal">({code.redeemers.length})</span>
        </div>
        {code.redeemers.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No redemptions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Signed up</th>
                  <th className="py-2 pr-4 font-medium">Redeemed</th>
                  <th className="py-2 font-medium text-right">Discount</th>
                </tr>
              </thead>
              <tbody>
                {code.redeemers.map((r, i) => (
                  <tr key={`${r.userId ?? 'unknown'}-${i}`} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-4 text-gray-900">{r.name ?? (r.userId ? `User #${r.userId}` : 'Unknown')}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.email ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-600">{formatDate(r.signedUpAt)}</td>
                    <td className="py-2 pr-4 text-gray-600">{formatDate(r.redeemedAt)}</td>
                    <td className="py-2 text-right text-gray-600">
                      {r.amountOff > 0 ? `€${(r.amountOff / 100).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [count, setCount] = useState(10);
  const [percentOff, setPercentOff] = useState(100);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await adminService.generatePromoCodes(count, percentOff);
      toast.success(`Generated ${res.count} code${res.count === 1 ? '' : 's'}`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate codes');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
        <Ticket className="w-4 h-4 text-purple-600" />
        Generate film-industry codes
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Mints single-use codes you can assign &amp; email to industry contacts. Creating codes consumes nothing.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">How many</span>
          <input
            type="number" min={1} max={50} value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Discount %</span>
          <input
            type="number" min={1} max={100} value={percentOff}
            onChange={(e) => setPercentOff(Math.max(1, Math.min(100, parseInt(e.target.value) || 100)))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </label>
        <button
          onClick={() => { void generate(); }}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
          Generate
        </button>
        <span className="text-xs text-gray-400">{percentOff === 100 ? 'Free access · max 50 total' : `${percentOff}% off · max 50 total`}</span>
      </div>
    </div>
  );
}

export default function AdminPromoCodes() {
  const [codes, setCodes] = useState<PromoCodeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getPromoCodes();
      setCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      <AdminPageHeader
        title="Promo Codes"
        subtitle="Launch + industry codes — copy a code to hand out; recipients redeem it on the billing page. Shows who has redeemed each."
        icon={Ticket}
        actions={
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <GeneratePanel onGenerated={() => void load()} />

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && codes.length === 0 ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
        </div>
      ) : !loading && codes.length === 0 && !error ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          No promo codes found in Stripe yet. Launch codes (<code className="text-gray-700">FreeThePitch100</code>,{' '}
          <code className="text-gray-700">LifesAPitch50</code>) and any cohort-tagged code (e.g. the film-industry
          codes from <code className="text-gray-700">scripts/stripe-create-industry-codes.sh</code>) appear here once created.
        </div>
      ) : (
        <div className="space-y-6">
          {codes.map((c) => (
            <CodeCard key={c.id} code={c} onSent={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}
