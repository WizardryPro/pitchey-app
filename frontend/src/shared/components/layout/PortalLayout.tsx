import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { MinimalHeader } from './MinimalHeader';
import { PageErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';
import { getPortalTheme } from '@shared/hooks/usePortalTheme';
import LogoLoader from '@/components/LogoLoader';

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
  // Collapsed = a slim icon rail (labels via tooltip / hover); expanded = the full
  // labelled nav. Defaults to COLLAPSED (the cleaner resting state) on first visit.
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('pitchey:sidebarCollapsed');
      return stored === null ? true : stored === '1';
    } catch { return true; }
  });
  // When collapsed, hovering the rail temporarily expands it as an overlay (no reflow).
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const location = useLocation();
  const theme = getPortalTheme(userType);

  // The rail shows full labels when pinned open OR while hovered (collapsed).
  const railExpanded = !isDesktopSidebarCollapsed || isSidebarHovered;

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
        {/* Desktop rail. The <aside> reserves the layout slot (16 collapsed / 64 open);
            the inner panel is fixed so it stays pinned on scroll and, when collapsed,
            expands to full width on hover as an OVERLAY — no content reflow. */}
        <aside className={`hidden lg:block shrink-0 transition-[width] duration-200 ease-in-out ${isDesktopSidebarCollapsed ? 'w-16' : 'w-64'}`}>
          {/* Hover handlers live on the FIXED panel (the element that actually grows to
              w-64), NOT the w-16 placeholder above — otherwise the cursor leaves the
              listening element the instant the panel expands, causing expand/collapse
              flicker. */}
          <div
            onMouseEnter={() => setIsSidebarHovered(true)}
            onMouseLeave={() => setIsSidebarHovered(false)}
            className={`
            fixed top-16 left-0 bottom-0 z-30 flex flex-col
            bg-white border-r border-gray-200 transition-[width] duration-200 ease-in-out
            ${railExpanded ? 'w-64' : 'w-16'}
            ${isDesktopSidebarCollapsed && isSidebarHovered ? 'shadow-2xl' : ''}
          `}>
            <div className="flex-1 overflow-y-auto">
              {renderSidebar(!railExpanded)}
            </div>
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="shrink-0 border-t border-gray-200 px-3 py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              title={isDesktopSidebarCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
              aria-label={isDesktopSidebarCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
            >
              {isDesktopSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              {railExpanded && <span>{isDesktopSidebarCollapsed ? 'Pin open' : 'Collapse'}</span>}
            </button>
          </div>
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
              <Suspense fallback={<div className="flex items-center justify-center h-64"><LogoLoader size="md" /></div>}>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}