import { useEffect, useState, useCallback } from 'react';
import { Handshake, Check, X, Reply } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { formatNumber } from '@shared/utils/formatters';

// Creator Deal Inbox (moat #6) — production deals proposed to the creator, with
// accept / counter / reject. Self-contained; renders null when there are no deals
// so it never clutters the dashboard.

interface Deal {
  id: number;
  deal_type: string;
  status: string;
  amount: number;
  backend_percentage: number | null;
  notes: string | null;
  pitch_title: string | null;
  producer_name: string | null;
  actionable: boolean;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  inquiry: { label: 'New offer', cls: 'bg-purple-100 text-purple-700' },
  negotiation: { label: 'In negotiation', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Declined', cls: 'bg-gray-100 text-gray-500' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
};

export default function CreatorDealInbox() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterAmount, setCounterAmount] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ deals: Deal[] }>('/api/creator/deals');
      if (res?.success && res.data?.deals) setDeals(res.data.deals);
      else setDeals([]);
    } catch {
      setDeals([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = useCallback(async (id: number, action: 'accept' | 'reject' | 'counter', extra?: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await apiClient.post(`/api/creator/deals/${id}/respond`, { action, ...extra });
      setCounterFor(null);
      setCounterAmount('');
      await load();
    } catch {
      /* best-effort; list reload reflects truth */
    } finally {
      setBusyId(null);
    }
  }, [load]);

  if (deals === null || deals.length === 0) return null;

  return (
    <section data-testid="creator-deal-inbox" className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 mb-8">
      <div className="flex items-center gap-2 mb-5">
        <Handshake className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-bold text-gray-900">Deal Offers</h2>
        <span className="text-xs font-medium text-gray-400">{deals.length}</span>
      </div>

      <ul className="space-y-3">
        {deals.map((d) => {
          const status = STATUS_LABEL[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' };
          const isCountering = counterFor === d.id;
          return (
            <li key={d.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{d.pitch_title ?? 'Your pitch'}</span>
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {d.producer_name ?? 'A production company'} · <span className="capitalize">{d.deal_type}</span>
                    {d.amount ? ` · €${formatNumber(d.amount)}` : ''}
                    {d.backend_percentage ? ` · ${d.backend_percentage}% backend` : ''}
                  </div>
                </div>
              </div>

              {d.actionable && !isCountering && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button" disabled={busyId === d.id}
                    onClick={() => respond(d.id, 'accept')}
                    className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
                  >
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button
                    type="button" disabled={busyId === d.id}
                    onClick={() => { setCounterFor(d.id); setCounterAmount(String(d.amount || '')); }}
                    className="inline-flex items-center gap-1 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg px-3 py-1.5"
                  >
                    <Reply className="w-4 h-4" /> Counter
                  </button>
                  <button
                    type="button" disabled={busyId === d.id}
                    onClick={() => respond(d.id, 'reject')}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600 disabled:opacity-50 text-sm font-medium rounded-lg px-3 py-1.5"
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}

              {d.actionable && isCountering && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-gray-500">€</span>
                  <input
                    type="number" value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)}
                    aria-label="Counter amount"
                    className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    placeholder="Counter amount"
                  />
                  <button
                    type="button" disabled={busyId === d.id}
                    onClick={() => respond(d.id, 'counter', { counterAmount: Number(counterAmount) || undefined })}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
                  >
                    Send counter
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCounterFor(null); setCounterAmount(''); }}
                    className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
