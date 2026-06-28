import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import apiClient from '../../../lib/api-client';

// "Who viewed your protected deck" (moat #2) — owner-only per-viewer detail, gated
// behind a paid Creator subscription. Free creators see the count + role breakdown
// and an upsell; paid creators see the named list. Self-contained + degrades to
// null so it can never break the pitch view.

interface ViewerDetail {
  viewerId: number | string;
  name: string;
  role: string;
  viewCount: number;
  lastViewedAt: string | null;
  totalDuration: number;
  ndaSigned: boolean;
}
interface WhoViewedData {
  viewers: ViewerDetail[];
  isOwner: boolean;
  locked: boolean;
  totalViewers: number;
  breakdown: Record<string, number>;
}

const ROLE_LABEL: Record<string, string> = {
  creator: 'Creator', investor: 'Investor', production: 'Production', viewer: 'Watcher',
};

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Breakdown({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  const entries = Object.entries(breakdown || {}).filter(([, n]) => n > 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-2xl font-bold text-gray-900">{total}</span>
      <span className="text-sm text-gray-500 mr-2">unique viewer{total === 1 ? '' : 's'}</span>
      {entries.map(([role, n]) => (
        <span key={role} className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
          {n} {ROLE_LABEL[role] ?? role}
        </span>
      ))}
    </div>
  );
}

export default function WhoViewedPanel({ pitchId }: { pitchId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<WhoViewedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiClient.get<WhoViewedData>(`/api/views/pitch/${pitchId}`);
        if (active && res?.success && res.data) setData(res.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('WhoViewedPanel: failed to load', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [pitchId]);

  if (loading) return <div data-testid="who-viewed-skeleton" className="bg-white rounded-xl shadow-sm h-40 animate-pulse" />;
  if (!data || !data.isOwner) return null; // only the owner sees this panel

  return (
    <section data-testid="who-viewed-panel" className="bg-white rounded-xl shadow-sm ring-1 ring-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold text-gray-900">Who viewed your deck</h3>
      </div>

      <div className="mb-4">
        <Breakdown breakdown={data.breakdown} total={data.totalViewers} />
      </div>

      {data.locked ? (
        <div data-testid="who-viewed-upsell" className="relative rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-5 text-center">
          <Lock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">See exactly who viewed your deck</p>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-md mx-auto">
            Unlock named viewers, their role, how many times they returned, and whether they've signed your NDA.
          </p>
          <button
            type="button"
            onClick={() => navigate('/creator/billing')}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to unlock
          </button>
        </div>
      ) : data.viewers.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No identified viewers yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.viewers.map((v) => (
            <li key={String(v.viewerId)} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{v.name}</span>
                  {v.ndaSigned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                      <ShieldCheck className="w-3 h-3" /> NDA
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {ROLE_LABEL[v.role] ?? v.role} · viewed {v.viewCount}×
                  {v.lastViewedAt ? ` · ${relativeTime(v.lastViewedAt)}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
