import { useEffect, useState, useCallback } from 'react';
import { Handshake, Check, X, Reply, Flag, CheckCircle2, MessageSquare } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { formatNumber } from '@shared/utils/formatters';
import DealThread from '../deals/DealThread';

// Creator Deal Inbox (moat #6) — production deals proposed to the creator, with
// accept / counter / reject. Self-contained; renders null when there are no deals
// so it never clutters the dashboard.
//
// Phase 1 disintermediation defense (deal system-of-record): each deal can also
// have its OUTCOME marked (closed on/off platform, or dead) by either party, with
// the counterparty confirming — capturing the result even when money moves off
// Pitchey. Bilateral confirmation feeds the Phase 2 reputation loop.

type Outcome = 'closed_on_platform' | 'closed_off_platform' | 'dead';

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
  outcome: Outcome | null;
  outcome_amount: number | null;
  outcome_terms: string | null;
  closed_at: string | null;
  outcome_confirmed_by_creator: boolean;
  outcome_confirmed_by_production: boolean;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  inquiry: { label: 'New offer', cls: 'bg-purple-100 text-purple-700' },
  negotiation: { label: 'In negotiation', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Declined', cls: 'bg-gray-100 text-gray-500' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  closed_on_platform: 'Closed on Pitchey',
  closed_off_platform: 'Closed off-platform',
  dead: 'Deal died',
};

const OUTCOME_OPTIONS: Array<{ value: Outcome; label: string }> = [
  { value: 'closed_on_platform', label: 'Closed on Pitchey' },
  { value: 'closed_off_platform', label: 'Closed off-platform' },
  { value: 'dead', label: 'Deal died / no deal' },
];

export default function CreatorDealInbox() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  // Outcome form state (one deal open at a time).
  const [outcomeFor, setOutcomeFor] = useState<number | null>(null);
  const [outcomeValue, setOutcomeValue] = useState<Outcome>('closed_off_platform');
  const [outcomeAmount, setOutcomeAmount] = useState('');
  const [outcomeTerms, setOutcomeTerms] = useState('');
  const [outcomeDate, setOutcomeDate] = useState('');
  const [threadFor, setThreadFor] = useState<number | null>(null);

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

  const resetOutcomeForm = useCallback(() => {
    setOutcomeFor(null);
    setOutcomeValue('closed_off_platform');
    setOutcomeAmount('');
    setOutcomeTerms('');
    setOutcomeDate('');
  }, []);

  const submitOutcome = useCallback(async (id: number, payload: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await apiClient.post(`/api/creator/deals/${id}/outcome`, payload);
      resetOutcomeForm();
      await load();
    } catch {
      /* best-effort; list reload reflects truth */
    } finally {
      setBusyId(null);
    }
  }, [load, resetOutcomeForm]);

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
          const isMarkingOutcome = outcomeFor === d.id;
          const hasOutcome = d.outcome !== null;
          const mutuallyConfirmed = d.outcome_confirmed_by_creator && d.outcome_confirmed_by_production;
          const needsCreatorConfirm = hasOutcome && !d.outcome_confirmed_by_creator;
          return (
            <li key={d.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{d.pitch_title ?? 'Your pitch'}</span>
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${status.cls}`}>{status.label}</span>
                    {hasOutcome && (
                      <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                        {OUTCOME_LABEL[d.outcome as Outcome]}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {d.producer_name ?? 'A production company'} · <span className="capitalize">{d.deal_type}</span>
                    {d.amount ? ` · €${formatNumber(d.amount)}` : ''}
                    {d.backend_percentage ? ` · ${d.backend_percentage}% backend` : ''}
                  </div>
                  {hasOutcome && (
                    <div className="text-xs text-gray-500 mt-1">
                      {d.outcome_amount ? `Reported €${formatNumber(d.outcome_amount)}` : 'No amount reported'}
                      {d.outcome_terms ? ` · ${d.outcome_terms}` : ''}
                      {d.closed_at ? ` · closed ${new Date(d.closed_at).toLocaleDateString()}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Outcome confirmation state */}
              {hasOutcome && (
                <div className="mt-3">
                  {mutuallyConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> Outcome mutually confirmed
                    </span>
                  ) : needsCreatorConfirm ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">The producer recorded this outcome — confirm if it&apos;s accurate.</span>
                      <button
                        type="button" disabled={busyId === d.id}
                        onClick={() => submitOutcome(d.id, { outcome: d.outcome })}
                        className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirm outcome
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Awaiting the producer&apos;s confirmation</span>
                  )}
                </div>
              )}

              {/* Accept / counter / reject (early-pipeline only) */}
              {d.actionable && !isCountering && !isMarkingOutcome && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
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

              {/* Mark outcome trigger — available until an outcome is recorded */}
              {!hasOutcome && !isCountering && !isMarkingOutcome && (
                <div className="mt-3">
                  <button
                    type="button" disabled={busyId === d.id}
                    onClick={() => { setOutcomeFor(d.id); }}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-purple-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <Flag className="w-4 h-4" /> Mark outcome
                  </button>
                </div>
              )}

              {/* Counter form */}
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

              {/* Mark-outcome form */}
              {isMarkingOutcome && (
                <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                  <select
                    value={outcomeValue} onChange={(e) => setOutcomeValue(e.target.value as Outcome)}
                    aria-label="Deal outcome"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    {OUTCOME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {outcomeValue !== 'dead' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-500">€</span>
                      <input
                        type="number" value={outcomeAmount} onChange={(e) => setOutcomeAmount(e.target.value)}
                        aria-label="Final amount"
                        className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        placeholder="Final amount"
                      />
                      <input
                        type="date" value={outcomeDate} onChange={(e) => setOutcomeDate(e.target.value)}
                        aria-label="Close date"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                  )}
                  <input
                    type="text" value={outcomeTerms} onChange={(e) => setOutcomeTerms(e.target.value)}
                    aria-label="Reported terms"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    placeholder="Reported terms (optional)"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button" disabled={busyId === d.id}
                      onClick={() => submitOutcome(d.id, {
                        outcome: outcomeValue,
                        amount: outcomeValue !== 'dead' && outcomeAmount ? Number(outcomeAmount) : undefined,
                        terms: outcomeTerms || undefined,
                        closeDate: outcomeValue !== 'dead' && outcomeDate ? outcomeDate : undefined,
                      })}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
                    >
                      Save outcome
                    </button>
                    <button
                      type="button"
                      onClick={resetOutcomeForm}
                      className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Negotiation thread (P3) */}
              <div className="mt-3 border-t border-gray-100 pt-2">
                <button
                  type="button"
                  onClick={() => setThreadFor(threadFor === d.id ? null : d.id)}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-purple-700 text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" /> {threadFor === d.id ? 'Hide discussion' : 'Discuss'}
                </button>
                {threadFor === d.id && <DealThread dealId={d.id} />}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
