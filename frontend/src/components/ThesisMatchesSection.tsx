// ThesisMatchesSection — the investor-facing demand→supply view (moat #7 phase 2).
// Surfaces published pitches that match the investor's structured thesis, on the
// investor dashboard. Self-contained and non-intrusive: renders nothing while loading,
// on error, or when there are no matches (e.g. the investor hasn't set genres yet).
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { InvestorThesisService, type ThesisMatch } from '../services/investor-thesis.service';
import { pitchUrl } from '@/utils/pitchUrl';

export default function ThesisMatchesSection() {
  const [matches, setMatches] = useState<ThesisMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    InvestorThesisService.getThesisMatches()
      .then((m) => { if (alive) setMatches(m); })
      .catch(() => { if (alive) setMatches([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading || matches.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Matching your thesis</h2>
          <span className="inline-flex items-center justify-center text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            {matches.length}
          </span>
        </div>
        <Link to="/investor/settings/profile" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Edit thesis
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Published pitches that fit your investment mandate.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.slice(0, 6).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { void navigate(pitchUrl(m)); }}
            className="text-left bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-gray-900 truncate">{m.title}</p>
              {m.matchScore > 1 && (
                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  strong match
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {m.genre && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.genre}</span>}
              {m.format && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.format}</span>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
