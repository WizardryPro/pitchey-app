import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LogOut, User, Building2, Wallet, Eye } from 'lucide-react';
import { useBetterAuthStore } from '../../../store/betterAuthStore';
import { getPortalPath } from '@/utils/navigation';
import { getPortalTheme } from '@shared/hooks/usePortalTheme';

/**
 * Single source of truth for the public (marketing) top navigation.
 *
 * Information architecture — "Lean + Learn":
 *   Explore (do)   → Browse Pitches · Opportunities          (top level)
 *   Learn          → How It Works · About                    (dropdown)
 *   Account        → Sign In · Get Started  (or Dashboard)   (right side)
 *
 * Keeping the marketing pages on ONE nav stops the three public pages from
 * drifting apart (the inconsistency that prompted this). Use `variant="overlay"`
 * on pages with a dark cinematic hero (Homepage, HowItWorks) and pass the hero
 * ref so the bar flips from transparent → solid-white once the hero clears the
 * nav. Use `variant="solid"` on light content pages (About).
 */

type Props = {
  variant?: 'overlay' | 'solid';
  heroRef?: React.RefObject<HTMLElement | null>;
  /** Homepage shows a portal-themed identity strip when signed in. */
  showIdentityBadge?: boolean;
};

const PRIMARY_LINKS = [
  { label: 'Browse Pitches', to: '/marketplace' },
  { label: 'Opportunities', to: '/opportunities' },
];
const LEARN_LINKS = [
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'About', to: '/about' },
];

export default function PublicTopNav({ variant = 'overlay', heroRef, showIdentityBadge = false }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, user, logout } = useBetterAuthStore();
  const userType = user?.userType;

  // Solid pages are always in the "scrolled" (white) state.
  const [scrolled, setScrolled] = useState(variant === 'solid');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const learnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant === 'solid') return;
    const onScroll = () => {
      const el = heroRef?.current;
      // Switch when the hero clears the 64px nav; fall back to a small scroll
      // threshold if no hero ref was supplied.
      setScrolled(el ? el.getBoundingClientRect().bottom <= 64 : window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant, heroRef]);

  useEffect(() => {
    if (!learnOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (learnRef.current && !learnRef.current.contains(e.target as Node)) setLearnOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [learnOpen]);

  const onDark = !scrolled; // dark hero behind the bar → use light text
  const go = (to: string) => { setMobileOpen(false); setLearnOpen(false); navigate(to); };

  const linkCls = (active: boolean) =>
    `text-nav-link transition ${
      onDark
        ? active ? 'text-white font-semibold' : 'text-white/90 hover:text-white'
        : active ? 'text-purple-700 font-semibold' : 'text-gray-700 hover:text-purple-600'
    }`;

  const learnActive = LEARN_LINKS.some((l) => l.to === pathname);

  const dashboardHref = isAuthenticated && userType ? `/${getPortalPath(userType)}/dashboard` : '/login';

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm'
          : mobileOpen
            ? 'bg-[#1f1934] border-b border-white/10'
            : 'bg-[#0a0a12]/70 backdrop-blur-md border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: logo + primary links */}
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center" aria-label="Pitchey home">
              <img
                src={onDark ? '/pitchey-logotype-white.png' : '/pitchey-logotype.png'}
                alt="Pitchey"
                className="h-8 w-auto"
              />
            </a>
            <nav className="hidden md:flex items-center gap-6">
              {PRIMARY_LINKS.map((l) => (
                <button key={l.to} onClick={() => go(l.to)} className={linkCls(l.to === pathname)}>
                  {l.label}
                </button>
              ))}

              {/* Learn dropdown */}
              <div
                ref={learnRef}
                className="relative"
                onMouseEnter={() => setLearnOpen(true)}
                onMouseLeave={() => setLearnOpen(false)}
              >
                <button
                  onClick={() => setLearnOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={learnOpen}
                  className={`inline-flex items-center gap-1 ${linkCls(learnActive)}`}
                >
                  Learn
                  <ChevronDown className={`w-4 h-4 transition-transform ${learnOpen ? 'rotate-180' : ''}`} />
                </button>
                {learnOpen && (
                  <div role="menu" className="absolute left-0 top-full pt-2 w-52">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-lg shadow-black/5 py-1 overflow-hidden">
                      {LEARN_LINKS.map((l) => (
                        <button
                          key={l.to}
                          role="menuitem"
                          onClick={() => go(l.to)}
                          className={`block w-full text-left px-4 py-2.5 text-sm transition ${
                            l.to === pathname
                              ? 'text-purple-700 font-semibold bg-purple-50'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-purple-600'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right: account actions */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                {showIdentityBadge && (() => {
                  const theme = getPortalTheme(userType);
                  const meta =
                    userType === 'production' ? { Icon: Building2, label: 'Production' } :
                    userType === 'investor'   ? { Icon: Wallet,    label: 'Investor'   } :
                    userType === 'creator'    ? { Icon: User,      label: 'Creator'    } :
                    userType === 'watcher'    ? { Icon: Eye,       label: 'Watcher'    } : null;
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
                <button
                  onClick={() => navigate(dashboardHref)}
                  className="text-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Dashboard
                </button>
                <button
                  onClick={async () => { await logout(); navigate('/'); }}
                  className={`text-button px-3 py-2 transition ${onDark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-red-600'}`}
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className={`text-button px-4 py-2 transition ${onDark ? 'text-white hover:text-white/80' : 'text-purple-600 hover:text-purple-700'}`}
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className={`md:hidden inline-flex items-center justify-center p-2 rounded-lg transition ${
              scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'
            }`}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={`md:hidden border-t ${scrolled ? 'bg-white border-gray-200' : 'bg-[#1f1934] border-white/10'}`}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {PRIMARY_LINKS.map((item) => (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white/90 hover:bg-white/10'}`}
              >
                {item.label}
              </button>
            ))}
            <p className={`px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${scrolled ? 'text-gray-400' : 'text-white/40'}`}>
              Learn
            </p>
            {LEARN_LINKS.map((item) => (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white/90 hover:bg-white/10'}`}
              >
                {item.label}
              </button>
            ))}
            <div className={`my-2 border-t ${scrolled ? 'border-gray-200' : 'border-white/10'}`} />
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={() => go(dashboardHref)}
                  className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold text-center shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-indigo-500 transition"
                >
                  Dashboard
                </button>
                <button
                  onClick={async () => { setMobileOpen(false); await logout(); navigate('/'); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${scrolled ? 'text-gray-600 hover:bg-gray-100' : 'text-white/80 hover:bg-white/10'}`}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => go('/login')}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${scrolled ? 'text-purple-600 hover:bg-purple-50' : 'text-white hover:bg-white/10'}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => go('/register')}
                  className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold text-center shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-indigo-500 transition"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
