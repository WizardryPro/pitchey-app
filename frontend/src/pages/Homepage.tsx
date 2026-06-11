import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, TrendingUp, Search, Play, Star, Eye, Heart, Calendar, ArrowRight, Sparkles, User, Building2, Wallet, Flame } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { pitchService } from '@features/pitches/services/pitch.service';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '@features/pitches/services/pitch.service';
import { getGenresSync, getFormatsSync } from '@config/pitchConstants';
import FormatDisplay from '../components/FormatDisplay';
import GenrePlaceholder from '@shared/components/GenrePlaceholder';
import { getHeatScore, getPitcheyScore } from '../components/HeatBadge';
import PitcheyRating from '../components/PitcheyRating';
import { getDashboardRoute } from '@/utils/navigation';
import PublicTopNav from '@shared/components/layout/PublicTopNav';



export default function Homepage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useBetterAuthStore();
  const userType = user?.userType;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [trendingPitches, setTrendingPitches] = useState<Pitch[]>([]);
  const [newReleases, setNewReleases] = useState<Pitch[]>([]);
  const [hotPitches, setHotPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  // Hero is pulled up behind the sticky nav (-mt-16) so PublicTopNav's backdrop is the
  // hero itself; the nav flips transparent → white once the hero clears it.
  const heroRef = useRef<HTMLElement>(null);
  // likedPitches state removed — replaced by Pitchey Score

  // Like handler removed — replaced by Pitchey Score rating system

  // "Create Your First Pitch" CTA: signed-in creators/production go straight to
  // the create flow; investors/watchers (can't create) land on their dashboard;
  // signed-out visitors go to portal select to sign in/up.
  const handleCreatePitch = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    switch (userType) {
      case 'creator':
        navigate('/creator/pitch/new');
        break;
      case 'production':
        navigate('/production/pitch/new');
        break;
      default:
        navigate(getDashboardRoute(userType));
    }
  };

  useEffect(() => {
    // Add delay to prevent rate limiting on initial page load
    const timer = setTimeout(() => {
      fetchPitches();
    }, 1500); // Stagger after auth and notification delays

    return () => clearTimeout(timer);
  }, []);

  const fetchPitches = async () => {
    try {
      // Use the new public endpoints that work without authentication
      const [trending, newReleases, featured, hot] = await Promise.all([
        pitchService.getPublicTrendingPitches(4),
        pitchService.getPublicNewPitches(4),
        pitchService.getPublicFeaturedPitches(4),
        pitchService.getPublicHotPitches(3),
      ]);

      setTrendingPitches(trending);
      // If no new releases, show featured pitches
      setNewReleases(newReleases.length > 0 ? newReleases : featured);
      setHotPitches(hot);
    } catch (error) {
      console.warn('Failed to fetch from new public endpoints, using fallback:', error);
      // Fallback to original public endpoint if new endpoints fail
      try {
        const { pitches } = await pitchService.getPublicPitches();
        
        // Sort by views for trending - top 4 most viewed
        const trending = [...pitches].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4);
        setTrendingPitches(trending);
        
        // Sort by creation date for new releases - 4 most recent
        const newOnes = [...pitches].sort((a, b) => 
          new Date(b.createdAt || Date.now()).getTime() - new Date(a.createdAt || Date.now()).getTime()
        ).slice(0, 4);
        setNewReleases(newOnes);
      } catch (fallbackError) {
        console.warn('Fallback also failed:', fallbackError);
        setTrendingPitches([]);
        setNewReleases([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const genres = ['All', ...getGenresSync()];
  const formats = ['All', ...getFormatsSync()];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-purple-50 to-white">
      <PublicTopNav variant="overlay" heroRef={heroRef} showIdentityBadge />

      {/* Hero — "Premiere Night": dark, cinematic, editorial display type. The bright content
          rails below it intentionally read as the marquee turning the lights up.
          -mt-16 pulls the hero up behind the sticky nav so the nav's backdrop is the hero
          itself (not the light page background). */}
      <section ref={heroRef} className="relative -mt-16 overflow-hidden bg-gradient-to-b from-[#3a2f5c] via-[#2c2547] to-[#1f1934] text-white">
        {/* Spotlight glows */}
        <div aria-hidden className="absolute -top-48 left-1/2 -translate-x-1/2 w-[64rem] h-[44rem] rounded-full blur-[80px] bg-[radial-gradient(ellipse_at_center,rgba(132,45,168,0.45),transparent_62%)]" />
        <div aria-hidden className="absolute top-1/4 -right-24 w-[34rem] h-[34rem] rounded-full blur-[90px] bg-[radial-gradient(circle,rgba(245,158,11,0.20),transparent_60%)]" />
        <div aria-hidden className="absolute -bottom-32 -left-24 w-[34rem] h-[34rem] rounded-full blur-[90px] bg-[radial-gradient(circle,rgba(91,79,199,0.22),transparent_60%)]" />
        {/* Film grain */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />
        {/* Letterbox accent lines */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Floating film decorations (kept by request) */}
        <div aria-hidden className="floating-decoration absolute top-16 left-10 opacity-[0.12] animate-float">
          <Film className="w-24 h-24 text-white" />
        </div>
        <div aria-hidden className="floating-decoration absolute bottom-12 right-12 opacity-[0.12] animate-float-delayed">
          <Film className="w-32 h-32 text-white" />
        </div>
        <div aria-hidden className="floating-decoration absolute top-1/2 left-24 opacity-[0.10] animate-float-slow">
          <Sparkles className="w-16 h-16 text-violet-300" />
        </div>
        <div aria-hidden className="floating-decoration absolute top-1/3 right-24 opacity-[0.10] animate-float-slow-delayed">
          <Star className="w-20 h-20 text-white" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 lg:pt-48 lg:pb-36 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-3 py-1 mb-8 rounded-full border border-white/15 bg-white/5 backdrop-blur text-[11px] font-medium tracking-[0.2em] uppercase text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            The film pitch marketplace
          </div>

          {/* Headline — editorial display */}
          <h1 className="font-display font-black tracking-tight leading-[0.92] text-5xl sm:text-7xl lg:text-8xl mb-6">
            Where stories
            <br />
            {/* Upright Fraunces for "find life". The messy "f" (Karl) was NOT
                clipping — it's Fraunces' italic calligraphic swash (long curling
                descender); the loaded font URL has no WONK axis so CSS can't tame
                it. Upright keeps the editorial serif + gradient with a clean f.
                Do NOT re-add `italic` here. */}
            <span className="inline-block font-semibold leading-[1.15] bg-gradient-to-r from-violet-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
              find life
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl leading-relaxed text-white/80 mb-10">
            Share your vision, discover original stories, and connect directly with the producers
            and investors shaping the future of film, television, and new media.
          </p>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                navigate(`/marketplace?search=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}
            className="max-w-xl mx-auto mb-8 flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur p-1.5 transition focus-within:border-white/35 focus-within:bg-white/[0.09]"
          >
            <Search className="w-5 h-5 ml-3 text-white/40 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search pitches, genres, keywords"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent px-1 py-2.5 text-sm sm:text-base text-white placeholder-white/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              aria-label="Search"
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full bg-white w-11 h-11 sm:w-auto sm:h-auto sm:px-5 sm:py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-500/30 transition hover:from-purple-500 hover:to-indigo-500"
            >
              <Sparkles className="w-5 h-5" />
              Start your journey
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white transition hover:bg-white/10"
            >
              <Play className="w-5 h-5" />
              Browse pitches
            </button>
          </div>

          {/* Credibility strip */}
          <div className="mt-14 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>Creators</span>
            <span className="w-1 h-1 rounded-full bg-white/25" />
            <span>Investors</span>
            <span className="w-1 h-1 rounded-full bg-white/25" />
            <span>Studios</span>
          </div>
        </div>
      </section>


      {/* Hottest Pitches — top 3 by Bayesian + role-weighted heat score.
          Replaces the old "How Pitchey Works" tri-card; we'd rather surface real
          traction than explain the product in the abstract. */}
      <section className="relative overflow-hidden py-24 bg-gradient-to-b from-stone-50 via-white to-stone-50 border-y border-gray-100">
        {/* Warm gallery light — a soft amber wash from the top, plus a faint grain
            so the bright canvas still reads as a premium printed program. */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,rgba(245,158,11,0.08),transparent_60%)]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-700 text-[11px] font-semibold tracking-[0.18em] uppercase mb-5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Hottest right now
            </div>
            <h2 className="font-display text-section-title mb-3">Top Pitches by Heat Score</h2>
            <p className="text-body max-w-2xl mx-auto">
              Ranked by views, likes, NDAs signed, and who's engaging — weighted so production and investor attention counts more than anonymous browsing.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
          ) : hotPitches.length === 0 ? (
            <p className="text-center text-gray-500">No hot pitches yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-7">
              {hotPitches.map((pitch, idx) => {
                const pitchRecord = pitch as unknown as Record<string, unknown>;
                const heat = getHeatScore(pitchRecord);
                const score = getPitcheyScore(pitchRecord);
                const cover = (pitch as any).cover_image || (pitch as any).title_image || pitch.titleImage || pitch.thumbnailUrl;
                const isTop = idx === 0;
                return (
                  <div
                    key={pitch.id}
                    onClick={() => navigate(`/pitch/${pitch.id}`)}
                    className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer border transition-all duration-500 hover:-translate-y-1.5 ${
                      isTop
                        ? 'border-amber-200 ring-1 ring-amber-300/40 shadow-[0_16px_44px_-16px_rgba(217,119,6,0.35)] hover:shadow-[0_28px_60px_-18px_rgba(217,119,6,0.45)]'
                        : 'border-gray-200/70 shadow-[0_12px_40px_-16px_rgba(17,12,46,0.18)] hover:shadow-[0_26px_56px_-18px_rgba(17,12,46,0.26)] hover:border-gray-300'
                    }`}
                  >
                    {/* Poster frame — cinematic widescreen still */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-gray-900">
                      {cover ? (
                        <img
                          src={cover}
                          alt={pitch.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <GenrePlaceholder genre={pitch.genre} />
                      )}
                      {/* Top scrim so the rank + heat chips stay legible on any cover */}
                      <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />

                      {/* Rank medallion — gold for #1, light glass for the rest */}
                      <div
                        className={`absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-base shadow-lg ${
                          isTop
                            ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white ring-2 ring-white/70'
                            : 'bg-white/90 text-gray-900 ring-1 ring-black/10 backdrop-blur'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      {/* Heat ember */}
                      {heat > 0 && (
                        <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/25 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          {heat.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {/* Body — light */}
                    <div className="p-5">
                      {isTop && (
                        <span className="inline-flex items-center gap-1 mb-2 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                          <Flame className="w-3 h-3 text-amber-500" />
                          Top heat
                        </span>
                      )}
                      <h3 className="font-display font-bold text-lg text-gray-900 mb-0.5 line-clamp-1 transition group-hover:text-amber-700">
                        {pitch.title}
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        by {(pitch as any).creator_name || (pitch as any).creatorName || 'Unknown'}
                      </p>
                      {score > 0 && (
                        <div className="mb-2">
                          <PitcheyRating mode="stars" value={score} showNumber />
                        </div>
                      )}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {pitch.logline}
                      </p>
                      <div className="flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {(pitch as any).view_count ?? pitch.viewCount ?? 0}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {(pitch as any).like_count ?? (pitch as any).likeCount ?? 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-center mt-12">
            <button
              onClick={() => navigate('/marketplace?sort=hot')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/25 ring-1 ring-amber-300/40 transition"
            >
              See all hot pitches
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Trending Pitches */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-section-title mb-2">
                <TrendingUp className="inline w-8 h-8 text-purple-600 mr-2" />
                Trending Now
              </h2>
              <p className="text-body">The hottest pitches gaining momentum</p>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-nav-link text-purple-600 hover:text-purple-700 transition flex items-center gap-2"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingPitches.map((pitch) => {
                const img = (pitch as any).title_image || (pitch as any).thumbnail_url || pitch.titleImage || pitch.thumbnailUrl;
                return (
                  <div
                    key={pitch.id}
                    onClick={() => navigate(`/pitch/${pitch.id}`)}
                    className="group bg-white rounded-2xl overflow-hidden border border-gray-200/70 shadow-sm transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-violet-200"
                  >
                    <div className="relative h-44 overflow-hidden bg-gray-900">
                      {img ? (
                        <img src={img} alt={pitch.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <GenrePlaceholder genre={pitch.genre} />
                      )}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="absolute top-2.5 right-2.5 rounded-full bg-black/55 backdrop-blur px-2.5 py-0.5 text-[11px] text-white">
                        <FormatDisplay
                          formatCategory={pitch.formatCategory}
                          formatSubtype={pitch.formatSubtype}
                          format={pitch.format}
                          variant="subtype-only"
                        />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-card-title mb-1 line-clamp-1 transition group-hover:text-brand-anchor">
                        {pitch.title}
                      </h3>
                      <p className="text-metadata text-brand-anchor mb-2">{pitch.genre}</p>
                      <p className="text-metadata mb-3 line-clamp-2">{pitch.logline}</p>
                      <div className="flex items-center justify-between text-metadata border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {pitch.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                            {(pitch as any).likeCount ?? (pitch as any).like_count ?? 0}
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3" />
                            {pitch.ratingAverage ? Number(pitch.ratingAverage).toFixed(1) : '—'}
                          </span>
                        </div>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {pitch.createdAt ? new Date(pitch.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* New Releases */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-section-title mb-2">
                <Sparkles className="inline w-8 h-8 text-violet-500 mr-2" />
                New Releases
              </h2>
              <p className="text-body">Fresh content just added to the platform</p>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-nav-link text-purple-600 hover:text-purple-700 transition flex items-center gap-2"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {newReleases.map((pitch) => {
                const img = (pitch as any).title_image || (pitch as any).thumbnail_url || pitch.titleImage || pitch.thumbnailUrl;
                return (
                  <div
                    key={pitch.id}
                    onClick={() => navigate(`/pitch/${pitch.id}`)}
                    className="group bg-white rounded-2xl overflow-hidden border border-gray-200/70 shadow-sm transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-violet-200"
                  >
                    <div className="relative h-44 overflow-hidden bg-gray-900">
                      {img ? (
                        <img src={img} alt={pitch.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <GenrePlaceholder genre={pitch.genre} />
                      )}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="absolute top-2.5 left-2.5 rounded-full bg-brand-new/90 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        NEW
                      </div>
                      <div className="absolute top-2.5 right-2.5 rounded-full bg-black/55 backdrop-blur px-2.5 py-0.5 text-[11px] text-white">
                        <FormatDisplay
                          formatCategory={pitch.formatCategory}
                          formatSubtype={pitch.formatSubtype}
                          format={pitch.format}
                          variant="subtype-only"
                        />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-card-title mb-1 line-clamp-1 transition group-hover:text-brand-anchor">
                        {pitch.title}
                      </h3>
                      <p className="text-metadata text-brand-anchor mb-2">{pitch.genre}</p>
                      <p className="text-metadata text-gray-600 mb-3 line-clamp-2">{pitch.logline}</p>
                      <div className="flex items-center justify-between text-metadata text-gray-600 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {pitch.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                            {(pitch as any).likeCount ?? (pitch as any).like_count ?? 0}
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3" />
                            {pitch.ratingAverage ? Number(pitch.ratingAverage).toFixed(1) : '—'}
                          </span>
                        </div>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {pitch.createdAt ? new Date(pitch.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>


      {/* Value Prop */}
      <section className="py-20 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-section-title mb-6">The data no other platform has</h2>
          <p className="text-body mb-8 mx-auto">
            Pitchey shows creators exactly who is engaging with their pitch — named investors, production companies, and the feedback they share. No black box, no anonymous metrics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleCreatePitch}
              className="text-button px-8 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
            >
              Create Your First Pitch
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-button px-8 py-4 bg-transparent border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 transition"
            >
              Browse Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* Guest User CTA Section */}
      {!isAuthenticated && (
        <section className="relative overflow-hidden py-20 bg-gradient-to-b from-[#3a2f5c] via-[#2c2547] to-[#1f1934] text-white">
          {/* Spotlight glows — same "Premiere Night" lighting as the hero */}
          <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[56rem] h-[34rem] rounded-full blur-[80px] bg-[radial-gradient(ellipse_at_center,rgba(132,45,168,0.40),transparent_62%)]" />
          <div aria-hidden className="absolute -bottom-32 -right-24 w-[30rem] h-[30rem] rounded-full blur-[90px] bg-[radial-gradient(circle,rgba(245,158,11,0.16),transparent_60%)]" />
          <div aria-hidden className="absolute -bottom-28 -left-24 w-[30rem] h-[30rem] rounded-full blur-[90px] bg-[radial-gradient(circle,rgba(91,79,199,0.20),transparent_60%)]" />
          {/* Film grain */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
          />
          {/* Letterbox accent lines */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-8 border border-white/15 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.7)]">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to{' '}
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
                  Explore More?
                </span>
              </h2>
              <p className="text-xl text-white/80 mb-8">
                See who's viewing your pitch, get production feedback, and connect directly with decision-makers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-500/30 transition transform hover:scale-105 hover:from-purple-500 hover:to-indigo-500"
                >
                  <User className="inline w-5 h-5 mr-2" />
                  Join as Creator
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold transition transform hover:scale-105 hover:bg-white/20"
                >
                  <Wallet className="inline w-5 h-5 mr-2" />
                  Join as Investor
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold transition transform hover:scale-105 hover:bg-white/20"
                >
                  <Building2 className="inline w-5 h-5 mr-2" />
                  Join as Production
                </button>
              </div>
              <p className="text-white/55 mt-6 text-sm">
                Free to browse • Full access with account • No credit card required
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img src="/pitchey-logotype.png" alt="Pitchey" className="h-7 w-auto" />
              </div>
              <p className="text-metadata">
                Connecting stories since 2026.
              </p>
            </div>
            <div>
              <h3 className="text-card-title mb-4">For Creators</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/login')} className="text-metadata hover:text-purple-600 transition">Submit Pitch</button></li>
                <li><button onClick={() => navigate('/pricing')} className="text-metadata hover:text-purple-600 transition">Pricing</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-card-title mb-4">Browse</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/marketplace')} className="text-metadata hover:text-purple-600 transition">Browse Pitches</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-card-title mb-4">Company</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/about')} className="text-metadata hover:text-purple-600 transition">About</button></li>
                <li><button onClick={() => navigate('/contact')} className="text-metadata hover:text-purple-600 transition">Contact</button></li>
                <li><button onClick={() => navigate('/terms')} className="text-metadata hover:text-purple-600 transition">Terms</button></li>
                <li><button onClick={() => navigate('/privacy')} className="text-metadata hover:text-purple-600 transition">Privacy</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-metadata">© 2026 Pitchey Ltd. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}