// Route: /admin/promo-codes
import { useState, useEffect, useCallback } from 'react';
import { Ticket, RefreshCw, Users, AlertCircle } from 'lucide-react';
import { adminService, type PromoCodeReport } from '../services/admin.service';

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

function CodeCard({ code }: { code: PromoCodeReport }) {
  const pctLabel = code.percentOff != null ? `${code.percentOff}% off` : 'discount';
  const free = code.percentOff === 100;
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${free ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <code className="text-lg font-bold text-gray-900">{code.code}</code>
              <p className="text-sm text-gray-500">
                {free ? 'Free access' : pctLabel}
                {!code.active && <span className="ml-2 text-red-600">(inactive)</span>}
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
          <p className="text-gray-600 mt-1">Launch codes and who has redeemed them.</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

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
          No promo codes found in Stripe yet. Once <code className="text-gray-700">FreeThePitch100</code> and{' '}
          <code className="text-gray-700">LifesAPitch50</code> are created, they'll appear here.
        </div>
      ) : (
        <div className="space-y-6">
          {codes.map((c) => (
            <CodeCard key={c.id} code={c} />
          ))}
        </div>
      )}
    </div>
  );
}
