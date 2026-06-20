import { useEffect, useState, useCallback } from 'react';
import { Handshake, Flag, Check, CheckCircle2, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { ProductionService } from '../services/production.service';
import { formatNumber } from '@shared/utils/formatters';

// Production Deals page (disintermediation defense P1 — deal system-of-record).
// The producer's view of deals they've proposed, with the both-sided "mark outcome"
// action: record how a deal actually ended (closed on/off platform, or dead) even
// when money moved off Pitchey. The creator confirms; bilateral confirmation feeds
// the Phase 2 reputation loop. Mirror of the creator-side CreatorDealInbox.

type Outcome = 'closed_on_platform' | 'closed_off_platform' | 'dead';

interface Deal {
  id: number;
  deal_type: string;
  status: string; // investment_deal_state
  amount: number;
  backend_percentage: number | null;
  notes: string | null;
  pitch_title: string | null;
  creator_name: string | null;
  created_at: string;
  outcome: Outcome | null;
  outcome_amount: number | null;
  outcome_terms: string | null;
  closed_at: string | null;
  outcome_confirmed_by_creator: boolean;
  outcome_confirmed_by_production: boolean;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  inquiry: { label: 'Proposed', cls: 'bg-purple-100 text-purple-700' },
  negotiation: { label: 'In negotiation', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Closed', cls: 'bg-gray-100 text-gray-500' },
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

export default function ProductionDeals() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<number | null>(null);
  const [outcomeValue, setOutcomeValue] = useState<Outcome>('closed_off_platform');
  const [outcomeAmount, setOutcomeAmount] = useState('');
  const [outcomeTerms, setOutcomeTerms] = useState('');
  const [outcomeDate, setOutcomeDate] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ deals: Deal[] }>('/api/production/deals');
      if (res?.success && res.data?.deals) setDeals(res.data.deals);
      else setDeals([]);
    } catch {
      setDeals([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resetOutcomeForm = useCallback(() => {
    setOutcomeFor(null);
    setOutcomeValue('closed_off_platform');
    setOutcomeAmount('');
    setOutcomeTerms('');
    setOutcomeDate('');
  }, []);

  const submitOutcome = useCallback(async (id: number, payload: {
    outcome: Outcome; amount?: number; terms?: string; closeDate?: string;
  }) => {
    setBusyId(id);
    try {
      await ProductionService.markDealOutcome(id, payload);
      resetOutcomeForm();
      await load();
    } catch {
      /* best-effort; list reload reflects truth */
    } finally {
      setBusyId(null);
    }
  }, [load, resetOutcomeForm]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Handshake className="w-6 h-6 text-brand-portal-production" />
        <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
      </div>

      {deals === null ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading deals…
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl ring-1 ring-gray-100">
          <Handshake className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No deals yet.</p>
          <p className="text-sm text-gray-400 mt-1">Propose a deal from a creator&apos;s pitch to get started.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {deals.map((d) => {
            const status = STATUS_LABEL[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' };
            const isMarkingOutcome = outcomeFor === d.id;
            const hasOutcome = d.outcome !== null;
            const mutuallyConfirmed = d.outcome_confirmed_by_creator && d.outcome_confirmed_by_production;
            const needsProductionConfirm = hasOutcome && !d.outcome_confirmed_by_production;
            return (
              <li key={d.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{d.pitch_title ?? 'Pitch'}</span>
                      <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${status.cls}`}>{status.label}</span>
                      {hasOutcome && (
                        <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                          {OUTCOME_LABEL[d.outcome as Outcome]}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {d.creator_name ?? 'Creator'} · <span className="capitalize">{d.deal_type}</span>
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
                    ) : needsProductionConfirm ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">The creator recorded this outcome — confirm if it&apos;s accurate.</span>
                        <button
                          type="button" disabled={busyId === d.id}
                          onClick={() => submitOutcome(d.id, { outcome: d.outcome as Outcome })}
                          className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm outcome
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Awaiting the creator&apos;s confirmation</span>
                    )}
                  </div>
                )}

                {/* Mark outcome trigger — available until an outcome is recorded */}
                {!hasOutcome && !isMarkingOutcome && (
                  <div className="mt-3">
                    <button
                      type="button" disabled={busyId === d.id}
                      onClick={() => setOutcomeFor(d.id)}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-brand-portal-production disabled:opacity-50 text-sm font-medium"
                    >
                      <Flag className="w-4 h-4" /> Mark outcome
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
                        className="bg-brand-portal-production hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5"
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
