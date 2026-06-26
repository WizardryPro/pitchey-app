// MatchingInvestorsPanel — the creator-facing demand signal (moat #7 phase 2).
// Shows public investor theses whose genres include this pitch's genre, so a creator
// can see which investors' stated mandates match their work. Self-contained and
// non-intrusive: renders nothing while loading, on error, or when there are no matches.
import { useEffect, useState } from 'react';
import { InvestorThesisService, type MatchingInvestor } from '../services/investor-thesis.service';

function checkSize(min: number | null, max: number | null): string | null {
  const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1000)}K`);
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  if (max != null) return `up to ${fmt(max)}`;
  return null;
}

export default function MatchingInvestorsPanel({ pitchId }: { pitchId: number }) {
  const [investors, setInvestors] = useState<MatchingInvestor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    InvestorThesisService.getMatchingInvestors(pitchId)
      .then((list) => { if (alive) setInvestors(list); })
      .catch(() => { if (alive) setInvestors([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [pitchId]);

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
          const size = checkSize(inv.checkSizeMinUsd, inv.checkSizeMaxUsd);
          return (
            <li key={inv.investorId} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                  {inv.positioning && (
                    <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">{inv.positioning}</p>
                  )}
                </div>
                {size && (
                  <span className="shrink-0 text-xs font-medium text-indigo-600 whitespace-nowrap">{size}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
