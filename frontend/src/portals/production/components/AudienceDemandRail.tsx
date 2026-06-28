import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, Heart, Bookmark, ArrowRight, Clapperboard, TrendingUp } from 'lucide-react';
import apiClient from '../../../lib/api-client';

/**
 * AudienceDemandRail — the producer-facing demand lens (moat plan, phase 2).
 *
 * Surfaces pitches ranked by AUDIENCE (watcher) engagement specifically, kept
 * separate from the blended Heat score. Heat weights industry attention ×4;
 * this is the inverse — "what the crowd is backing before the industry weighs
 * in" — so a producer can read genuine audience appetite as its own signal.
 *
 * Self-contained: fetches its own data so it can drop into the production
 * dashboard overview stack without touching the section-status machinery. An
 * empty result is shown honestly (audience signal is still building), never
 * faked.
 */

type DemandPitch = {
  id: number;
  title?: string;
  genre?: string;
  cover_image?: string;
  creator_username?: string;
  creator_name?: string;
  watcher_likes?: number;
  watcher_saves?: number;
  watcher_views?: number;
  audience_score?: number;
};

function DemandCard({ p, onOpen }: { p: DemandPitch; onOpen: (id: number) => void }) {
  const likes = Number(p.watcher_likes || 0);
  const saves = Number(p.watcher_saves || 0);
  const title = String(p.title || 'Untitled');
  const who = p.creator_username ? `@${p.creator_username}` : (p.creator_name || 'A creator');
  return (
    <button
      onClick={() => onOpen(Number(p.id))}
      className="group shrink-0 w-44 sm:w-48 text-left bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand-portal-production/40 transition-all duration-200"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-indigo-900 to-blue-900">
        {p.cover_image ? (
          <img src={p.cover_image} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-7 h-7 text-white/40" /></div>
        )}
        {/* Audience-demand badge — the headline signal */}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-portal-production text-white text-[11px] font-semibold shadow-sm">
          <Users2 className="w-3 h-3" />
          {Number(p.audience_score || 0)}
        </div>
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">{title}</h4>
        <p className="text-xs text-gray-500 truncate mt-0.5">{p.genre ? `${p.genre} · ` : ''}{who}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-pink-500" />{likes}</span>
          <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3 text-cyan-600" />{saves}</span>
        </div>
      </div>
    </button>
  );
}

export default function AudienceDemandRail() {
  const navigate = useNavigate();
  const [pitches, setPitches] = useState<DemandPitch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res: unknown = await apiClient.get('/api/pitches/audience-demand?limit=8');
        // apiClient may return the raw body or a wrapped { data } — handle both.
        const body = (res as { data?: { pitches?: DemandPitch[] }; pitches?: DemandPitch[] }) || {};
        const list = body?.data?.pitches || body?.pitches || [];
        if (!cancelled) setPitches(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setPitches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Hide the widget entirely while loading nothing useful — but once loaded,
  // always render so the honest empty state explains the funnel to producers.
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-portal-production/10 text-brand-portal-production">
            <TrendingUp className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">Audience demand</h2>
            <p className="text-xs text-gray-500">What the crowd is backing — before the industry weighs in</p>
          </div>
        </div>
        {pitches.length > 0 && (
          <button
            onClick={() => navigate('/production/browse')}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-brand-portal-production hover:opacity-80"
          >
            Browse all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3 mt-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-44 sm:w-48 h-48 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : pitches.length > 0 ? (
        <div className="flex gap-3 mt-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {pitches.map((p) => (
            <div key={String(p.id)} className="snap-start">
              <DemandCard p={p} onOpen={(id) => navigate(`/production/pitch/${id}`)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-portal-production/10 text-brand-portal-production mb-2">
            <Users2 className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-gray-700">No audience signal yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            As watchers like and save pitches, the ones the audience is backing surface here —
            a demand signal you won't find anywhere else.
          </p>
        </div>
      )}
    </div>
  );
}
