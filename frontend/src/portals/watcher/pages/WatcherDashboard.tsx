import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, Heart, Search, ArrowRight, Sparkles, Info, Flame, Bookmark, Clapperboard, Rss, UserPlus } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { apiClient } from '@/lib/api-client';
import { WATCHER_ROUTES } from '@/config/navigation.routes';
import { pitchService } from '@features/pitches/services/pitch.service';
import { SavedPitchesService } from '@features/pitches/services/saved-pitches.service';
import HeatBadge, { getHeatScore, getPitcheyScore } from '@/components/HeatBadge';
import { ScoreMeter } from '@/components/feedback/ScoreMeter';

type PitchRec = Record<string, unknown>;

/** Compact pitch tile for the dashboard content rails — cover + heat + score,
 *  matching the marketplace's visual language. Whole tile opens the pitch. */
function PitchTile({ pitch, onOpen }: { pitch: PitchRec; onOpen: (id: number) => void }) {
  const id = Number(pitch.id);
  const heat = getHeatScore(pitch);
  const score = getPitcheyScore(pitch);
  const cover = (pitch.cover_image || pitch.title_image || pitch.titleImage || pitch.thumbnailUrl) as string | undefined;
  const title = String(pitch.title || 'Untitled');
  const genre = (pitch.genre as string) || '';
  return (
    <button
      onClick={() => onOpen(id)}
      className="group text-left bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-cyan-200 transition-all duration-200"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-cyan-900 to-sky-900">
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-8 h-8 text-white/40" /></div>
        )}
        {heat > 0 && <div className="absolute top-2 left-2"><HeatBadge score={heat} /></div>}
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">{title}</h4>
        {genre && <p className="text-xs text-gray-500 truncate mt-0.5">{genre}</p>}
        {score > 0 && <div className="mt-2"><ScoreMeter value={score} size="sm" compact showLabel={false} /></div>}
      </div>
    </button>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!then) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
}

type FollowActivity = {
  creator?: { username?: string; companyName?: string; profileImage?: string };
  pitch?: { id?: number; title?: string; genre?: string };
  createdAt?: string;
};

/** A single "creator you follow posted X" row. */
function FollowFeedRow({ a, onOpen }: { a: FollowActivity; onOpen: (id: number) => void }) {
  const name = a.creator?.username || a.creator?.companyName || 'A creator';
  const img = a.creator?.profileImage;
  const pid = Number(a.pitch?.id);
  return (
    <button onClick={() => onOpen(pid)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left transition-colors">
      <span className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-cyan-100 to-sky-200 ring-1 ring-cyan-100 flex items-center justify-center text-cyan-700 text-sm font-semibold">
        {img ? <img src={img} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-gray-900 truncate">
          <span className="font-semibold">{name}</span> posted <span className="font-semibold">{a.pitch?.title || 'a new pitch'}</span>
        </span>
        <span className="block text-xs text-gray-500 truncate">
          {a.pitch?.genre ? `${a.pitch.genre} · ` : ''}{a.createdAt ? timeAgo(a.createdAt) : ''}
        </span>
      </span>
      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
    </button>
  );
}

export default function WatcherDashboard() {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated } = useBetterAuthStore();
  const [savedCount, setSavedCount] = useState(0);
  const [hotPitches, setHotPitches] = useState<PitchRec[]>([]);
  const [savedPreview, setSavedPreview] = useState<PitchRec[]>([]);
  const [followFeed, setFollowFeed] = useState<FollowActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login/watcher');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      const [savedRes, hot, savedList, followRes] = await Promise.all([
        apiClient.get<{ totalSaved: number }>('/api/saved-pitches/stats').catch(() => ({ success: false, data: null })),
        pitchService.getPublicHotPitches(6).catch(() => [] as unknown[]),
        SavedPitchesService.getSavedPitches().catch(() => ({ savedPitches: [] as { pitch?: unknown }[] })),
        apiClient.get<{ activities?: FollowActivity[] }>('/api/follows').catch(() => ({ success: false, data: null })),
      ]);
      if (savedRes.success && savedRes.data) setSavedCount(savedRes.data.totalSaved || 0);
      // /api/follows returns { activities } flat; apiClient may wrap in .data — handle both.
      const followBody = (followRes as { data?: { activities?: FollowActivity[] }; activities?: FollowActivity[] });
      setFollowFeed((followBody?.data?.activities || followBody?.activities || []).slice(0, 5));
      setHotPitches((hot as PitchRec[]) || []);
      setSavedPreview(
        (((savedList as { savedPitches?: { pitch?: unknown }[] })?.savedPitches) || [])
          .map((s) => s.pitch as PitchRec)
          .filter(Boolean)
          .slice(0, 4)
      );
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const firstName = authUser?.name?.split(' ')[0] || authUser?.email?.split('@')[0] || 'Watcher';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-600 via-sky-600 to-sky-700 rounded-2xl p-8 text-white shadow-lg shadow-cyan-500/20">
        <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-10 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium text-cyan-50 mb-4 ring-1 ring-white/20">
            <Sparkles className="w-3.5 h-3.5" />
            Watcher
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {firstName}</h1>
          <p className="text-cyan-50/90 max-w-lg leading-relaxed">
            Browse pitches, save your favourites, and leave feedback on stories you love.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 ring-1 ring-pink-100/60">
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
              {loading ? '—' : savedCount}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Saved Pitches</p>
          <p className="text-xs text-gray-400 mt-0.5">Your bookmarked ideas</p>
        </div>

        <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-100 ring-1 ring-sky-100/60">
              <Eye className="w-5 h-5 text-sky-600" />
            </div>
            <span className="inline-flex items-center text-xs font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full ring-1 ring-cyan-100">
              Free
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">The Watcher</p>
          <p className="text-xs text-gray-400 mt-0.5">Browse, like &amp; save — free forever</p>
        </div>
      </div>

      {/* From creators you follow — the personalised habit loop */}
      {!loading && (
        <div>
          <div className="flex items-baseline justify-between mb-4 px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Rss className="w-4 h-4 text-cyan-600" /> From creators you follow
            </h2>
            {followFeed.length > 0 && (
              <Link to={`${WATCHER_ROUTES.library}?tab=following`} className="text-xs font-medium text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1">
                Following <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          {followFeed.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {followFeed.map((a, i) => (
                <FollowFeedRow key={`${a.pitch?.id ?? 'x'}-${i}`} a={a} onOpen={(id) => navigate(`/pitch/${id}`)} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-100 ring-1 ring-cyan-100/60 mb-3">
                <UserPlus className="w-5 h-5 text-cyan-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">Follow creators you love</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">Their new pitches show up here first, so you never miss a drop.</p>
              <Link to="/watcher/browse" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 transition">
                <Search className="w-4 h-4" /> Discover creators
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Hottest right now — pull the audience into content */}
      {!loading && hotPitches.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-4 px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" /> Hottest right now
            </h2>
            <Link to="/watcher/browse" className="text-xs font-medium text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1">
              Browse all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {hotPitches.slice(0, 6).map((p) => (
              <PitchTile key={String(p.id)} pitch={p} onOpen={(id) => navigate(`/pitch/${id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Your saved pitches — personal content + a real empty state */}
      {!loading && (
        <div>
          <div className="flex items-baseline justify-between mb-4 px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-pink-500" /> Your saved pitches
            </h2>
            {savedPreview.length > 0 && (
              <Link to={WATCHER_ROUTES.saved} className="text-xs font-medium text-cyan-700 hover:text-cyan-800 inline-flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          {savedPreview.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {savedPreview.map((p) => (
                <PitchTile key={String(p.id)} pitch={p} onOpen={(id) => navigate(`/pitch/${id}`)} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-pink-50 to-rose-100 ring-1 ring-pink-100/60 mb-3">
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">No saved pitches yet</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">Tap the heart on any pitch to bookmark it here.</p>
              <Link to="/watcher/browse" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 transition">
                <Search className="w-4 h-4" /> Browse pitches
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Conversion nudge — the "funnel" half of the audience+funnel intent */}
      <div className="flex gap-3 bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/70 rounded-2xl p-5">
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-700">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 mb-0.5">Watcher accounts are for browsing</p>
          <p className="text-sm text-amber-800/90 leading-relaxed">
            You can browse, like, and comment on pitches. To create, invest in, or produce pitches — or to sign NDAs and access protected content — sign up as a Creator, Investor, or Production account — <Link to="/register" className="underline font-medium">create one here</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
