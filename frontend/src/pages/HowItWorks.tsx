import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Film, Users, DollarSign, Shield, TrendingUp, Star, Zap, Target, Award,
  Sparkles, Play, Menu, X, ChevronDown, Search, MessageSquare, Eye, Lock, BadgeCheck,
  Clapperboard, Handshake, Flame, LogOut,
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { getPortalPath } from '@/utils/navigation';
import { contentService } from '../services/content.service';

// ---------------------------------------------------------------------------
// Icon registry — keeps API/CMS-driven `icon` string keys rendering, and lets
// the local defaults reference the same map.
// ---------------------------------------------------------------------------
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  film: Film, clapperboard: Clapperboard, shield: Shield, lock: Lock, users: Users,
  'dollar-sign': DollarSign, target: Target, search: Search, 'trending-up': TrendingUp,
  eye: Eye, award: Award, handshake: Handshake, message: MessageSquare, 'badge-check': BadgeCheck,
  zap: Zap, star: Star, flame: Flame,
};
const Icon = ({ name, className }: { name?: string; className?: string }) => {
  const C = ICONS[name || 'star'] || Star;
  return <C className={className} />;
};

// ---------------------------------------------------------------------------
// Default role tracks (CMS step arrays merge over these by index).
// Accents pull from the canonical portal tokens in tailwind.config.js.
// ---------------------------------------------------------------------------
type Step = { title: string; description: string; icon: string };
type Track = { id: string; label: string; accent: string; glow: string; tagline: string; outcome: string; steps: Step[] };

const ROLE_TRACKS: Track[] = [
  {
    id: 'creator',
    label: 'Creators',
    accent: '#7B3FBF',
    glow: 'rgba(123,63,191,0.35)',
    tagline: 'Turn a screenplay into your next production.',
    outcome: 'From first draft to signed deal — you keep control of your IP the whole way.',
    steps: [
      { icon: 'clapperboard', title: 'Build your pitch', description: 'Craft a cinematic pitch page — logline, synopsis, treatment, lookbook and budget — with guided tools made for storytellers.' },
      { icon: 'lock', title: 'Protect your IP', description: 'Gate full materials behind the Pitchey Standard NDA. You decide who unlocks the script, and every view is logged.' },
      { icon: 'trending-up', title: 'Get discovered', description: 'Your Heat Score and verified profile surface your project to investors and studios actively searching your genre and budget.' },
      { icon: 'handshake', title: 'Close the deal', description: 'Message interested partners directly, share extended materials, and move from inbox to greenlight — rights intact.' },
    ],
  },
  {
    id: 'investor',
    label: 'Investors',
    accent: '#5B4FC7',
    glow: 'rgba(91,79,199,0.35)',
    tagline: 'Discover the next blockbuster before anyone else.',
    outcome: 'A vetted, transparent deal flow — with a clear record of everything you reviewed.',
    steps: [
      { icon: 'target', title: 'Browse curated pitches', description: 'Explore a vetted marketplace across every genre and format, sorted by traction, freshness and heat — not noise.' },
      { icon: 'lock', title: 'Unlock under NDA', description: 'Sign digitally to access scripts, budgets and proprietary materials, with a clear record of exactly what you reviewed.' },
      { icon: 'eye', title: 'Track what’s moving', description: 'Follow creators and projects, watch engagement and momentum in real time, and build a shortlist before the market catches on.' },
      { icon: 'award', title: 'Back the winners', description: 'Connect directly with creators, open the conversation, and negotiate terms on the projects you believe in.' },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    accent: '#4A5FD0',
    glow: 'rgba(74,95,208,0.35)',
    tagline: 'Find, secure and produce your next slate.',
    outcome: 'A credible sourcing pipeline that moves promising projects toward production.',
    steps: [
      { icon: 'badge-check', title: 'Stand up your slate', description: 'Build a verified company profile so creators know they’re pitching a credible partner — and bring your team in with a join code.' },
      { icon: 'shield', title: 'Request & sign NDAs', description: 'Review sensitive materials under NDA while keeping your own development pipeline confidential.' },
      { icon: 'search', title: 'Source by fit', description: 'Search by genre, budget and Heat Score to surface projects that match your slate — then compare submissions side by side.' },
      { icon: 'message', title: 'Develop together', description: 'Message creators, bring collaborators into a shared workspace, and shepherd projects toward production.' },
    ],
  },
];

const FEATURES: Step[] = [
  { icon: 'zap', title: 'AI-assisted pitching', description: 'Auto-fill production assessments from your uploaded documents with Claude — less busywork, sharper pitches.' },
  { icon: 'shield', title: 'NDA-grade protection', description: 'The lawyer-drafted Pitchey Standard NDA gates every sensitive file. Click-to-sign, fully logged.' },
  { icon: 'flame', title: 'Heat Score discovery', description: 'A Bayesian, role-weighted score surfaces real traction — so strong projects rise on merit, not ad spend.' },
  { icon: 'badge-check', title: 'Verified & trusted', description: 'Region-adaptive company verification and gold / silver trust badges keep the marketplace credible.' },
  { icon: 'message', title: 'Direct connections', description: 'Built-in messaging, shared workspaces and team join codes connect the right people fast.' },
  { icon: 'star', title: 'Built for the industry', description: 'Slates, comparisons, opportunity boards and structured feedback — designed around how film actually gets made.' },
];

const FAQS = [
  { q: 'Who can join Pitchey?', a: 'Creators pitching original work, investors hunting deal flow, and production companies sourcing their next slate. Anyone can also browse as a Watcher — our audience tier — to like, save and follow projects.' },
  { q: 'How is my idea protected?', a: 'Your public summary is open, but full materials — script, budget, treatment — stay gated behind the Pitchey Standard NDA. You choose who unlocks them, and every access is logged so you always know who has seen what.' },
  { q: 'What does it cost?', a: 'Browsing and building a profile is free. Creators and production companies choose a subscription tier (€19.99 / €29.99 / €39.99 per month) for advanced tools and reach. Investors browse curated deal flow at no charge.' },
  { q: 'How do investors and producers find my pitch?', a: 'Your Heat Score — a Bayesian, role-weighted measure of real engagement — plus genre, budget and format search surface your project to the right people. Verified profiles and trust badges help you stand out.' },
  { q: 'Do I have to sign an NDA to view a pitch?', a: 'Not to browse. The public-facing summary is always visible. Investors and production companies sign a digital NDA only when they want to unlock the full, sensitive materials behind a project.' },
  { q: 'How do deals actually happen?', a: 'Pitchey is the discovery and protection layer. Once both sides are interested, you connect through built-in messaging and shared workspaces, then negotiate terms directly — your rights and relationships stay yours.' },
];

// ---------------------------------------------------------------------------
// Scroll-reveal helper — opacity + translate as elements enter the viewport.
// ---------------------------------------------------------------------------
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fall back to immediately visible if IntersectionObserver is unavailable
    // (SSR, older browsers, or test environments).
    if (typeof IntersectionObserver !== 'function') { setShown(true); return; }
    let io: IntersectionObserver;
    try {
      io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { setShown(true); io.disconnect(); }
      }, { threshold: 0.15 });
      io.observe(el);
    } catch {
      setShown(true);
      return;
    }
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
}

const fmtMoney = (n: number) => {
  if (n >= 1_000_000) { const m = n / 1_000_000; return `$${m % 1 === 0 ? m : m.toFixed(1)}M`; }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
};
const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

const HowItWorks: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useBetterAuthStore();
  const userType = user?.userType;

  const [tracks, setTracks] = useState<Track[]>(ROLE_TRACKS);
  const [features, setFeatures] = useState<Step[]>(FEATURES);
  const [stats, setStats] = useState<Array<{ value: string; label: string }>>([]);
  const [activeRole, setActiveRole] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const heroRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const bottom = heroRef.current?.getBoundingClientRect().bottom ?? 0;
      setScrolled(bottom <= 64);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Merge optional CMS content over the local defaults; pull real platform stats.
  useEffect(() => {
    (async () => {
      try {
        const [hiw, statsRes] = await Promise.all([
          contentService.getHowItWorks(),
          contentService.getStats(),
        ]);

        if (hiw.success && hiw.data) {
          const d: any = hiw.data;
          const mergeSteps = (base: Step[], incoming?: Step[]) =>
            Array.isArray(incoming) && incoming.length
              ? base.map((s, i) => ({ ...s, ...(incoming[i] || {}) }))
              : base;
          setTracks((prev) => prev.map((t) => {
            const key = t.id === 'creator' ? d.creatorSteps : t.id === 'investor' ? d.investorSteps : d.productionSteps;
            return { ...t, steps: mergeSteps(t.steps, key) };
          }));
          if (Array.isArray(d.features) && d.features.length) setFeatures(d.features);
        }

        if (statsRes.success && statsRes.data) {
          const s: any = statsRes.data;
          const tiles = [
            { value: fmtCount(Number(s.total_users) || 0), label: 'Members' },
            { value: fmtCount(Number(s.published_pitches) || 0), label: 'Live pitches' },
            { value: fmtCount(Number(s.total_pitches) || 0), label: 'Pitches created' },
            { value: fmtMoney(Number(s.total_invested) || 0), label: 'Capital tracked' },
          ];
          // Only surface the strip if the platform actually has data — never fake numbers.
          if (tiles.some((t) => t.value !== '0' && t.value !== '$0')) setStats(tiles);
        }
      } catch {
        /* defaults already in state */
      }
    })();
  }, []);

  const navLinks = [
    { label: 'Browse Pitches', to: '/marketplace' },
    { label: 'Opportunities', to: '/opportunities' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'About', to: '/about' },
  ];
  const track = tracks[activeRole];

  return (
    <div className="min-h-screen bg-[#0d0a18] text-white">
      {/* ===================== Header (scroll-aware, matches Homepage) ===================== */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm'
          : mobileMenuOpen ? 'bg-[#1f1934] border-b border-white/10' : 'bg-[#0a0a12]/70 backdrop-blur-md border-b border-white/5'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/" className="flex items-center">
                <img src={scrolled ? '/pitchey-logotype.png' : '/pitchey-logotype-white.png'} alt="Pitchey" className="h-8 w-auto" />
              </a>
              <nav className="hidden md:flex items-center gap-6">
                {navLinks.map((l) => {
                  const active = l.to === '/how-it-works';
                  return (
                    <button
                      key={l.to}
                      onClick={() => navigate(l.to)}
                      className={`text-nav-link transition ${
                        scrolled
                          ? active ? 'text-purple-700 font-semibold' : 'hover:text-purple-600'
                          : active ? 'text-white font-semibold' : 'text-white/90 hover:text-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  <button
                    onClick={() => navigate(userType ? `/${getPortalPath(userType)}/dashboard` : '/login')}
                    className="text-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={async () => { await logout(); navigate('/'); }}
                    className={`text-button px-3 py-2 transition ${scrolled ? 'text-gray-500 hover:text-red-600' : 'text-white/70 hover:text-white'}`}
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className={`text-button px-4 py-2 transition ${scrolled ? 'text-purple-600 hover:text-purple-700' : 'text-white hover:text-white/80'}`}
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
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className={`md:hidden inline-flex items-center justify-center p-2 rounded-lg transition ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className={`md:hidden border-t ${scrolled ? 'bg-white border-gray-200' : 'bg-[#1f1934] border-white/10'}`}>
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navLinks.map((item) => (
                <button
                  key={item.to}
                  onClick={() => { setMobileMenuOpen(false); navigate(item.to); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white/90 hover:bg-white/10'}`}
                >
                  {item.label}
                </button>
              ))}
              <div className={`my-2 border-t ${scrolled ? 'border-gray-200' : 'border-white/10'}`} />
              <button
                onClick={() => { setMobileMenuOpen(false); navigate(isAuthenticated && userType ? `/${getPortalPath(userType)}/dashboard` : '/register'); }}
                className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold text-center shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-indigo-500 transition"
              >
                {isAuthenticated ? 'Dashboard' : 'Get Started'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ===================== Hero — "Premiere Night" ===================== */}
      <section ref={heroRef} className="relative -mt-16 overflow-hidden bg-gradient-to-b from-[#3a2f5c] via-[#2c2547] to-[#1f1934]">
        <div aria-hidden className="absolute -top-48 left-1/2 -translate-x-1/2 w-[64rem] h-[44rem] rounded-full blur-[80px] bg-[radial-gradient(ellipse_at_center,rgba(132,45,168,0.45),transparent_62%)]" />
        <div aria-hidden className="absolute top-1/4 -right-24 w-[34rem] h-[34rem] rounded-full blur-[90px] bg-[radial-gradient(circle,rgba(245,158,11,0.18),transparent_60%)]" />
        <div aria-hidden className="absolute -bottom-32 -left-24 w-[34rem] h-[34rem] rounded-full blur-[90px] bg-[radial-gradient(circle,rgba(91,79,199,0.22),transparent_60%)]" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div aria-hidden className="floating-decoration absolute top-20 left-10 opacity-[0.10] animate-float"><Film className="w-24 h-24 text-white" /></div>
        <div aria-hidden className="floating-decoration absolute bottom-16 right-12 opacity-[0.10] animate-float-delayed"><Clapperboard className="w-28 h-28 text-white" /></div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 lg:pt-44 lg:pb-32 text-center">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 mb-8 rounded-full border border-white/15 bg-white/5 backdrop-blur text-[11px] font-medium tracking-[0.2em] uppercase text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            How Pitchey works
          </div>
          <h1 className="font-display font-black tracking-tight leading-[0.95] text-4xl sm:text-6xl lg:text-7xl mb-6">
            From a single page
            <br />
            <span className="inline-block font-semibold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
              to the big screen
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl leading-relaxed text-white/80 mb-10">
            Pitchey connects creators, investors and production companies through a secure,
            transparent marketplace — built so great stories get found, protected, and made.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/register')}
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

          {/* Real platform stats — only rendered when the API returns non-zero data. */}
          {stats.length > 0 && (
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] backdrop-blur">
              {stats.map((s, i) => (
                <div key={i} className="px-4 py-5 bg-white/[0.02]">
                  <div className="font-display text-3xl sm:text-4xl font-bold text-white">{s.value}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/50">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===================== Role tracks (tabbed) ===================== */}
      <section className="relative bg-[#0d0a18] py-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.4]" style={{ background: `radial-gradient(60% 50% at 50% 0%, ${track.glow}, transparent 70%)` }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-3">Choose your path</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold">Built for every side of the table</h2>
          </Reveal>

          {/* Tab switcher */}
          <div className="flex justify-center mb-14">
            <div className="inline-flex p-1 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur">
              {tracks.map((t, i) => {
                const on = i === activeRole;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveRole(i)}
                    className={`relative px-5 sm:px-7 py-2.5 rounded-full text-sm font-semibold transition ${on ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                    style={on ? { backgroundColor: t.accent, boxShadow: `0 8px 30px -8px ${t.glow}` } : undefined}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Left: role framing */}
            <Reveal key={`framing-${track.id}`} className="lg:col-span-4 lg:sticky lg:top-28">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5" style={{ color: track.accent, backgroundColor: `${track.accent}1a` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: track.accent }} />
                For {track.label}
              </div>
              <h3 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-5">{track.tagline}</h3>
              <p className="text-white/60 leading-relaxed mb-8">{track.outcome}</p>
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition hover:brightness-110"
                style={{ backgroundColor: track.accent, boxShadow: `0 10px 30px -10px ${track.glow}` }}
              >
                Join as {track.label.replace(/s$/, '')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Reveal>

            {/* Right: numbered timeline */}
            <div className="lg:col-span-8 relative">
              <div aria-hidden className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
              <div className="space-y-5">
                {track.steps.map((step, i) => (
                  <Reveal key={`${track.id}-${i}`} delay={i * 90}>
                    <div className="group relative flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 transition hover:border-white/20 hover:bg-white/[0.05]">
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-white transition group-hover:scale-105"
                          style={{ backgroundColor: `${track.accent}26`, color: track.accent }}
                        >
                          <Icon name={step.icon} className="w-7 h-7" />
                        </div>
                        <span
                          className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                          style={{ backgroundColor: track.accent }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <div className="pt-1">
                        <h4 className="text-lg font-semibold text-white mb-1.5">{step.title}</h4>
                        <p className="text-sm text-white/55 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== Why Pitchey (features) ===================== */}
      <section className="relative bg-gradient-to-b from-stone-50 via-white to-stone-50 text-gray-900 py-24 border-y border-black/5">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,rgba(132,45,168,0.06),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-14">
            <p className="text-[11px] uppercase tracking-[0.22em] text-purple-700/70 mb-3">Why Pitchey</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-gray-900">The infrastructure behind the deal</h2>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto">Everything that makes discovery fair, materials safe, and conversations land with the right people.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={(i % 3) * 80}>
                <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                    <Icon name={f.icon} className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section className="bg-[#0d0a18] py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-3">Questions</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold">Good to know</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={i} delay={i * 50}>
                  <div className={`rounded-2xl border transition ${open ? 'border-white/20 bg-white/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-5"
                    >
                      <span className="font-semibold text-white">{item.q}</span>
                      <ChevronDown className={`w-5 h-5 flex-shrink-0 text-white/50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <p className="px-5 sm:px-6 pb-5 text-sm text-white/55 leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3a2f5c] via-[#2c2547] to-[#1f1934] py-24">
        <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[60rem] h-[40rem] rounded-full blur-[90px] bg-[radial-gradient(ellipse_at_center,rgba(132,45,168,0.45),transparent_62%)]" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-5">Ready when you are</h2>
          <p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto">
            Join the creators, investors and studios shaping what gets made next.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-purple-800 font-semibold transition hover:bg-purple-50"
            >
              <Users className="w-5 h-5" />
              Create your account
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/25 text-white transition hover:bg-white/10"
            >
              <Film className="w-5 h-5" />
              Explore the marketplace
            </button>
          </div>
        </div>
      </section>

      {/* ===================== Footer ===================== */}
      <footer className="bg-[#0a0a12] border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/pitchey-logotype-white.png" alt="Pitchey" className="h-6 w-auto opacity-80" />
          <p className="text-sm text-white/40">
            Have questions? Reach us at{' '}
            <a href="mailto:support@pitchey.com" className="text-violet-300 hover:text-violet-200 transition">support@pitchey.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorks;
