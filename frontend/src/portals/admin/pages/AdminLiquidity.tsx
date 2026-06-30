import React, { useState, useEffect } from 'react';
import { Gauge, Users, FileSignature, ArrowUpRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { adminService } from '../services/admin.service';

// Liquidity Gate — the pre-build trigger for the deal-servicing roadmap (R2.3).
// Reads four signals off live tables. Thresholds are DRAFT (advisory, tune with Karl);
// the gate verdict is a recommendation of WHEN to start the P5 deal-servicing build,
// NOT a decision. See docs/deal-servicing-roadmap-2026-06-27.md §5.

interface BuyersSignal { currentWeek: number; weeks: { week: string; count: number }[]; trendNonDecreasing: boolean; threshold: number; pass: boolean }
interface DealsSignal { currentMonth: number; months: { month: string; count: number }[]; threshold: number; pass: boolean }
interface OffPlatformSignal { rate: number; offPlatform: number; totalCloses: number; meaningfulLeakage: boolean; threshold: number }
interface ConfirmSignal { rate: number; confirmed: number; withOutcome: number; threshold: number; pass: boolean }
// R12 — cross-role NDA-intent graph density (the moat asset).
interface GraphDensity {
  degraded: boolean;
  ndaDensity?: {
    totalSigned: number;
    pitchesWithNda: number;
    meanPerEngagedPitch: number;
    distribution: { one: number; twoToThree: number; fourPlus: number };
  };
  crossRole?: { bothSides: number; investorOnly: number; productionOnly: number };
  intentToDeal?: { ndaEngagedPitches: number; convertedPitches: number; conversionRate: number; linkage: string };
  supplySignals?: { investorsWithThesis: number; publicTheses: number; collaborationsTotal: number; collaborationsLast30d: number };
}

interface LiquidityData {
  buyersSigningNdas: BuyersSignal;
  dealsReachingOutcome: DealsSignal;
  offPlatformCloseRate: OffPlatformSignal;
  mutualConfirmRate: ConfirmSignal;
  gate: { open: boolean; thresholdsAreDraft: boolean };
  graphDensity?: GraphDensity;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function StatusPill({ ok, okLabel = 'Met', noLabel = 'Not met' }: { ok: boolean; okLabel?: string; noLabel?: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3.5 h-3.5" /> {okLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      <XCircle className="w-3.5 h-3.5" /> {noLabel}
    </span>
  );
}

function SignalCard({
  icon: Icon, title, value, sub, pill, threshold, spark,
}: {
  icon: React.ElementType; title: string; value: string; sub: string;
  pill: React.ReactNode; threshold: string; spark?: { label: string; count: number }[];
}) {
  const max = spark && spark.length ? Math.max(...spark.map(s => s.count), 1) : 1;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-gray-500">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {pill}
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{sub}</div>
      {spark && spark.length > 0 && (
        <div className="flex items-end gap-1 h-12 mt-1" aria-hidden>
          {spark.map((s, i) => (
            <div key={i} className="flex-1 bg-purple-200 rounded-sm" style={{ height: `${Math.max(6, (s.count / max) * 100)}%` }} title={`${s.label}: ${s.count}`} />
          ))}
        </div>
      )}
      <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">Draft threshold: {threshold}</div>
    </div>
  );
}

// Observational metric card (no gate pill / threshold) — for the graph-density
// section, which measures the moat rather than gating a decision.
function MetricCard({ icon: Icon, title, value, sub }: {
  icon: React.ElementType; title: string; value: string; sub: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{sub}</div>
    </div>
  );
}

export default function AdminLiquidity() {
  const [data, setData] = useState<LiquidityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminService.getLiquidity()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!cancelled) setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const Header = (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Gauge className="w-6 h-6 text-purple-600" /> Liquidity Gate
      </h1>
      <p className="text-sm text-gray-500 max-w-3xl">
        The pre-build trigger for the deal-servicing roadmap (R2.3). When these signals fire, the
        deal-servicing build (binding e-sign → escrow/payouts → take-rate) is justified. Thresholds
        below are <span className="font-medium">draft — tune with Karl</span>; the verdict is advisory.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load liquidity signals: {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="space-y-6">{Header}</div>;

  const { buyersSigningNdas: b, dealsReachingOutcome: d, offPlatformCloseRate: o, mutualConfirmRate: m, gate } = data;

  return (
    <div className="space-y-6">
      {Header}

      {/* Advisory gate verdict */}
      <div className={`rounded-lg border p-5 flex items-start gap-3 ${gate.open ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {gate.open ? <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" /> : <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5" />}
        <div>
          <div className={`font-semibold ${gate.open ? 'text-green-800' : 'text-amber-800'}`}>
            Gate {gate.open ? 'OPEN — liquidity supports starting the deal-servicing build' : 'CLOSED — hold the deal-servicing build'}
          </div>
          <p className={`text-sm mt-1 ${gate.open ? 'text-green-700' : 'text-amber-700'}`}>
            {gate.open
              ? 'All four signals are met. Per the roadmap, P5.0 (binding e-sign) is the first slice. This is a recommendation — confirm with Karl before starting.'
              : 'One or more signals are below the draft thresholds. Building deal-servicing onto sparse liquidity produces an empty, abandoned flow. Keep deepening demand first.'}
          </p>
          <p className="text-xs mt-2 opacity-70">Advisory only · thresholds are draft and unconfirmed.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SignalCard
          icon={Users}
          title="Buyers signing NDAs / wk"
          value={String(b.currentWeek)}
          sub={b.trendNonDecreasing ? 'Trend non-decreasing (8 wks)' : 'Trend not yet non-decreasing'}
          pill={<StatusPill ok={b.pass} />}
          threshold={`≥ ${b.threshold}/wk + rising`}
          spark={b.weeks.map(w => ({ label: w.week, count: w.count }))}
        />
        <SignalCard
          icon={FileSignature}
          title="Deals reaching outcome / mo"
          value={String(d.currentMonth)}
          sub="Terminal outcome recorded (6 mo)"
          pill={<StatusPill ok={d.pass} />}
          threshold={`≥ ${d.threshold}/mo`}
          spark={d.months.map(mo => ({ label: mo.month, count: mo.count }))}
        />
        <SignalCard
          icon={ArrowUpRight}
          title="Off-platform close rate"
          value={pct(o.rate)}
          sub={`${o.offPlatform} of ${o.totalCloses} closes off-platform`}
          pill={<StatusPill ok={o.meaningfulLeakage} okLabel="Worth capturing" noLabel="Low leakage" />}
          threshold={`≥ ${pct(o.threshold)} = ROI signal`}
        />
        <SignalCard
          icon={CheckCircle2}
          title="Mutual-confirm rate"
          value={pct(m.rate)}
          sub={`${m.confirmed} of ${m.withOutcome} outcomes co-confirmed`}
          pill={<StatusPill ok={m.pass} />}
          threshold={`≥ ${pct(m.threshold)}`}
        />
      </div>

      <p className="text-xs text-gray-400">
        The off-platform-close rate is the sharpest signal: a high rate means parties are closing the deals
        Pitchey introduced somewhere else — exactly the leakage on-platform deal-servicing is designed to capture.
        Source: live <code>ndas</code> + <code>production_deals</code> outcome columns (migration 114). No new schema.
      </p>

      {data.graphDensity && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cross-role NDA-intent graph density</h2>
            <p className="text-sm text-gray-500">The moat is this graph over time + liquidity. Read-only over live tables.</p>
          </div>

          {data.graphDensity.degraded ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
              Graph metrics unavailable — the database is degraded. (This is a failed read, not zero data.)
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={Users}
                  title="Cross-role pitches (both sides)"
                  value={String(data.graphDensity.crossRole?.bothSides ?? 0)}
                  sub={`Investor + production both signed · ${data.graphDensity.crossRole?.investorOnly ?? 0} investor-only · ${data.graphDensity.crossRole?.productionOnly ?? 0} production-only`}
                />
                <MetricCard
                  icon={FileSignature}
                  title="Honored NDAs / engaged pitch"
                  value={(data.graphDensity.ndaDensity?.meanPerEngagedPitch ?? 0).toFixed(2)}
                  sub={`${data.graphDensity.ndaDensity?.totalSigned ?? 0} signed across ${data.graphDensity.ndaDensity?.pitchesWithNda ?? 0} pitches`}
                />
                <MetricCard
                  icon={ArrowUpRight}
                  title="Intent → deal conversion"
                  value={pct(data.graphDensity.intentToDeal?.conversionRate ?? 0)}
                  sub={`${data.graphDensity.intentToDeal?.convertedPitches ?? 0} of ${data.graphDensity.intentToDeal?.ndaEngagedPitches ?? 0} NDA-engaged pitches have a deal`}
                />
                <MetricCard
                  icon={CheckCircle2}
                  title="Structured supply"
                  value={String(data.graphDensity.supplySignals?.investorsWithThesis ?? 0)}
                  sub={`${data.graphDensity.supplySignals?.publicTheses ?? 0} public theses · ${data.graphDensity.supplySignals?.collaborationsTotal ?? 0} collabs (${data.graphDensity.supplySignals?.collaborationsLast30d ?? 0} in 30d)`}
                />
              </div>
              <p className="text-xs text-gray-400">
                NDAs-per-engaged-pitch distribution: {data.graphDensity.ndaDensity?.distribution.one ?? 0} with 1 ·{' '}
                {data.graphDensity.ndaDensity?.distribution.twoToThree ?? 0} with 2–3 ·{' '}
                {data.graphDensity.ndaDensity?.distribution.fourPlus ?? 0} with 4+. The{' '}
                <strong>both-sides</strong> count is the defensible asset — a pitch where an investor AND a
                production company both signed an NDA. Source: live <code>ndas</code>, <code>users</code>,{' '}
                <code>production_deals</code>, <code>investor_thesis</code>, <code>collaborations</code>. No new schema.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
