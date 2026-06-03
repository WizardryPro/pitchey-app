import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, TrendingUp, Search, Play, Star, Eye, Heart, Calendar, ArrowRight, Sparkles, User, Building2, Wallet, LogOut, Flame } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { pitchService } from '@features/pitches/services/pitch.service';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '@features/pitches/services/pitch.service';
import { getGenresSync, getFormatsSync } from '@config/pitchConstants';
import FormatDisplay from '../components/FormatDisplay';
import GenrePlaceholder from '@shared/components/GenrePlaceholder';
import HeatBadge, { getHeatScore, getPitcheyScore } from '../components/HeatBadge';
import PitcheyRating from '../components/PitcheyRating';
import { getPortalPath, getDashboardRoute } from '@/utils/navigation';
import { getPortalTheme } from '@shared/hooks/usePortalTheme';



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
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a12]/70 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/" className="flex items-center">
                <img src="/pitchey-logotype-white.png" alt="Pitchey" className="h-8 w-auto" />
              </a>
              <nav className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => navigate('/marketplace')}
                  className="text-nav-link transition text-white/90 hover:text-white"
                >
                  Browse Pitches
                </button>
                <button
                  onClick={() => navigate('/how-it-works')}
                  className="text-nav-link transition text-white/90 hover:text-white"
                >
                  How It Works
                </button>
                <button
                  onClick={() => navigate('/about')}
                  className="text-nav-link transition text-white/90 hover:text-white"
                >
                  About
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  {/* User Status Badge — tint comes from the portal theme so the
                      badge matches sidebars and the identity strip. Don't reintroduce
                      hardcoded colors (investor was 'green' before — the bug
                      usePortalTheme docs explicitly call out). */}
                  {(() => {
                    const theme = getPortalTheme(userType);
                    const meta =
                      userType === 'production' ? { Icon: Building2, label: 'Production' } :
                      userType === 'investor'   ? { Icon: Wallet,    label: 'Investor'   } :
                      userType === 'creator'    ? { Icon: User,      label: 'Creator'    } :
                      userType === 'watcher'    ? { Icon: Eye,       label: 'Watcher'    } :
                      null;
                    if (!meta) return null;
                    const displayName =
                      userType === 'production' && user.companyName
                        ? user.companyName
                        : user.firstName
                          ? `${user.firstName} ${user.lastName || ''}`.trim()
                          : user.username;
                    return (
                      <div className={`flex items-center gap-2 px-3 py-1.5 ${theme.bgMuted} border border-gray-200 rounded-lg`}>
                        <meta.Icon className={`w-4 h-4 ${theme.textAccent}`} />
                        <span className={`text-sm font-medium ${theme.textAccent}`}>{meta.label}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-sm text-gray-900">{displayName}</span>
                      </div>
                    );
                  })()}

                  {/* Dashboard Button */}
                  <button
                    onClick={() => navigate(userType ? `/${getPortalPath(userType)}/dashboard` : '/login')}
                    className="text-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>

                  {/* Sign Out Button */}
                  <button
                    onClick={async () => { await logout(); navigate('/'); }}
                    className="text-button px-3 py-2 transition text-white/70 hover:text-white"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-button px-4 py-2 transition text-white hover:text-white/80"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="text-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero — "Premiere Night": dark, cinematic, editorial display type. The bright content
          rails below it intentionally read as the marquee turning the lights up. */}
      <section className="relative overflow-hidden bg-[#0a0a12] text-white">
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

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-3 py-1 mb-8 rounded-full border border-white/15 bg-white/5 backdrop-blur text-[11px] font-medium tracking-[0.2em] uppercase text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            The film pitch marketplace
          </div>

          {/* Headline — editorial display */}
          <h1 className="font-display font-black tracking-tight leading-[0.92] text-5xl sm:text-7xl lg:text-8xl mb-6">
            Where stories
            <br />
            <span className="italic font-semibold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
              find life
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl leading-relaxed text-white/60 mb-10">
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
              placeholder="Search pitches by title, genre, or keyword…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent px-1 py-2.5 text-white placeholder-white/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Search
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
      <section className="py-16 bg-gradient-to-br from-orange-50 via-white to-red-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold mb-4 shadow-sm">
              <Flame className="w-3.5 h-3.5" />
              HOTTEST RIGHT NOW
            </div>
            <h2 className="font-display text-section-title mb-3">Top Pitches by Heat Score</h2>
            <p className="text-body max-w-2xl mx-auto">
              Ranked by views, likes, NDAs signed, and who's engaging — weighted so production and investor attention counts more than anonymous browsing.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : hotPitches.length === 0 ? (
            <p className="text-center text-gray-500">No hot pitches yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {hotPitches.map((pitch, idx) => {
                const pitchRecord = pitch as unknown as Record<string, unknown>;
                const heat = getHeatScore(pitchRecord);
                const score = getPitcheyScore(pitchRecord);
                return (
                  <div
                    key={pitch.id}
                    onClick={() => navigate(`/pitch/${pitch.id}`)}
                    className="relative bg-white rounded-2xl overflow-hidden border border-orange-200 shadow-md hover:shadow-xl hover:border-orange-400 transition cursor-pointer group"
                  >
                    {/* Rank medallion */}
                    <div className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center font-bold text-orange-600 text-lg">
                      #{idx + 1}
                    </div>
                    {/* Heat badge top-right */}
                    <div className="absolute top-3 right-3 z-10">
                      <HeatBadge score={heat} />
                    </div>

                    <div className="h-48 bg-gradient-to-br from-orange-100 to-red-100 relative">
                      {((pitch as any).cover_image || (pitch as any).title_image || pitch.titleImage || pitch.thumbnailUrl) ? (
                        <img
                          src={(pitch as any).cover_image || (pitch as any).title_image || pitch.titleImage || pitch.thumbnailUrl}
                          alt={pitch.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <GenrePlaceholder genre={pitch.genre} />
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-1 group-hover:text-orange-600 transition">
                        {pitch.title}
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        by {(pitch as any).creator_name || (pitch as any).creatorName || 'Unknown'}
                      </p>
                      {score > 0 && (
                        <div className="mb-3">
                          <PitcheyRating mode="stars" value={score} showNumber />
                        </div>
                      )}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {pitch.logline}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {(pitch as any).view_count ?? pitch.viewCount ?? 0}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {(pitch as any).like_count ?? (pitch as any).likeCount ?? 0}</span>
                        </div>
                        {heat > 0 && (
                          <span className="font-semibold text-orange-600">{heat.toFixed(1)} heat</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-center mt-10">
            <button
              onClick={() => navigate('/marketplace?sort=hot')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition font-medium shadow-sm"
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
              {trendingPitches.map((pitch) => (
                <div
                  key={pitch.id}
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                  className="pitch-card bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-purple-300 shadow-sm hover:shadow-md transition cursor-pointer group"
                >
                  <div className="h-40 bg-gradient-to-br from-purple-100 to-pink-100 relative">
                    {((pitch as any).title_image || (pitch as any).thumbnail_url || pitch.titleImage || pitch.thumbnailUrl) ? (
                      <img src={(pitch as any).title_image || (pitch as any).thumbnail_url || pitch.titleImage || pitch.thumbnailUrl} alt={pitch.title} className="w-full h-full object-cover" />
                    ) : (
                      <GenrePlaceholder genre={pitch.genre} />
                    )}
                    <div className="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs text-white">
                      <FormatDisplay
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="subtype-only"
                      />
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="text-card-title mb-1 group-hover:text-purple-600 transition">
                      {pitch.title}
                    </h3>
                    <p className="text-metadata text-purple-600 mb-2">{pitch.genre}</p>
                    <p className="text-metadata mb-3 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-metadata pt-2">
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
              ))}
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
                <Sparkles className="inline w-8 h-8 text-yellow-600 mr-2" />
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
              {newReleases.map((pitch) => (
                <div
                  key={pitch.id}
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                  className="pitch-card bg-white/95 backdrop-blur-md rounded-xl overflow-hidden border border-yellow-500/20 hover:border-yellow-500/40 transition cursor-pointer group"
                >
                  <div className="h-40 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 relative">
                    {((pitch as any).title_image || (pitch as any).thumbnail_url || pitch.titleImage || pitch.thumbnailUrl) ? (
                      <img src={(pitch as any).title_image || (pitch as any).thumbnail_url || pitch.titleImage || pitch.thumbnailUrl} alt={pitch.title} className="w-full h-full object-cover" />
                    ) : (
                      <GenrePlaceholder genre={pitch.genre} />
                    )}
                    <div className="absolute top-2 left-2 bg-brand-new/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs text-white font-medium">
                      NEW
                    </div>
                    <div className="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs text-white">
                      <FormatDisplay
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="subtype-only"
                      />
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="text-card-title text-black mb-1 group-hover:text-purple-600 transition">
                      {pitch.title}
                    </h3>
                    <p className="text-metadata text-gray-600 mb-2">{pitch.genre}</p>
                    <p className="text-metadata text-gray-700 mb-3 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-metadata text-gray-600 pt-2">
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
              ))}
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
        <section className="py-16 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Explore More?
              </h2>
              <p className="text-xl text-white/90 mb-8">
                See who's viewing your pitch, get production feedback, and connect directly with decision-makers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white text-purple-600 rounded-xl hover:bg-gray-100 transition transform hover:scale-105 shadow-lg font-semibold"
                >
                  <User className="inline w-5 h-5 mr-2" />
                  Join as Creator
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl hover:bg-white/30 transition transform hover:scale-105 font-semibold"
                >
                  <Wallet className="inline w-5 h-5 mr-2" />
                  Join as Investor
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl hover:bg-white/30 transition transform hover:scale-105 font-semibold"
                >
                  <Building2 className="inline w-5 h-5 mr-2" />
                  Join as Production
                </button>
              </div>
              <p className="text-white/70 mt-6 text-sm">
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