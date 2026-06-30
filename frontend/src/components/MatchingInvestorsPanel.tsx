// MatchingInvestorsPanel — the creator-facing demand signal (moat #7 phase 2).
// Shows public investor theses whose genres include this pitch's genre, so a creator
// can see which investors' stated mandates match their work, then expand to read the
// full published thesis (positioning + the structured mandate taxonomy). Self-
// contained and non-intrusive: renders nothing while loading, on error, or when
// there are no matches.
//
// Privacy: this surface shows only the PUBLIC, non-financial thesis. Check-size /
// budget are intentionally NOT displayed (R11 decision — a single is_public flag
// publishes intent, not how much money an investor writes). The "view full thesis"
// disclosure reads GET /api/public/thesis/:id, which serves the same safe subset.
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  InvestorThesisService,
  type MatchingInvestor,
  type PublicThesis,
} from '../services/investor-thesis.service';

// Loading sentinel kept distinct from "fetched but private/empty" (null).
type ThesisState = 'loading' | PublicThesis | null;

// Chip row — a labeled facet of the mandate. Structure is information: each row is
// one axis the investor actually constrained on, so empty axes are omitted entirely.
function ChipRow({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400 shrink-0">
        {label}
      </span>
      <span className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span
            key={it}
            className="text-xs px-2 py-0.5 rounded-full bg-white border border-indigo-100 text-indigo-700"
          >
            {it}
          </span>
        ))}
      </span>
    </div>
  );
}

function ThesisDisclosure({ state }: { state: ThesisState }) {
  if (state === 'loading') {
    return <p className="mt-3 text-sm text-gray-400">Loading thesis…</p>;
  }
  if (state === null) {
    return <p className="mt-3 text-sm text-gray-400">This investor hasn’t published a full thesis.</p>;
  }
  const hasTaxonomy =
    state.formats.length || state.stages.length || state.dealTypes.length ||
    state.territories.length || state.themes.length;
  return (
    <div className="mt-3 rounded-lg bg-indigo-50/60 border border-indigo-100 p-4 space-y-3">
      {state.positioning && (
        <p className="text-sm leading-relaxed text-gray-700">{state.positioning}</p>
      )}
      {hasTaxonomy ? (
        <div className="space-y-2">
          <ChipRow label="Formats" items={state.formats} />
          <ChipRow label="Stages" items={state.stages} />
          <ChipRow label="Deal types" items={state.dealTypes} />
          <ChipRow label="Territories" items={state.territories} />
          <ChipRow label="Themes" items={state.themes} />
        </div>
      ) : (
        !state.positioning && <p className="text-sm text-gray-400">No additional thesis details.</p>
      )}
    </div>
  );
}

export default function MatchingInvestorsPanel({ pitchId }: { pitchId: number }) {
  const [investors, setInvestors] = useState<MatchingInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-investor expanded state + a cache of fetched public theses.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [theses, setTheses] = useState<Record<number, ThesisState>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    InvestorThesisService.getMatchingInvestors(pitchId)
      .then((list) => { if (alive) setInvestors(list); })
      .catch(() => { if (alive) setInvestors([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [pitchId]);

  const toggle = (investorId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(investorId)) { next.delete(investorId); return next; }
      next.add(investorId);
      // Fetch the full thesis once, lazily, on first expand.
      if (theses[investorId] === undefined) {
        setTheses((t) => ({ ...t, [investorId]: 'loading' }));
        InvestorThesisService.getPublicThesis(investorId)
          .then((thesis) => setTheses((t) => ({ ...t, [investorId]: thesis })))
          .catch(() => setTheses((t) => ({ ...t, [investorId]: null })));
      }
      return next;
    });
  };

  // Stay invisible unless there's something to show — never clutter the pitch view.
  if (loading || investors.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-6 border border-indigo-100">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-lg font-semibold text-gray-900">Investors interested in this genre</h3>
        <span className="inline-flex items-center justify-center text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
          {investors.length}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Public investment theses whose mandate matches this pitch.
      </p>
      <ul className="divide-y divide-gray-100">
        {investors.map((inv) => {
          const isOpen = expanded.has(inv.investorId);
          return (
            <li key={inv.investorId} className="py-3">
              <p className="font-medium text-gray-900 truncate">
                {inv.companyName || inv.username || 'Investor'}
              </p>
              {inv.genres.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {inv.genres.slice(0, 6).map((g) => (
                    <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{g}</span>
                  ))}
                </div>
              )}
              {/* Positioning teaser only while collapsed — the disclosure shows it in full. */}
              {!isOpen && inv.positioning && (
                <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">{inv.positioning}</p>
              )}

              <button
                type="button"
                onClick={() => toggle(inv.investorId)}
                aria-expanded={isOpen}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
              >
                {isOpen ? 'Hide thesis' : 'View full thesis'}
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>

              {isOpen && <ThesisDisclosure state={theses[inv.investorId] ?? 'loading'} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
