import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, CircleUser, Coins, Menu, X, LogOut, Home, Store } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { paymentsAPI } from '@/lib/apiServices';
import { WebSocketStatusCompact } from '@/components/WebSocketStatus';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { getPortalPath } from '@/utils/navigation';
import { getPortalTheme } from '@shared/hooks/usePortalTheme';


interface MinimalHeaderProps {
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
  userType?: string | null;
}

export function MinimalHeader({ onMenuToggle, isSidebarOpen = true, userType }: MinimalHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    paymentsAPI.getCreditBalance().then((data: any) => {
      if (data) {
        setCreditBalance(data.balance?.credits ?? data.credits ?? 0);
      }
    }).catch(() => { setCreditBalance(0); });
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Portal theme — single source of truth for color accents. See usePortalTheme.
  const theme = getPortalTheme(userType);
  const showRoleBadge = Boolean(userType) && userType !== null;

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Left: Logo, Menu Toggle, and Quick Nav */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo — brand purple intentionally kept; portal identity is carried by
            the role badge + main-content strip, not the logo color */}
        <Link to="/" className="flex items-center">
          <span className="text-xl sm:text-2xl font-bold text-purple-600">Pitchey</span>
        </Link>

        {/* Role badge — persistent "you are in <Portal>" signal, visible across
            every route. Tinted with the portal's accent color. */}
        {showRoleBadge && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${theme.badge}`}
            aria-label={`${theme.label} portal`}
          >
            {theme.label}
          </span>
        )}

        {/* Divider — hidden on mobile (quick nav is also hidden; reduces header clutter) */}
        <div className="hidden sm:block h-6 w-px bg-gray-300"></div>

        {/* Quick Navigation Links — hidden on mobile (sidebar hamburger covers this) */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span className="hidden md:inline">Home</span>
          </Link>
          <Link
            to="/marketplace"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Marketplace"
          >
            <Store className="w-4 h-4" />
            <span className="hidden md:inline">Marketplace</span>
          </Link>
        </nav>
      </div>

      {/* Right: User Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* WebSocket Status */}
        <WebSocketStatusCompact className="hidden sm:flex" />

        {/* Credits — just count on mobile, count + label on sm+ (prevents "500 Credits" pill wrapping at 390px viewports) */}
        <button
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 ${theme.creditPill} rounded-full text-sm font-medium transition whitespace-nowrap`}
          aria-label={creditBalance === null ? 'Credits loading' : `${creditBalance} credits`}
        >
          <Coins className="w-4 h-4 shrink-0" />
          <span>{creditBalance === null ? '—' : creditBalance}</span>
          <span className="hidden sm:inline">Credits</span>
        </button>

        {/* Notifications */}
        <NotificationBell size="sm" />

        {/* Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Profile menu"
          >
            <div className={`w-8 h-8 ${theme.bgMuted} rounded-full flex items-center justify-center`}>
              <CircleUser className={`w-5 h-5 ${theme.textAccent}`} />
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>

          {/* Profile dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
              <div className="px-4 py-2 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">
                  {userType === 'production' && user?.companyName ? user.companyName : user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-600">{user?.email}</p>
              </div>

              {/* Quick Navigation - Mobile */}
              <div className="sm:hidden border-b border-gray-200 py-2">
                <button
                  onClick={() => { navigate('/'); setIsProfileOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>
                <button
                  onClick={() => { navigate('/marketplace'); setIsProfileOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  Marketplace
                </button>
              </div>

              <button
                onClick={() => { navigate(`/${getPortalPath(userType)}/profile`); setIsProfileOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                View Profile
              </button>
              <button
                onClick={() => { navigate(`/${getPortalPath(userType)}/settings`); setIsProfileOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Settings
              </button>
              <div className="border-t border-gray-200 mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}