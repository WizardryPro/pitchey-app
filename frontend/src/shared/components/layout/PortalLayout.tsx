import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { MinimalHeader } from './MinimalHeader';
import { PageErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';
import { getPortalTheme } from '@shared/hooks/usePortalTheme';

import { EnhancedCreatorNav } from './EnhancedCreatorNav';
import { EnhancedInvestorNav } from './EnhancedInvestorNav';
import { EnhancedProductionNav } from './EnhancedProductionNav';
import { EnhancedAdminNav } from './EnhancedAdminNav';
import { EnhancedWatcherNav } from './EnhancedWatcherNav';

interface PortalLayoutProps {
  userType: string | null;
}

export function PortalLayout({ userType }: PortalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default on mobile
  // Desktop sidebar collapse — persisted so it sticks across navigations/sessions.
  // Collapsed = a slim icon rail (labels via tooltip); expanded = the full labelled nav.
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('pitchey:sidebarCollapsed') === '1'; } catch { return false; }
  });
  const location = useLocation();
  const theme = getPortalTheme(userType);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('pitchey:sidebarCollapsed', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Mobile overlay always renders expanded (full width); only the desktop rail collapses.
  const renderSidebar = (collapsed = false) => {
    switch (userType) {
      case 'creator':
        return <EnhancedCreatorNav collapsed={collapsed} />;
      case 'investor':
        return <EnhancedInvestorNav collapsed={collapsed} />;
      case 'production':
        return <EnhancedProductionNav collapsed={collapsed} />;
      case 'admin':
        return <EnhancedAdminNav collapsed={collapsed} />;
      case 'watcher':
        return <EnhancedWatcherNav collapsed={collapsed} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal Header */}
      <MinimalHeader 
        onMenuToggle={toggleSidebar} 
        isSidebarOpen={isSidebarOpen}
        userType={userType}
      />

      {/* min-h (not fixed h) so the row grows with content and the WINDOW scrolls.
          A fixed h-[calc(100vh-4rem)] + overflow-y-auto on <main> made content scroll
          inside an inner pane — on shorter/mobile viewports 100vh overshoots the visible
          area, leaving the bottom of long forms (the Save button) unreachable, plus
          blank-strip repaint while scrolling. The sticky header (top-0) + sticky sidebar
          (top-16) keep the chrome pinned during natural window scroll. */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar - Desktop. sticky + self-start so it stays pinned beside the
            scrolling content. flex-col: nav scrolls internally, collapse toggle pinned
            at the bottom. The aside owns the chrome (bg/border/width) so the nav
            components are width-agnostic content. */}
        <aside className={`
          hidden lg:flex lg:flex-col transition-all duration-300 ease-in-out
          sticky top-16 self-start h-[calc(100vh-4rem)]
          bg-white border-r border-gray-200
          ${isDesktopSidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          <div className="flex-1 overflow-y-auto">
            {renderSidebar(isDesktopSidebarCollapsed)}
          </div>
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="shrink-0 border-t border-gray-200 px-3 py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            title={isDesktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isDesktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isDesktopSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </aside>

        {/* Sidebar - Mobile Overlay (always full width — only the desktop rail collapses) */}
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={toggleSidebar}
            />

            {/* Sidebar */}
            <aside className={`
              lg:hidden fixed left-0 top-16 bottom-0 z-40 w-64
              bg-white border-r border-gray-200 overflow-y-auto
              transform transition-transform duration-300 ease-in-out
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
              {renderSidebar(false)}
            </aside>
          </>
        )}

        {/* Main Content Area — flows naturally; the window scrolls (min-w-0 keeps
            flex children from forcing horizontal overflow). */}
        <main className="flex-1 min-w-0">
          {/* Persistent portal identity strip — 3px colored bar that stays visible
              across every route inside this portal. Primary "you are in Watcher"
              signal when page chrome is otherwise shared/neutral. */}
          <div className={`h-[3px] ${theme.stripTop}`} aria-hidden="true" />
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {/* Page Content - key forces re-render on route change and resets error boundary */}
            <PageErrorBoundary key={location.pathname}>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${theme.spinnerBorder}`}></div></div>}>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}