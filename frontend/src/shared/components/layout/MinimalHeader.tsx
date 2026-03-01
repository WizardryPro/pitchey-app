import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, CircleUser, Coins, Menu, X, LogOut, Home, Store } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { paymentsAPI } from '@/lib/apiServices';
import { WebSocketStatusCompact } from '@/components/WebSocketStatus';


interface MinimalHeaderProps {
  onMenuToggle?: () => void;
  isSidebarOpen?: boolean;
  userType?: string | null;
}

export function MinimalHeader({ onMenuToggle, isSidebarOpen = true, userType }: MinimalHeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number>(0);

  useEffect(() => {
    paymentsAPI.getCreditBalance().then((data: any) => {
      if (data) {
        setCreditBalance(data.balance?.credits ?? data.credits ?? 0);
      }
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getPortalColor = () => {
    switch (userType) {
      case 'creator': return 'purple';
      case 'investor': return 'green';
      case 'production': return 'blue';
      default: return 'purple';
    }
  };

  const color = getPortalColor();

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

        {/* Logo */}
        <Link to="/" className="flex items-center">
          <span className="text-xl sm:text-2xl font-bold text-purple-600">Pitchey</span>
        </Link>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-gray-300"></div>

        {/* Quick Navigation Links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden md:inline">Home</span>
          </Link>
          <Link
            to="/marketplace"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Store className="w-4 h-4" />
            <span className="hidden md:inline">Marketplace</span>
          </Link>
        </nav>
      </div>

      {/* Right: User Actions */}
      <div className="flex items-center gap-4">
        {/* WebSocket Status */}
        <WebSocketStatusCompact className="hidden sm:flex" />

        {/* Credits */}
        <button className={`flex items-center gap-2 px-3 py-1 bg-${color}-100 text-${color}-700 rounded-full text-sm hover:bg-${color}-200 transition`}>
          <Coins className="w-4 h-4" />
          <span>{creditBalance} Credits</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {/* Notification badge */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Notification dropdown */}
          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
              <div className="px-4 py-2 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="px-4 py-3 text-sm text-gray-600">
                No new notifications
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Profile menu"
          >
            <div className={`w-8 h-8 bg-${color}-100 rounded-full flex items-center justify-center`}>
              <CircleUser className={`w-5 h-5 text-${color}-600`} />
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>

          {/* Profile dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
              <div className="px-4 py-2 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
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
                onClick={() => { navigate(`/${userType}/profile`); setIsProfileOpen(false); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                View Profile
              </button>
              <button
                onClick={() => { navigate(`/${userType}/settings`); setIsProfileOpen(false); }}
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