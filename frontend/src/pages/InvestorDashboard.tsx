import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  FileText,
  Star,
  Clock,
  Shield,
  BarChart3,
  Briefcase,
  Plus,
  Eye,
  Users,
  Calendar,
  Filter,
  Download,
  Activity,
  Award,
  HandshakeIcon,
  Building,
  MessageSquare,
  Wallet,
  History,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import api from '../lib/api';
// Using the enhanced Investor-specific navigation
// EnhancedInvestorNav is now handled by PortalLayout
import { formatCurrency, formatPercentage, formatDate } from '@shared/utils/formatters';
import {
  safeArray,
  safeMap,
  safeAccess,
  safeNumber,
  safeString,
  isValidDate
} from '@shared/utils/defensive';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useSentryPortal } from '../hooks/useSentryPortal';
import { withPortalErrorBoundary } from '../components/ErrorBoundary/PortalErrorBoundary';

interface PortfolioSummary {
  totalInvested: number;
  activeInvestments: number;
  averageROI: number;
  topPerformer: string;
}

interface Investment {
  id: number;
  pitchTitle: string;
  amount: number;
  status: string;
  roi: number;
  dateInvested: string;
  pitchId?: number;
}

interface SavedPitch {
  id: number;
  title: string;
  creator: string;
  genre: string;
  budget: string;
  status: string;
  savedAt: string;
}

interface NDARequest {
  id: number;
  pitchTitle: string;
  status: string;
  requestedAt: string;
  signedAt?: string;
}

function InvestorDashboard() {
  const navigate = useNavigate();
  const { logout, user, isAuthenticated, checkSession } = useBetterAuthStore();
  const { reportError, trackEvent, trackApiError } = useSentryPortal({
    portalType: 'investor',
    componentName: 'InvestorDashboard',
    trackPerformance: true
  });
  const { isConnected, connectionQuality, isReconnecting } = useWebSocket();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessionChecked, setSessionChecked] = useState(false);

  // Data states
  const [portfolio, setPortfolio] = useState<PortfolioSummary>({
    totalInvested: 0,
    activeInvestments: 0,
    averageROI: 0,
    topPerformer: 'None yet'
  });
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, unknown>[]>([]);

  // Per-section status tracking
  interface SectionStatus { loaded: boolean; error: string | null; }
  const [sectionStatus, setSectionStatus] = useState<{
    portfolio: SectionStatus;
    investments: SectionStatus;
    saved: SectionStatus;
    ndas: SectionStatus;
    notifications: SectionStatus;
    recommendations: SectionStatus;
  }>({
    portfolio:       { loaded: false, error: null },
    investments:     { loaded: false, error: null },
    saved:           { loaded: false, error: null },
    ndas:            { loaded: false, error: null },
    notifications:   { loaded: false, error: null },
    recommendations: { loaded: false, error: null },
  });

  const initialLoading = !sectionStatus.portfolio.loaded && !sectionStatus.portfolio.error;
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Check session on mount and redirect if not authenticated
  useEffect(() => {
    const validateSession = async () => {
      try {
        await checkSession();
        setSessionChecked(true);
      } catch {
        setSessionChecked(true);
      }
    };
    void validateSession();
  }, [checkSession]);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Redirect to login if not authenticated after session check
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      void navigate('/login/investor');
    }
  }, [sessionChecked, isAuthenticated, navigate]);

  useEffect(() => {
    // Only fetch data after session is verified
    if (!sessionChecked || !isAuthenticated) {
      return;
    }
    void fetchDashboardData();
  }, [sessionChecked, isAuthenticated]);

  const fetchDashboardData = async () => {
    // Only fetch data if authenticated
    if (!isAuthenticated || !user?.id) {
      return;
    }

    // Reset all section statuses
    setSectionStatus({
      portfolio:       { loaded: false, error: null },
      investments:     { loaded: false, error: null },
      saved:           { loaded: false, error: null },
      ndas:            { loaded: false, error: null },
      notifications:   { loaded: false, error: null },
      recommendations: { loaded: false, error: null },
    });

    // Fetch all dashboard data in parallel with defensive error handling
    const [
      portfolioRes,
      investmentsRes,
      savedRes,
      ndaRes,
      notificationsRes,
      recommendationsRes
    ] = await Promise.allSettled([
      api.get('/api/investor/portfolio/summary'),
      api.get('/api/investor/investments'),
      api.get('/api/saved-pitches'),
      api.get('/api/nda/active'),
      api.get('/api/notifications'),
      api.get('/api/investment/recommendations')
    ]);

    // --- Portfolio (primary section) ---
    if (portfolioRes.status === 'fulfilled') {
      const responseData = safeAccess(portfolioRes, 'value.data.data', {});
      const validatedPortfolio = {
        totalInvested: safeNumber(safeAccess(responseData, 'totalInvested', 0)),
        activeInvestments: safeNumber(safeAccess(responseData, 'activeInvestments', 0)),
        averageROI: safeNumber(safeAccess(responseData, 'averageROI', 0)),
        topPerformer: safeString(safeAccess(responseData, 'topPerformer', 'None yet'))
      };
      setPortfolio(validatedPortfolio);
      setSectionStatus(prev => ({ ...prev, portfolio: { loaded: true, error: null } }));
    } else {
      const reason: unknown = portfolioRes.reason;
      const portfolioErr = reason instanceof Error ? reason : new Error(String(reason));
      trackApiError('/api/investor/portfolio/summary', portfolioErr);
      reportError(portfolioErr, { context: 'fetchDashboardData.portfolio' });
      setSectionStatus(prev => ({ ...prev, portfolio: { loaded: true, error: 'Failed to load portfolio data. Please try again.' } }));
    }

    // --- Investments ---
    if (investmentsRes.status === 'fulfilled') {
      const investmentsData = safeAccess(investmentsRes, 'value.data.data', []);
      const safeInvestments = safeMap(investmentsData, (investment: unknown) => ({
        id: safeNumber(safeAccess(investment, 'id', 0)),
        pitchTitle: safeString(safeAccess(investment, 'pitchTitle', 'Unknown Project')),
        amount: safeNumber(safeAccess(investment, 'amount', 0)),
        status: safeString(safeAccess(investment, 'status', 'unknown')),
        roi: safeNumber(safeAccess(investment, 'roi', 0)),
        dateInvested: isValidDate(safeAccess(investment, 'dateInvested', null))
          ? safeAccess(investment, 'dateInvested', new Date().toISOString())
          : new Date().toISOString(),
        pitchId: safeNumber(safeAccess(investment, 'pitchId', 0), 0)
      }));
      setInvestments(safeInvestments);
      setSectionStatus(prev => ({ ...prev, investments: { loaded: true, error: null } }));
    } else {
      const reason: unknown = investmentsRes.reason;
      const investErr = reason instanceof Error ? reason : new Error(String(reason));
      trackApiError('/api/investor/investments', investErr);
      setSectionStatus(prev => ({ ...prev, investments: { loaded: true, error: 'Failed to load investments' } }));
    }

    // --- Saved pitches ---
    if (savedRes.status === 'fulfilled') {
      const savedData = safeAccess(savedRes, 'value.data.data', []);
      const safePitches = safeMap(savedData, (pitch: unknown) => ({
        id: safeNumber(safeAccess(pitch, 'id', 0)),
        title: safeString(safeAccess(pitch, 'title', 'Unknown Title')),
        creator: safeString(safeAccess(pitch, 'creator', 'Unknown Creator')),
        genre: safeString(safeAccess(pitch, 'genre', 'Unknown')),
        budget: safeString(safeAccess(pitch, 'budget', 'TBD')),
        status: safeString(safeAccess(pitch, 'status', 'Unknown')),
        savedAt: isValidDate(safeAccess(pitch, 'savedAt', null))
          ? safeAccess(pitch, 'savedAt', new Date().toISOString())
          : new Date().toISOString()
      }));
      setSavedPitches(safePitches);
      setSectionStatus(prev => ({ ...prev, saved: { loaded: true, error: null } }));
    } else {
      const reason: unknown = savedRes.reason;
      const savedErr = reason instanceof Error ? reason : new Error(String(reason));
      trackApiError('/api/saved-pitches', savedErr);
      setSectionStatus(prev => ({ ...prev, saved: { loaded: true, error: 'Failed to load saved pitches' } }));
    }

    // --- NDAs ---
    if (ndaRes.status === 'fulfilled') {
      const ndaData = safeAccess(ndaRes, 'value.data.data', []);
      const safeNDAs: NDARequest[] = safeMap(ndaData, (nda: unknown) => ({
        id: safeNumber(safeAccess(nda, 'id', 0)),
        pitchTitle: safeString(safeAccess(nda, 'pitchTitle', 'Unknown Project')),
        status: safeString(safeAccess(nda, 'status', 'pending')),
        requestedAt: isValidDate(safeAccess(nda, 'requestedAt', null))
          ? safeAccess(nda, 'requestedAt', new Date().toISOString())
          : new Date().toISOString(),
        signedAt: safeAccess(nda, 'signedAt', null) as unknown as string | undefined
      }));
      setNdaRequests(safeNDAs);
      setSectionStatus(prev => ({ ...prev, ndas: { loaded: true, error: null } }));
    } else {
      const reason: unknown = ndaRes.reason;
      const ndaErr = reason instanceof Error ? reason : new Error(String(reason));
      trackApiError('/api/nda/active', ndaErr);
      setSectionStatus(prev => ({ ...prev, ndas: { loaded: true, error: 'Failed to load NDAs' } }));
    }

    // --- Notifications ---
    if (notificationsRes.status === 'fulfilled') {
      const notificationData = safeAccess(notificationsRes, 'value.data.data', []);
      setNotifications(safeArray(notificationData));
      setSectionStatus(prev => ({ ...prev, notifications: { loaded: true, error: null } }));
    } else {
      const reason: unknown = notificationsRes.reason;
      const notifErr = reason instanceof Error ? reason : new Error(String(reason));
      trackApiError('/api/notifications', notifErr);
      setSectionStatus(prev => ({ ...prev, notifications: { loaded: true, error: 'Failed to load notifications' } }));
    }

    // --- Recommendations ---
    if (recommendationsRes.status === 'fulfilled') {
      const recommendationData = safeAccess(recommendationsRes, 'value.data.data', []);
      const safeRecommendations = safeMap(recommendationData, (rec: unknown) => ({
        id: safeNumber(safeAccess(rec, 'id', 0)),
        title: safeString(safeAccess(rec, 'title', 'Unknown Title')),
        genre: safeString(safeAccess(rec, 'genre', 'Unknown')),
        tagline: safeString(safeAccess(rec, 'tagline', 'No description available')),
        budget: safeString(safeAccess(rec, 'budget', 'TBD'))
      }));
      setRecommendations(safeRecommendations);
      setSectionStatus(prev => ({ ...prev, recommendations: { loaded: true, error: null } }));
    } else {
      const reason: unknown = recommendationsRes.reason;
      const recErr = reason instanceof Error ? reason : new Error(String(reason));
      trackApiError('/api/investment/recommendations', recErr);
      setSectionStatus(prev => ({ ...prev, recommendations: { loaded: true, error: 'Failed to load recommendations' } }));
    }
  };

  const handleRetrySection = useCallback((section: string) => {
    trackEvent('dashboard.retry', { section });
    void fetchDashboardData();
  }, [isAuthenticated, user?.id]);

  // formatCurrency function moved to utils/formatters.ts for safe number handling

  if (initialLoading) {
    return (
      <div className="w-full animate-pulse">
        {/* Skeleton title */}
        <div className="mb-6 h-7 w-52 bg-gray-200 rounded" />
        {/* Skeleton portfolio cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 h-28 border border-gray-100" />
          ))}
        </div>
        {/* Skeleton tab bar */}
        <div className="bg-white rounded-t-xl shadow-sm h-12 mb-0 border-b border-gray-200" />
        {/* Skeleton content area */}
        <div className="bg-white rounded-b-xl shadow-sm p-6 h-64" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page Title - simplified since PortalLayout provides header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Investor Dashboard</h1>
      </div>

      {/* Connectivity Banners */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-red-700 text-sm">You are offline. Dashboard data may be outdated.</p>
        </div>
      )}
      {isOnline && !isConnected && !isReconnecting && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <Wifi className="w-4 h-4 text-yellow-600 shrink-0" />
          <p className="text-yellow-700 text-sm">Real-time updates are unavailable.</p>
        </div>
      )}
      {isReconnecting && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <RefreshCw className="w-4 h-4 text-yellow-600 shrink-0 animate-spin" />
          <p className="text-yellow-700 text-sm">Reconnecting to real-time services...</p>
        </div>
      )}
      {isOnline && isConnected && connectionQuality?.strength === 'poor' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-amber-700 text-sm">Connection quality is poor. Some updates may be delayed.</p>
        </div>
      )}

      {/* Portfolio Error */}
      {sectionStatus.portfolio.error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-red-700 text-sm flex-1">{sectionStatus.portfolio.error}</p>
          <button
            onClick={() => handleRetrySection('portfolio')}
            className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invested</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(portfolio.totalInvested)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            {portfolio.totalInvested > 0 && (
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">Active</span>
                <span className="text-gray-500 ml-1">portfolio</span>
              </div>
            )}
            {portfolio.totalInvested === 0 && (
              <div className="mt-4 flex items-center text-sm">
                <span className="text-gray-500">Start investing today</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Deals</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {portfolio.activeInvestments}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Briefcase className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              {portfolio.activeInvestments > 0 ? (
                <>
                  <Plus className="w-4 h-4 text-blue-500 mr-1" />
                  <span className="text-gray-600">{portfolio.activeInvestments} active</span>
                </>
              ) : (
                <span className="text-gray-500">No active investments</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average ROI</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatPercentage(portfolio.averageROI, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Activity className="w-4 h-4 text-purple-500 mr-1" />
              <span className="text-gray-600">Industry avg: 12.3%</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Performer</p>
                <p className="text-lg font-bold text-gray-900 mt-2 truncate">
                  {portfolio.topPerformer}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              {portfolio.topPerformer !== 'None yet' ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-green-500 font-medium">Best performer</span>
                </>
              ) : (
                <span className="text-gray-500">Invest to see top performers</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation - Now visible on all screen sizes with complete navigation */}
        <div className="bg-white rounded-t-xl shadow-sm border-b border-gray-200">
          <nav className="flex flex-wrap gap-x-1 sm:gap-x-6 px-4 sm:px-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'browse'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setActiveTab('investments')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'investments'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Investments
            </button>
            <button
              onClick={() => setActiveTab('due-diligence')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'due-diligence'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Due Diligence
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'network'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Network
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'financials'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Financials
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-sm">
          <div className="p-6">
            {/* Dashboard Tab (formerly Overview) */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Investment Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recommended Opportunities
                  </h3>
                  {sectionStatus.recommendations.error ? (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-red-700 text-sm flex-1">{sectionStatus.recommendations.error}</p>
                      <button
                        onClick={() => handleRetrySection('recommendations')}
                        className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </button>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {safeArray(recommendations).slice(0, 3).map((pitch: unknown, idx: number) => (
                      <div key={safeAccess(pitch, 'id', `rec-${idx}`)} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-gray-900">{safeString(safeAccess(pitch, 'title', 'Unknown Title'))}</h4>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                            {safeString(safeAccess(pitch, 'genre', 'Unknown'))}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{safeString(safeAccess(pitch, 'tagline', 'No description available'))}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{safeString(safeAccess(pitch, 'budget', 'TBD'))}</span>
                          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            View Details →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  {sectionStatus.notifications.error ? (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-red-700 text-sm flex-1">{sectionStatus.notifications.error}</p>
                      <button
                        onClick={() => handleRetrySection('notifications')}
                        className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </button>
                    </div>
                  ) : safeArray(notifications).length > 0 ? (
                    <div className="space-y-3">
                      {safeArray(notifications).slice(0, 5).map((item: unknown, idx: number) => {
                        const actType = safeString(safeAccess(item, 'type', 'info'));
                        const icon = actType === 'nda_request' || actType === 'nda_signed' ? (
                          <Shield className="w-5 h-5 text-blue-400" />
                        ) : actType === 'investment' ? (
                          <DollarSign className="w-5 h-5 text-green-400" />
                        ) : actType === 'pitch_view' || actType === 'pitch_viewed' ? (
                          <Eye className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        );
                        return (
                          <div key={safeAccess(item, 'id', idx)} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            {icon}
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">{safeString(safeAccess(item, 'title', safeAccess(item, 'message', 'Activity')))}</p>
                              <p className="text-xs text-gray-500">
                                {safeAccess(item, 'createdAt', null) || safeAccess(item, 'timestamp', null)
                                  ? formatDate(safeAccess(item, 'createdAt', safeAccess(item, 'timestamp', '')))
                                  : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">No recent activity</div>
                  )}
                </div>
              </div>
            )}

            {/* Investments Tab (formerly Portfolio) */}
            {activeTab === 'investments' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Your Investments</h3>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4 inline mr-2" />
                    New Investment
                  </button>
                </div>

                {sectionStatus.investments.error && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-red-700 text-sm flex-1">{sectionStatus.investments.error}</p>
                    <button
                      onClick={() => handleRetrySection('investments')}
                      className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                  </div>
                )}

                {!sectionStatus.investments.error && safeArray(investments).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Project
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ROI
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {safeArray(investments).map((investment, idx) => (
                          <tr key={safeAccess(investment, 'id', `inv-${idx}`)}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {safeString(safeAccess(investment, 'pitchTitle', 'Unknown Project'))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatCurrency(safeAccess(investment, 'amount', 0))}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                (safeAccess(investment, 'status', '') as string) === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {safeString(safeAccess(investment, 'status', 'Unknown'))}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${
                                safeNumber(safeAccess(investment, 'roi', 0)) > 0 ? 'text-green-600' : 'text-gray-900'
                              }`}>
                                {safeNumber(safeAccess(investment, 'roi', 0)) > 0 ? '+' : ''}{formatPercentage(safeAccess(investment, 'roi', 0), 0)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(safeAccess(investment, 'dateInvested', new Date().toISOString()))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button className="text-blue-600 hover:text-blue-900">View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : !sectionStatus.investments.error ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No investments yet</p>
                    <button
                      onClick={() => { void navigate('/marketplace'); }}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Browse Opportunities
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Browse Tab - New */}
            {activeTab === 'browse' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Browse Opportunities</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate('/investor/discover')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Filter className="w-4 h-4 inline mr-1" />
                      Advanced Search
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <button 
                    onClick={() => navigate('/investor/discover?tab=trending')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Trending Projects</h4>
                    <p className="text-sm text-gray-500 mt-1">Hot opportunities gaining traction</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/discover?tab=new')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Star className="w-6 h-6 text-yellow-600 mb-2" />
                    <h4 className="font-medium text-gray-900">New Submissions</h4>
                    <p className="text-sm text-gray-500 mt-1">Fresh pitches just added</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/discover?tab=featured')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Award className="w-6 h-6 text-purple-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Featured Deals</h4>
                    <p className="text-sm text-gray-500 mt-1">Handpicked quality projects</p>
                  </button>
                </div>

                {/* Saved Pitches Section */}
                <div className="mt-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Your Saved Pitches</h4>
                  {sectionStatus.saved.error ? (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-red-700 text-sm flex-1">{sectionStatus.saved.error}</p>
                      <button
                        onClick={() => handleRetrySection('saved')}
                        className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </button>
                    </div>
                  ) : safeArray(savedPitches).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {safeArray(savedPitches).slice(0, 4).map((pitch, idx) => (
                        <div key={safeAccess(pitch, 'id', `saved-${idx}`)} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-gray-900">{safeString(safeAccess(pitch, 'title', 'Unknown Title'))}</h4>
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          </div>
                          <p className="text-sm text-gray-600 mt-1">by {safeString(safeAccess(pitch, 'creator', 'Unknown Creator'))}</p>
                          <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {safeString(safeAccess(pitch, 'genre', 'Unknown'))}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {safeString(safeAccess(pitch, 'budget', 'TBD'))}
                            </span>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              Saved {formatDate(safeAccess(pitch, 'savedAt', new Date().toISOString()))}
                            </span>
                            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                              View →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No saved pitches yet</p>
                      <button 
                        onClick={() => navigate('/marketplace')}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Discover Pitches
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Due Diligence Tab - combines NDAs and evaluations */}
            {activeTab === 'due-diligence' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Due Diligence & NDAs</h3>
                  <div className="flex gap-2">
                    {safeArray<NDARequest>(ndaRequests).filter((nda: NDARequest) => nda.status === 'pending').length > 0 && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
                        Pending: {safeArray<NDARequest>(ndaRequests).filter((nda: NDARequest) => nda.status === 'pending').length}
                      </span>
                    )}
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm">
                      Active: {safeArray<NDARequest>(ndaRequests).filter((nda: NDARequest) => nda.status === 'signed' || nda.status === 'active').length}
                    </span>
                  </div>
                </div>
                
                {/* NDA Management Section */}
                <div className="mb-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Active NDAs</h4>
                  {sectionStatus.ndas.error ? (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-red-700 text-sm flex-1">{sectionStatus.ndas.error}</p>
                      <button
                        onClick={() => handleRetrySection('ndas')}
                        className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </button>
                    </div>
                  ) : safeArray<NDARequest>(ndaRequests).length > 0 ? (
                    <div className="space-y-3">
                      {safeArray<NDARequest>(ndaRequests).slice(0, 5).map((nda, idx) => (
                        <div key={safeAccess(nda, 'id', `nda-${idx}`)} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{safeString(safeAccess(nda, 'pitchTitle', 'Unknown Project'))}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Requested: {formatDate(safeAccess(nda, 'requestedAt', new Date().toISOString()))}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                (safeAccess(nda, 'status', '') as string) === 'signed'
                                  ? 'bg-green-100 text-green-700'
                                  : (safeAccess(nda, 'status', '') as string) === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {safeString(safeAccess(nda, 'status', 'Unknown'))}
                              </span>
                              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No NDA requests yet</p>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => navigate('/investor/ndas')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Shield className="w-5 h-5 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">All NDAs</p>
                    <p className="text-sm text-gray-500">Manage agreements</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/evaluations')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <FileText className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="font-medium text-gray-900">Evaluations</p>
                    <p className="text-sm text-gray-500">Project assessments</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/risk-assessment')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Activity className="w-5 h-5 text-red-600 mb-2" />
                    <p className="font-medium text-gray-900">Risk Analysis</p>
                    <p className="text-sm text-gray-500">Investment risks</p>
                  </button>
                </div>
              </div>
            )}

            {/* Network Tab */}
            {activeTab === 'network' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Your Investment Network</h3>
                  <button 
                    onClick={() => navigate('/investor/network')}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    View All Connections
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <button 
                    onClick={() => navigate('/investor/creators')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Users className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="font-medium text-gray-900">Creators</p>
                    <p className="text-2xl font-bold text-gray-900">12</p>
                    <p className="text-xs text-gray-500">Connected creators</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/co-investors')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <HandshakeIcon className="w-6 h-6 text-green-600 mb-2" />
                    <p className="font-medium text-gray-900">Co-Investors</p>
                    <p className="text-2xl font-bold text-gray-900">8</p>
                    <p className="text-xs text-gray-500">Partner investors</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/production-companies')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Building className="w-6 h-6 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">Companies</p>
                    <p className="text-2xl font-bold text-gray-900">5</p>
                    <p className="text-xs text-gray-500">Production partners</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/messages')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <MessageSquare className="w-6 h-6 text-orange-600 mb-2" />
                    <p className="font-medium text-gray-900">Messages</p>
                    <p className="text-2xl font-bold text-gray-900">3</p>
                    <p className="text-xs text-gray-500">Unread messages</p>
                  </button>
                </div>

                {/* Recent Network Activity */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Network Activity</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">New connection: Alex Chen (Creator)</p>
                        <p className="text-xs text-gray-500">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <HandshakeIcon className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Co-investor invitation from Sarah Mills</p>
                        <p className="text-xs text-gray-500">1 day ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">New partnership: Stellar Studios</p>
                        <p className="text-xs text-gray-500">3 days ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Investment Analytics</h3>
                  <button className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    Export Report
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ROI Chart Placeholder */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">ROI Over Time</h4>
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                  </div>
                  
                  {/* Investment Distribution */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Portfolio Distribution</h4>
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      <Activity className="w-8 h-8" />
                    </div>
                  </div>
                </div>
                
                {/* Key Metrics */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Returns</p>
                    <p className="text-2xl font-bold text-gray-900">$67,500</p>
                    <p className="text-xs text-green-600 mt-1">+15% YTD</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">73%</p>
                    <p className="text-xs text-gray-500 mt-1">11 of 15 profitable</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Avg. Deal Size</p>
                    <p className="text-2xl font-bold text-gray-900">$75,000</p>
                    <p className="text-xs text-gray-500 mt-1">Last 6 months</p>
                  </div>
                </div>
              </div>
            )}

            {/* Financials Tab */}
            {activeTab === 'financials' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Overview</h3>
                  <button className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    Export Statement
                  </button>
                </div>
                
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Available Funds</p>
                      <Wallet className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">$250,000</p>
                    <p className="text-xs text-gray-500 mt-1">Ready to invest</p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Allocated</p>
                      <DollarSign className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(portfolio.totalInvested)}</p>
                    <p className="text-xs text-gray-500 mt-1">In active investments</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Total Returns</p>
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">$67,500</p>
                    <p className="text-xs text-green-600 mt-1">+15% YTD</p>
                  </div>
                  
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Pending</p>
                      <Clock className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">$45,000</p>
                    <p className="text-xs text-gray-500 mt-1">In negotiation</p>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="mb-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Transactions</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Dec 15, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Investment: "Digital Dreams"
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Investment
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                            -$50,000
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Completed
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Dec 10, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Return: "The Last Echo"
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Return
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            +$12,500
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Received
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Dec 5, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Deposit: Wire Transfer
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Deposit
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            +$100,000
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Cleared
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => navigate('/investor/transactions')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <History className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="font-medium text-gray-900">All Transactions</p>
                    <p className="text-sm text-gray-500">View complete history</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/wallet')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Wallet className="w-5 h-5 text-green-600 mb-2" />
                    <p className="font-medium text-gray-900">Manage Wallet</p>
                    <p className="text-sm text-gray-500">Add funds & banking</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/tax')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <FileText className="w-5 h-5 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">Tax Documents</p>
                    <p className="text-sm text-gray-500">Download statements</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/marketplace')}
            className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:shadow-lg hover:from-blue-100 hover:to-indigo-100 transition-all text-left"
          >
            <svg className="w-5 h-5 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="font-medium text-gray-900">Marketplace</p>
            <p className="text-sm text-gray-500">Browse all pitches</p>
          </button>
          
          <button className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left">
            <Users className="w-5 h-5 text-green-600 mb-2" />
            <p className="font-medium text-gray-900">Network</p>
            <p className="text-sm text-gray-500">Connect with creators</p>
          </button>
          
          <button className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left">
            <Calendar className="w-5 h-5 text-purple-600 mb-2" />
            <p className="font-medium text-gray-900">Schedule</p>
            <p className="text-sm text-gray-500">Manage meetings</p>
          </button>
          
          <button className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left">
            <FileText className="w-5 h-5 text-orange-600 mb-2" />
            <p className="font-medium text-gray-900">Documents</p>
            <p className="text-sm text-gray-500">View contracts & NDAs</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default withPortalErrorBoundary(InvestorDashboard, 'investor');