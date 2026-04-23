import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, ChevronRight, LogOut, LogIn, UserPlus, LayoutDashboard,
  User, Building2, Wallet, Eye,
} from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { getPortalPath } from '@/utils/navigation';
import {
  CREATOR_ROUTES, INVESTOR_ROUTES, PRODUCTION_ROUTES, WATCHER_ROUTES,
} from '@/config/navigation.routes';
import { normalizeUserType, type UserTypeCanonical } from '@shared/types/user-type';

type NavItem = { label: string; to: string };

const NAV_BY_ROLE: Partial<Record<UserTypeCanonical, NavItem[]>> = {
  creator: [
    { label: 'Dashboard', to: CREATOR_ROUTES.dashboard },
    { label: 'My Pitches', to: CREATOR_ROUTES.pitches },
    { label: 'Marketplace', to: '/marketplace' },
    { label: 'Messages', to: CREATOR_ROUTES.messages },
    { label: 'NDAs', to: CREATOR_ROUTES.ndas },
    { label: 'Portfolio', to: CREATOR_ROUTES.portfolio },
  ],
  investor: [
    { label: 'Dashboard', to: INVESTOR_ROUTES.dashboard },
    { label: 'Browse', to: INVESTOR_ROUTES.browse },
    { label: 'Watchlist', to: INVESTOR_ROUTES.watchlist },
    { label: 'Portfolio', to: INVESTOR_ROUTES.portfolio },
    { label: 'Messages', to: '/messages' },
    { label: 'NDAs', to: INVESTOR_ROUTES.ndaRequests },
  ],
  production: [
    { label: 'Dashboard', to: PRODUCTION_ROUTES.dashboard },
    { label: 'Browse', to: '/marketplace' },
    { label: 'Projects', to: PRODUCTION_ROUTES.projects },
    { label: 'NDAs', to: '/production/ndas' },
    { label: 'Messages', to: PRODUCTION_ROUTES.messages },
  ],
  watcher: [
    { label: 'Dashboard', to: WATCHER_ROUTES.dashboard },
    { label: 'Marketplace', to: '/marketplace' },
    { label: 'Library', to: WATCHER_ROUTES.library },
    { label: 'Saved', to: WATCHER_ROUTES.saved },
    { label: 'Following', to: WATCHER_ROUTES.following },
  ],
};

const ANON_NAV: NavItem[] = [
  { label: 'Marketplace', to: '/marketplace' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'About', to: '/about' },
];

function roleBadge(userType: UserTypeCanonical | null) {
  switch (userType) {
    case 'production': return { Icon: Building2, label: 'Production', tint: 'text-purple-600' };
    case 'investor':   return { Icon: Wallet, label: 'Investor', tint: 'text-green-600' };
    case 'creator':    return { Icon: User, label: 'Creator', tint: 'text-blue-600' };
    case 'watcher':    return { Icon: Eye, label: 'Watcher', tint: 'text-amber-600' };
    default:           return null;
  }
}

export default function PortalTopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useBetterAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userType = normalizeUserType(user?.userType);
  const items = (isAuthenticated && userType && NAV_BY_ROLE[userType]) || ANON_NAV;
  const badge = roleBadge(userType);

  const isActive = (to: string) => {
    if (to === '/marketplace') return location.pathname === '/marketplace';
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 overflow-hidden">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo + desktop nav */}
          <div className="flex items-center gap-3 sm:gap-8 min-w-0">
            <Link to="/" className="flex items-center flex-shrink-0">
              <span className="text-xl sm:text-2xl font-bold text-purple-600">Pitchey</span>
            </Link>
            <nav className="hidden md:flex items-center gap-5 lg:gap-6">
              {items.map((item) => (
                <button
                  key={item.to}
                  onClick={() => { void navigate(item.to); }}
                  className={`text-nav-link transition ${
                    isActive(item.to)
                      ? 'text-purple-600 font-medium'
                      : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 text-gray-700 hover:text-purple-600 transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {isAuthenticated && user ? (
              <>
                <NotificationBell size="md" />

                {/* Role badge — desktop only */}
                {badge && (
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                    <badge.Icon className={`w-4 h-4 ${badge.tint}`} />
                    <span className="text-sm font-medium text-gray-700">{badge.label}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-sm text-gray-700 truncate max-w-[140px]">
                      {user.companyName || user.firstName || user.username || user.email}
                    </span>
                  </div>
                )}

                {/* Dashboard — icon on mobile, text on sm+ */}
                <button
                  onClick={() => {
                    void navigate(userType ? `/${getPortalPath(userType)}/dashboard` : '/dashboard');
                  }}
                  className="p-2 sm:px-4 sm:py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition flex items-center gap-1.5"
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>

                {/* Sign Out */}
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-600 transition flex-shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { void navigate('/portals'); }}
                  className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-purple-600 hover:text-purple-700 transition font-medium text-xs sm:text-sm flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
                <button
                  onClick={() => { void navigate('/portals'); }}
                  className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-xs sm:text-sm flex-shrink-0 flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Get Started</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden border-t border-gray-100"
            >
              <nav className="flex flex-col py-2">
                {items.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => { setMobileMenuOpen(false); void navigate(item.to); }}
                    className={`flex items-center justify-between px-2 py-3 text-nav-link rounded-lg ${
                      isActive(item.to)
                        ? 'text-purple-600 font-medium bg-purple-50'
                        : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    {item.label}
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
