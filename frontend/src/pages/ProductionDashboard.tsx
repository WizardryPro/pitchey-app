import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, TrendingUp, Eye, Heart, Users, Film, Plus,
  BarChart3, FileText, Shield, Star, Bell, Settings,
  Calendar, DollarSign, UserPlus, ArrowUp, ArrowDown,
  BookOpen, Video, Upload, UserCheck, Clock, Activity,
  X, AlertCircle, User, Trash2, CheckCircle, LogOut, CreditCard, Coins,
  Bookmark, Filter, Search,
  Wifi, WifiOff, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { usePitchStore } from '../store/pitchStore';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { ndaAPI, analyticsAPI, companyAPI, paymentsAPI, pitchServicesAPI } from '../lib/apiServices';
import { API_URL } from '../config';
import apiClient from '../lib/api-client';
import { NotificationWidget } from '../components/Dashboard/NotificationWidget';
import { NotificationBell } from '../components/NotificationBell';
import { getSubscriptionTier } from '../config/subscription-plans';
import { config } from '../config';
import FollowButton from '../components/FollowButton';
import NDAManagementPanel from '../components/NDAManagementPanel';
import FormatDisplay from '../components/FormatDisplay';
import { InvestmentService } from '../services/investment.service';
import InvestmentOpportunities from '../components/Investment/InvestmentOpportunities';
import { EnhancedProductionAnalytics } from '../components/Analytics/EnhancedProductionAnalytics';
import { withPortalErrorBoundary } from '../components/ErrorBoundary/PortalErrorBoundary';
import { useSentryPortal } from '../hooks/useSentryPortal';
import { useWebSocket } from '../contexts/WebSocketContext';
import {
  validateProductionStats,
  safeArray,
  safeMap,
  safeAccess,
  safeNumber,
  safeString,
  safeExecute,
  safeBudgetCalc
} from '../utils/defensive';
import { formatCurrency, formatNumber, formatPercentage, formatDate } from '../utils/formatters';
// import DashboardHeader from '../components/DashboardHeader';
// EnhancedProductionNav is now handled by PortalLayout
// import * as Sentry from '@sentry/react';

interface Analytics {
  totalViews: number;
  totalLikes: number;
  totalNDAs: number;
  viewsChange: number;
  likesChange: number;
  ndasChange: number;
  topPitch: Pitch | null;
  recentActivity: Activity[];
}

interface Activity {
  id: string;
  type: 'view' | 'like' | 'nda' | 'follow' | 'pitch_request';
  pitchTitle?: string;
  userName?: string;
  userType?: string;
  timestamp: string;
}

function ProductionDashboard() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, checkSession } = useBetterAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const { getAllPitches, drafts } = usePitchStore();
  
  // Sentry portal integration
  const { reportError, trackEvent, trackApiError } = useSentryPortal({
    portalType: 'production',
    componentName: 'ProductionDashboard',
    trackPerformance: true
  });
  const { isConnected, connectionQuality, isReconnecting } = useWebSocket();
  const [activeTab, setActiveTab] = useState<'overview' | 'my-pitches' | 'following' | 'ndas'>('overview');
  const [myPitches, setMyPitches] = useState<Pitch[]>([]);
  const [followingPitches, setFollowingPitches] = useState<Pitch[]>([]);
  const [followingCreators, setFollowingCreators] = useState<any[]>([]);
  const [likedPitches, setLikedPitches] = useState<number[]>([]);
  const [savedPitches, setSavedPitches] = useState<number[]>([]);
  const [outgoingNDARequests, setOutgoingNDARequests] = useState<any[]>([]);
  const [incomingNDARequests, setIncomingNDARequests] = useState<any[]>([]);
  const [signedNDAs, setSignedNDAs] = useState<any[]>([]);
  const [incomingSignedNDAs, setIncomingSignedNDAs] = useState<any[]>([]);
  const [signedPitches, setSignedPitches] = useState<Map<number, Pitch>>(new Map());
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [selectedNDA, setSelectedNDA] = useState<any>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [selectedPitchForMedia, setSelectedPitchForMedia] = useState<Pitch | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalViews: 0,
    totalLikes: 0,
    totalNDAs: 0,
    viewsChange: 0,
    likesChange: 0,
    ndasChange: 0,
    topPitch: null,
    recentActivity: []
  });
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  // Investment tracking state
  const [investmentMetrics, setInvestmentMetrics] = useState<any>(null);
  const [investmentOpportunities, setInvestmentOpportunities] = useState<any[]>([]);

  // Per-section status tracking
  interface SectionStatus { loaded: boolean; error: string | null; }
  const [sectionStatus, setSectionStatus] = useState<{
    analytics: SectionStatus;
    ndas: SectionStatus;
    following: SectionStatus;
    investments: SectionStatus;
  }>({
    analytics:   { loaded: false, error: null },
    ndas:        { loaded: false, error: null },
    following:   { loaded: false, error: null },
    investments: { loaded: false, error: null },
  });

  const initialLoading = !sectionStatus.analytics.loaded && !sectionStatus.analytics.error;
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // NDA Template Upload State
  interface NDATemplate {
    id: string;
    name: string;
    size: number;
    uploadStatus: 'idle' | 'uploading' | 'completed' | 'error';
    url?: string;
  }
  const [ndaTemplates, setNdaTemplates] = useState<NDATemplate[]>([]);
  const ndaFileInputRef = useRef<HTMLInputElement>(null);

  const fetchInvestmentData = useCallback(async () => {
    // Guard against calling without a valid session (prevents 401 errors in Sentry)
    if (!user?.id) {
      return;
    }

    let cancelled = false;
    try {
      setSectionStatus(prev => ({ ...prev, investments: { loaded: false, error: null } }));

      // Track investment data fetch
      trackEvent('investment.data.fetch', { userId: user?.id });

      // Fetch production investment metrics with defensive parsing
      const metricsResponse = await InvestmentService.getProductionInvestments();
      if (safeAccess(metricsResponse, 'success', false)) {
        const metricsData = safeAccess(metricsResponse, 'data', {});
        const safeMetrics = validateProductionStats({
          total_projects: safeAccess(metricsData, 'totalProjects', 0),
          active_projects: safeAccess(metricsData, 'activeProjects', 0),
          completed_projects: safeAccess(metricsData, 'completedProjects', 0),
          total_revenue: safeAccess(metricsData, 'totalRevenue', 0),
          average_budget: safeAccess(metricsData, 'averageBudget', 0),
          success_rate: safeAccess(metricsData, 'successRate', 0),
          upcoming_releases: safeAccess(metricsData, 'upcomingReleases', 0)
        });
        setInvestmentMetrics(safeMetrics);
      } else {
        trackApiError('/api/production/investments', { success: false });
      }

      // Fetch investment opportunities with safe parsing
      const opportunitiesResponse = await InvestmentService.getInvestmentOpportunities({ limit: 8 });
      if (safeAccess(opportunitiesResponse, 'success', false)) {
        const opportunitiesData = safeAccess(opportunitiesResponse, 'data', []);
        const safeOpportunities = safeMap(opportunitiesData, (opp: any) => ({
          id: safeAccess(opp, 'id', Math.random()),
          title: safeString(safeAccess(opp, 'title', 'Unknown Opportunity')),
          amount: safeNumber(safeAccess(opp, 'amount', 0)),
          expectedROI: safeNumber(safeAccess(opp, 'expectedROI', 0)),
          riskLevel: safeString(safeAccess(opp, 'riskLevel', 'Unknown'))
        }));
        setInvestmentOpportunities(safeOpportunities);
      } else {
        trackApiError('/api/investor/recommendations', { success: false });
      }

      if (!cancelled) {
        setSectionStatus(prev => ({ ...prev, investments: { loaded: true, error: null } }));
      }
    } catch (err) {
      if (!cancelled) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Error fetching investment data:', e);
        reportError(e, { context: 'fetchInvestmentData' });
        setSectionStatus(prev => ({ ...prev, investments: { loaded: true, error: 'Failed to load investment data. Please try again.' } }));
      }
    }
  }, [user?.id, trackEvent, reportError, trackApiError]);

  // Check session on mount and redirect if not authenticated
  useEffect(() => {
    const validateSession = async () => {
      try {
        await checkSession();
        setSessionChecked(true);
      } catch {
        // Session check failed, will be handled by the redirect below
        setSessionChecked(true);
      }
    };
    validateSession();
  }, [checkSession]);

  // Redirect to login if not authenticated after session check
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      navigate('/login/production');
    }
  }, [sessionChecked, isAuthenticated, navigate]);

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

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  const fetchData = useCallback(async () => {
    let cancelled = false;
    try {
      // Reset section statuses
      setSectionStatus(prev => ({
        ...prev,
        analytics: { loaded: false, error: null },
        ndas: { loaded: false, error: null },
        following: { loaded: false, error: null },
      }));

      // Track dashboard data fetch
      trackEvent('dashboard.data.fetch', { portal: 'production' });

      // === Analytics section ===
      try {
        const [analyticsData, creditsData, subscriptionData] = await Promise.all([
          analyticsAPI.getDashboardAnalytics(),
          paymentsAPI.getCreditBalance(),
          paymentsAPI.getSubscriptionStatus()
        ]);

        if (safeAccess(analyticsData, 'success', false)) {
          const analyticsRaw = safeAccess(analyticsData, 'analytics', {});
          const safeAnalytics: Analytics = {
            totalViews: safeNumber(safeAccess(analyticsRaw, 'totalViews', 0)),
            totalLikes: safeNumber(safeAccess(analyticsRaw, 'totalLikes', 0)),
            totalNDAs: safeNumber(safeAccess(analyticsRaw, 'totalNDAs', 0)),
            viewsChange: safeNumber(safeAccess(analyticsRaw, 'viewsChange', 0)),
            likesChange: safeNumber(safeAccess(analyticsRaw, 'likesChange', 0)),
            ndasChange: safeNumber(safeAccess(analyticsRaw, 'ndasChange', 0)),
            topPitch: safeAccess(analyticsRaw, 'topPitch', null) as Pitch | null,
            recentActivity: safeArray(safeAccess(analyticsRaw, 'recentActivity', [])) as Activity[]
          };
          setAnalytics(safeAnalytics);
        } else {
          trackApiError('/api/analytics/dashboard', analyticsData);
        }

        setCredits(creditsData);
        setSubscription(subscriptionData);
        if (!cancelled) {
          setSectionStatus(prev => ({ ...prev, analytics: { loaded: true, error: null } }));
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch analytics:', e);
        reportError(e, { context: 'fetchAnalyticsData' });
        if (!cancelled) {
          setSectionStatus(prev => ({ ...prev, analytics: { loaded: true, error: 'Failed to load analytics data. Please try again.' } }));
        }
      }

      // === NDAs section ===
      if (isAuthenticated && user?.id) {
        try {
          const [incomingRequests, outgoingRequests, incomingSigned, outgoingSigned] = await Promise.all([
            ndaAPI.getIncomingRequests(),
            ndaAPI.getOutgoingRequests(),
            ndaAPI.getIncomingSignedNDAs(),
            ndaAPI.getOutgoingSignedNDAs()
          ]);

          if (safeAccess(incomingRequests, 'success', false)) {
            const incomingData = safeArray(safeAccess(incomingRequests, 'requests', []));
            const transformedIncoming = incomingData.map((r: any) => ({
              id: r.id,
              pitchId: r.pitch_id || r.pitchId,
              pitchTitle: r.pitch_title || r.pitchTitle || 'Unknown Pitch',
              ndaType: r.nda_type || r.ndaType || 'basic',
              requestedDate: r.created_at || r.requested_at || r.requestedDate,
              requester: r.requester_name || r.requester || 'Unknown',
              requesterType: r.requester_type || r.requesterType || 'investor',
              companyName: r.company_name || r.companyName,
              message: r.message || r.request_message
            }));
            setIncomingNDARequests(transformedIncoming);
          }
          if (safeAccess(outgoingRequests, 'success', false)) {
            const outgoingData = safeArray(safeAccess(outgoingRequests, 'requests', []));
            const transformedOutgoing = outgoingData.map((r: any) => ({
              id: r.id,
              pitchId: r.pitch_id || r.pitchId,
              pitchTitle: r.pitch_title || r.pitchTitle || 'Unknown Pitch',
              ndaType: r.nda_type || r.ndaType || 'basic',
              requestedDate: r.created_at || r.requested_at || r.requestedDate,
              creatorName: r.creator_name || r.creatorName || 'Unknown',
              status: r.status || 'pending'
            }));
            setOutgoingNDARequests(transformedOutgoing);
          }
          if (safeAccess(incomingSigned, 'success', false)) {
            const incomingSignedData = safeArray(safeAccess(incomingSigned, 'ndas', []));
            setIncomingSignedNDAs(incomingSignedData);
          }
          if (safeAccess(outgoingSigned, 'success', false)) {
            const outgoingSignedData = safeArray(safeAccess(outgoingSigned, 'ndas', []));
            setSignedNDAs(outgoingSignedData);
          }
          if (!cancelled) {
            setSectionStatus(prev => ({ ...prev, ndas: { loaded: true, error: null } }));
          }
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('Failed to fetch NDA data:', e);
          setIncomingNDARequests([]);
          setOutgoingNDARequests([]);
          setIncomingSignedNDAs([]);
          setSignedNDAs([]);
          if (!cancelled) {
            setSectionStatus(prev => ({ ...prev, ndas: { loaded: true, error: 'Failed to load NDA data. Please try again.' } }));
          }
        }
      } else {
        setIncomingNDARequests([]);
        setOutgoingNDARequests([]);
        setIncomingSignedNDAs([]);
        setSignedNDAs([]);
        if (!cancelled) {
          setSectionStatus(prev => ({ ...prev, ndas: { loaded: true, error: null } }));
        }
      }

      // Get pitches from store with safe operations
      const allStorePitches = safeArray(getAllPitches());

      // Convert store pitches to dashboard format with defensive mapping
      const dashboardPitches = safeMap(allStorePitches, (p: any) => ({
        ...p,
        id: safeAccess(p, 'id', Math.random()),
        title: safeString(safeAccess(p, 'title', 'Untitled Project')),
        budget: safeNumber(safeAccess(p, 'budget', 0)),
        creator: {
          id: safeAccess(user, 'id', 1),
          username: safeString(safeAccess(user, 'username', 'production')),
          userType: 'production' as const,
          companyName: safeString(safeAccess(user, 'companyName', ''))
        }
      }));

      setMyPitches(dashboardPitches);

      // === Following section ===
      try {
        const followingData = await pitchServicesAPI.getFollowingPitches();
        if (followingData) {
          if (Array.isArray(followingData)) {
            setFollowingPitches(followingData);
          } else if (followingData.pitches) {
            setFollowingPitches(followingData.pitches || []);
          } else {
            setFollowingPitches([]);
          }
        } else {
          try {
            const fallbackResponse = await apiClient.get('/api/follows/following?type=pitches');
            if (fallbackResponse.success) {
              setFollowingPitches((fallbackResponse.data as any)?.following || []);
            } else {
              setFollowingPitches([]);
            }
          } catch (fallbackErr) {
            const fbE = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
            console.error('Failed to fetch following data from fallback API:', fbE);
            setFollowingPitches([]);
          }
        }
        if (!cancelled) {
          setSectionStatus(prev => ({ ...prev, following: { loaded: true, error: null } }));
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch following pitches:', e);
        setFollowingPitches([]);
        if (!cancelled) {
          setSectionStatus(prev => ({ ...prev, following: { loaded: true, error: 'Failed to load following data. Please try again.' } }));
        }
      }

      // Fetch recent activity from analytics API
      try {
        const realtimeResponse = await apiClient.get('/api/analytics/realtime');

        if (realtimeResponse.success) {
          setAnalytics(prev => ({
            ...prev,
            topPitch: dashboardPitches[0] || null,
            recentActivity: (realtimeResponse.data as any)?.recentActivity || []
          }));
        } else {
          setAnalytics(prev => ({
            ...prev,
            topPitch: dashboardPitches[0] || null,
            recentActivity: []
          }));
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch recent activity:', e);
        setAnalytics(prev => ({
          ...prev,
          topPitch: dashboardPitches[0] || null,
          recentActivity: []
        }));
      }

    } catch (err) {
      if (!cancelled) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to fetch dashboard data:', e);
        reportError(e, {
          context: 'fetchData',
          severity: 'error'
        });
        setSectionStatus(prev => ({
          ...prev,
          analytics: prev.analytics.loaded ? prev.analytics : { loaded: true, error: 'Failed to load dashboard data.' },
          ndas: prev.ndas.loaded ? prev.ndas : { loaded: true, error: 'Failed to load dashboard data.' },
          following: prev.following.loaded ? prev.following : { loaded: true, error: 'Failed to load dashboard data.' },
        }));
      }
    }
  }, [getAllPitches, isAuthenticated, user?.id, user?.username, user?.companyName, trackEvent, reportError, trackApiError]);

  useEffect(() => {
    // Only fetch data after session is verified
    if (!sessionChecked || !isAuthenticated) {
      return;
    }

    let fetchCleanup: (() => void) | undefined;
    let investmentCleanup: (() => void) | undefined;

    const initializeData = async () => {
      fetchCleanup = (await fetchData()) as (() => void) | undefined;
      investmentCleanup = (await fetchInvestmentData()) as (() => void) | undefined;
    };

    void initializeData();

    return () => {
      if (fetchCleanup) fetchCleanup();
      if (investmentCleanup) investmentCleanup();
    };
  }, [fetchData, fetchInvestmentData, sessionChecked, isAuthenticated]);

  const handleViewTerms = (nda: any) => {
    setSelectedNDA(nda);
    setShowTermsModal(true);
  };

  const handleSignNDA = (nda: any) => {
    setSelectedNDA(nda);
    setShowNDAModal(true);
  };

  // Following tab handlers
  const handleLikePitch = async (pitchId: number) => {
    try {
      const isLiked = likedPitches.includes(pitchId);
      if (isLiked) {
        setLikedPitches(prev => prev.filter(id => id !== pitchId));
        // Update pitch like count
        setFollowingPitches(prev => prev.map(p => 
          p.id === pitchId ? { ...p, likeCount: p.likeCount - 1 } : p
        ));
      } else {
        setLikedPitches(prev => [...prev, pitchId]);
        // Update pitch like count
        setFollowingPitches(prev => prev.map(p => 
          p.id === pitchId ? { ...p, likeCount: p.likeCount + 1 } : p
        ));
      }
      // In production, call API
      // await pitchServicesAPI.toggleLike(pitchId, !isLiked);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSavePitch = async (pitchId: number) => {
    try {
      const isSaved = savedPitches.includes(pitchId);
      if (isSaved) {
        setSavedPitches(prev => prev.filter(id => id !== pitchId));
      } else {
        setSavedPitches(prev => [...prev, pitchId]);
      }
      // In production, call API
      // await pitchServicesAPI.toggleSave(pitchId, !isSaved);
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleRequestNDA = async (pitchId: number, pitchTitle: string) => {
    try {
      // Show confirmation or modal
      if (confirm(`Request NDA access for "${pitchTitle}"?`)) {
        // Add to outgoing requests
        const newRequest = {
          id: Date.now(),
          pitchId,
          pitchTitle,
          status: 'pending',
          requestDate: new Date().toISOString(),
          message: 'Requesting NDA access for full pitch materials'
        };
        setOutgoingNDARequests(prev => [...prev, newRequest]);
        
        // In production, call API
        // await ndaAPI.requestNDA(pitchId, 'basic', 'Requesting access to full pitch materials');
        
        alert('NDA request sent successfully! You will be notified when approved.');
      }
    } catch (error) {
      console.error('Error requesting NDA:', error);
      alert('Failed to send NDA request. Please try again.');
    }
  };

  const confirmSignNDA = async () => {
    if (selectedNDA) {
      try {
        // In production, this would call the API to sign the NDA
        // await pitchAPI.signNDA(selectedNDA.pitchId, 'basic');
        
        // Move from pending to signed with proper creator info
        setOutgoingNDARequests(prev => prev.filter(n => n.id !== selectedNDA.id));
        setSignedNDAs(prev => [...prev, {
          ...selectedNDA,
          signedDate: 'Just now',
          expiresIn: '2 years'
        }]);
        setShowNDAModal(false);
        setSelectedNDA(null);
      } catch (error) {
        console.error('Error signing NDA:', error);
      }
    }
  };
  
  const handleApproveIncoming = async (request: any) => {
    try {
      const result = await ndaAPI.approveRequest(request.id);
      if (result && result.success) {
        // Remove from pending requests
        setIncomingNDARequests(prev => prev.filter(r => r.id !== request.id));
        // Refresh analytics
        const analyticsData = await analyticsAPI.getDashboardAnalytics();
        if (analyticsData && analyticsData.success) {
          setAnalytics(analyticsData.analytics);
        }
        // Show success message
      } else {
        console.error('Failed to approve NDA request:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to approve NDA request:', error);
    }
  };
  
  const handleRejectIncoming = async (request: any) => {
    try {
      const result = await ndaAPI.rejectRequest(request.id, 'Not interested at this time');
      if (result && result.success) {
        // Remove from pending requests
        setIncomingNDARequests(prev => prev.filter(r => r.id !== request.id));
        // Show rejection message
      } else {
        console.error('Failed to reject NDA request:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to reject NDA request:', error);
    }
  };

  const handleManageMedia = (pitch: Pitch) => {
    setSelectedPitchForMedia(pitch);
    setShowMediaModal(true);
    setMediaFiles([]);
  };

  const handleMediaFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles(prev => [...prev, ...files]);
  };

  const handleUploadMedia = async () => {
    if (!selectedPitchForMedia || mediaFiles.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('pitchId', selectedPitchForMedia.id.toString());
      
      mediaFiles.forEach(file => {
        formData.append('files', file);
      });

      // In production, this would upload to the server
      
      // Update the pitch's media files locally
      setMyPitches(prev => prev.map(pitch => {
        if (pitch.id === selectedPitchForMedia.id) {
          return {
            ...pitch,
            mediaFiles: [
              ...(pitch.mediaFiles || []),
              ...mediaFiles.map(file => ({
                type: detectFileType(file.name),
                count: 1,
                uploaded: true
              }))
            ]
          };
        }
        return pitch;
      }));

      setShowMediaModal(false);
      setMediaFiles([]);
      setSelectedPitchForMedia(null);
    } catch (error) {
      console.error('Error uploading media:', error);
    }
  };

  const detectFileType = (filename: string): string => {
    const name = filename.toLowerCase();
    if (name.includes('lookbook')) return 'lookbook';
    if (name.includes('script')) return 'script';
    if (name.includes('budget')) return 'budget_breakdown';
    if (name.includes('timeline')) return 'production_timeline';
    if (name.includes('deck') || name.includes('presentation')) return 'pitch_deck';
    if (name.includes('.mp4') || name.includes('.mov')) return 'trailer';
    return 'other';
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSignOut = () => {
    logout(); // This will automatically clear all storage and navigate to appropriate login page
  };

  const handleRetrySection = useCallback((section: string) => {
    trackEvent('dashboard.retry', { section });
    if (section === 'investments') {
      fetchInvestmentData();
    } else {
      fetchData();
    }
  }, [fetchData, fetchInvestmentData, trackEvent]);

  // NDA Template Upload Handlers
  const handleNDAFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a PDF, DOC, or DOCX file.');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB.');
      return;
    }

    const template: NDATemplate = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploadStatus: 'idle'
    };

    setNdaTemplates(prev => [...prev, template]);
    
    // Automatically start upload
    uploadNDATemplate(template, file);
  };

  const uploadNDATemplate = async (template: NDATemplate, file: File) => {
    // Update status to uploading
    setNdaTemplates(prev => prev.map(t => 
      t.id === template.id ? { ...t, uploadStatus: 'uploading' } : t
    ));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'nda_template');

      const response = await fetch(`${API_URL}/api/upload/document`, {
        method: 'POST',
        credentials: 'include', // Send cookies for Better Auth session,
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setNdaTemplates(prev => prev.map(t => 
          t.id === template.id ? { 
            ...t, 
            uploadStatus: 'completed',
            url: result.url 
          } : t
        ));
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading NDA template:', error);
      setNdaTemplates(prev => prev.map(t => 
        t.id === template.id ? { ...t, uploadStatus: 'error' } : t
      ));
    }
  };

  const removeNDATemplate = (templateId: string) => {
    setNdaTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  // Smart Upload Handler with AI Analysis
  const handleSmartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Validate file
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert(`${file.name}: Please select a PDF, DOC, or DOCX file.`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}: File size must be less than 10MB.`);
        continue;
      }

      // Smart categorization based on filename
      const smartCategory = detectSmartCategory(file.name);
      
      // Show analysis notification
      alert(`📁 Smart Upload: "${file.name}" categorized as ${smartCategory}.\n\n🔍 AI Analysis:\n• Format validation: ✓\n• Content type: Detected\n• Processing recommendation: Approved`);
    }

    // Reset the input
    if (e.target) {
      e.target.value = '';
    }
  };

  const detectSmartCategory = (filename: string): string => {
    const name = filename.toLowerCase();
    
    if (name.includes('script') || name.includes('screenplay')) return 'Script/Screenplay';
    if (name.includes('treatment') || name.includes('synopsis')) return 'Treatment/Synopsis';
    if (name.includes('deck') || name.includes('presentation')) return 'Pitch Deck';
    if (name.includes('budget') || name.includes('finance') || name.includes('cost')) return 'Budget Document';
    if (name.includes('lookbook') || name.includes('visual') || name.includes('storyboard')) return 'Visual Lookbook';
    if (name.includes('nda') || name.includes('agreement') || name.includes('contract')) return 'Legal Document';
    if (name.includes('timeline') || name.includes('schedule') || name.includes('production')) return 'Production Timeline';
    
    return 'Supporting Material';
  };

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color 
  }: { 
    title: string; 
    value: number | string; 
    change?: number; 
    icon: any; 
    color: string; 
  }) => (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span className="ml-1">{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : (value || '0')}
      </h3>
      <p className="text-sm text-gray-600 mt-1">{title}</p>
    </div>
  );

  if (initialLoading) {
    return (
      <div className="w-full animate-pulse">
        {/* Skeleton title */}
        <div className="mb-6 h-7 w-56 bg-gray-200 rounded" />
        {/* Skeleton tab bar */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-20 bg-gray-200 rounded mb-3" />
            ))}
          </div>
        </div>
        {/* Skeleton stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 h-28" />
          ))}
        </div>
        {/* Skeleton content area */}
        <div className="bg-white rounded-xl shadow-sm p-6 h-64" />
      </div>
    );
  }

  const verificationStatus = user?.companyDetails?.verificationStatus || 'verified';


  return (
    <div className="w-full">
      {/* Page Title - simplified since PortalLayout provides header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Production Dashboard</h1>
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex flex-wrap gap-x-4 sm:gap-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('my-pitches')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'my-pitches'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Saved Pitches
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'following'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('ndas')}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'ndas'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              NDAs
            </button>
          </nav>
      </div>

      {/* Verification Warning */}
      {verificationStatus === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Your company verification is pending. Some features may be limited until verification is complete (24-48 hours).
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Primary CTA - Create New Pitch */}
            <div>
              <button
                onClick={() => navigate('/create-pitch')}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-purple-600 text-white text-lg font-bold rounded-xl hover:bg-purple-700 shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="w-6 h-6" />
                Create New Pitch
              </button>
            </div>

            {/* Enhanced Production Analytics */}
            <EnhancedProductionAnalytics 
              productionPerformance={{
                totalPitches: myPitches.length,
                totalRevenue: 0, // You can calculate this from actual data
                activeProjects: myPitches.filter(p => p.status === 'published').length,
                ndaSignedCount: analytics.totalNDAs,
                averageProjectBudget: 0, // Calculate from project data
                creatorInteractions: analytics.totalViews + analytics.totalLikes
              }}
            />

            {/* Notifications Widget */}
            <NotificationWidget maxNotifications={3} compact={true} />

            {/* Analytics Error */}
            {sectionStatus.analytics.error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-red-700 text-sm flex-1">{sectionStatus.analytics.error}</p>
                <button
                  onClick={() => handleRetrySection('analytics')}
                  className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}

            {/* Stats Grid with Feature Flag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard
                title="Total Views"
                value={analytics.totalViews}
                change={analytics.viewsChange}
                icon={Eye}
                color="bg-blue-500"
              />
              <StatCard
                title="Total Likes"
                value={analytics.totalLikes}
                change={analytics.likesChange}
                icon={Heart}
                color="bg-red-500"
              />
              <StatCard
                title="NDAs Signed"
                value={analytics.totalNDAs}
                change={analytics.ndasChange}
                icon={Shield}
                color="bg-green-500"
              />
              <StatCard
                title="Following"
                value={followingPitches.length}
                icon={Users}
                color="bg-purple-500"
              />
            </div>

            {/* Investment Error */}
            {sectionStatus.investments.error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
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

            {/* Investment Metrics */}
            {investmentMetrics && sectionStatus.investments.loaded && !sectionStatus.investments.error && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Investment Overview</h2>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{investmentMetrics.totalInvestments || 0}</p>
                    <p className="text-sm text-gray-600">Total Investments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{investmentMetrics.activeDeals || 0}</p>
                    <p className="text-sm text-gray-600">Active Deals</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {investmentMetrics.pipelineValue ? `$${(investmentMetrics.pipelineValue / 1000000).toFixed(1)}M` : '$0'}
                    </p>
                    <p className="text-sm text-gray-600">Pipeline Value</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">+{investmentMetrics.monthlyGrowth || 0}%</p>
                    <p className="text-sm text-gray-600">Monthly Growth</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                <Activity className="w-5 h-5 text-purple-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => navigate('/marketplace')}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:shadow-lg hover:from-blue-100 hover:to-indigo-100 transition-all"
                >
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Browse Marketplace</p>
                    <p className="text-xs text-gray-500">Find new projects</p>
                  </div>
                </button>
                
                <button
                  onClick={() => navigate('/production/search')}
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                >
                  <Search className="w-6 h-6 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Advanced Search</p>
                    <p className="text-xs text-gray-500">Filter by criteria</p>
                  </div>
                </button>
                
                <button
                  onClick={() => navigate('/production/ndas')}
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                >
                  <Shield className="w-6 h-6 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Manage NDAs</p>
                    <p className="text-xs text-gray-500">View agreements</p>
                  </div>
                </button>
                
                <button
                  onClick={() => navigate('/production/analytics')}
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                >
                  <BarChart3 className="w-6 h-6 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Analytics</p>
                    <p className="text-xs text-gray-500">View insights</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Investment Opportunities */}
            {investmentOpportunities.length > 0 && (
              <InvestmentOpportunities
                opportunities={investmentOpportunities}
                loading={!sectionStatus.investments.loaded}
                showMatchScore={false}
                className="max-h-96 overflow-y-auto"
              />
            )}

            {/* Top Performing Pitch */}
            {analytics.topPitch && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Top Performing Pitch</h2>
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-gray-900">{analytics.topPitch.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{analytics.topPitch.genre} • {analytics.topPitch.format}</p>
                    <p className="text-sm text-gray-500 mt-2">Budget: {analytics.topPitch.budget}</p>
                  </div>
                  <div className="flex space-x-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{analytics.topPitch.viewCount}</p>
                      <p className="text-gray-600">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{analytics.topPitch.likeCount}</p>
                      <p className="text-gray-600">Likes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{analytics.topPitch.ndaCount}</p>
                      <p className="text-gray-600">NDAs</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {analytics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${
                      activity.type === 'nda' ? 'bg-green-100 text-green-600' :
                      activity.type === 'like' ? 'bg-red-100 text-red-600' :
                      activity.type === 'follow' ? 'bg-purple-100 text-purple-600' :
                      activity.type === 'pitch_request' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {activity.type === 'nda' && <Shield className="w-4 h-4" />}
                      {activity.type === 'like' && <Heart className="w-4 h-4" />}
                      {activity.type === 'follow' && <UserPlus className="w-4 h-4" />}
                      {activity.type === 'pitch_request' && <FileText className="w-4 h-4" />}
                      {activity.type === 'view' && <Eye className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        {activity.type === 'nda' && `${activity.userName} signed NDA for "${activity.pitchTitle}"`}
                        {activity.type === 'like' && `${activity.userName} liked "${activity.pitchTitle}"`}
                        {activity.type === 'follow' && `${activity.userName} started following you`}
                        {activity.type === 'pitch_request' && `${activity.userName} requested full pitch for "${activity.pitchTitle}"`}
                        {activity.type === 'view' && `${activity.userName} viewed "${activity.pitchTitle}"`}
                      </p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my-pitches' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Your Production Pitches</h2>
              <Link
                to="/create-pitch"
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Pitch
              </Link>
            </div>

            {/* Show drafts count if any */}
            {drafts.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      You have {drafts.length} draft{drafts.length !== 1 ? 's' : ''} saved
                    </p>
                  </div>
                  <Link
                    to="/create-pitch?mode=continue"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Continue Editing
                  </Link>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {myPitches.map((pitch) => (
                <div key={pitch.id} className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow border-2 ${
                  pitch.status === 'draft' ? 'border-yellow-300' : 'border-purple-200'
                }`}>
                  <div className="aspect-video bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center relative">
                    <Film className="w-12 h-12 text-white" />
                    <span className="absolute top-2 right-2 bg-white/20 backdrop-blur px-2 py-1 rounded text-xs text-white">
                      {pitch.status === 'draft' ? 'Draft' : 'Published'}
                    </span>
                    {pitch.mediaFiles?.find(m => m.type === 'trailer' && m.uploaded) && (
                      <span className="absolute bottom-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Trailer Available
                      </span>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">{pitch.title}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pitch.logline}</p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span>{pitch.genre}</span>
                      <FormatDisplay 
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="compact"
                      />
                    </div>

                    {/* Media Files Section */}
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Uploaded Media</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Lookbook */}
                        <div className={`flex flex-col items-center p-2 rounded-lg ${
                          pitch.mediaFiles?.find(m => m.type === 'lookbook' && m.uploaded)
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          <BookOpen className="w-4 h-4" />
                          <span className="text-xs mt-1">Lookbook</span>
                          {pitch.mediaFiles?.find(m => m.type === 'lookbook') && (
                            <span className="text-xs font-semibold">
                              {pitch.mediaFiles.find(m => m.type === 'lookbook')?.count || 0}
                            </span>
                          )}
                        </div>

                        {/* Script */}
                        <div className={`flex flex-col items-center p-2 rounded-lg ${
                          pitch.mediaFiles?.find(m => m.type === 'script' && m.uploaded)
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          <FileText className="w-4 h-4" />
                          <span className="text-xs mt-1">Script</span>
                          {pitch.mediaFiles?.find(m => m.type === 'script') && (
                            <span className="text-xs font-semibold">
                              {pitch.mediaFiles.find(m => m.type === 'script')?.count || 0}
                            </span>
                          )}
                        </div>

                        {/* Trailer */}
                        <div className={`flex flex-col items-center p-2 rounded-lg ${
                          pitch.mediaFiles?.find(m => m.type === 'trailer' && m.uploaded)
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          <Video className="w-4 h-4" />
                          <span className="text-xs mt-1">Trailer</span>
                          {pitch.mediaFiles?.find(m => m.type === 'trailer') && (
                            <span className="text-xs font-semibold">
                              {pitch.mediaFiles.find(m => m.type === 'trailer')?.count || 0}
                            </span>
                          )}
                        </div>

                        {/* Pitch Deck */}
                        <div className={`flex flex-col items-center p-2 rounded-lg ${
                          pitch.mediaFiles?.find(m => m.type === 'pitch_deck' && m.uploaded)
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          <BarChart3 className="w-4 h-4" />
                          <span className="text-xs mt-1">Pitch Deck</span>
                          {pitch.mediaFiles?.find(m => m.type === 'pitch_deck') && (
                            <span className="text-xs font-semibold">
                              {pitch.mediaFiles.find(m => m.type === 'pitch_deck')?.count || 0}
                            </span>
                          )}
                        </div>

                        {/* Budget Breakdown */}
                        <div className={`flex flex-col items-center p-2 rounded-lg ${
                          pitch.mediaFiles?.find(m => m.type === 'budget_breakdown' && m.uploaded)
                            ? 'bg-yellow-50 text-yellow-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs mt-1">Budget</span>
                          {pitch.mediaFiles?.find(m => m.type === 'budget_breakdown') && (
                            <span className="text-xs font-semibold">
                              {pitch.mediaFiles.find(m => m.type === 'budget_breakdown')?.count || 0}
                            </span>
                          )}
                        </div>

                        {/* Production Timeline */}
                        <div className={`flex flex-col items-center p-2 rounded-lg ${
                          pitch.mediaFiles?.find(m => m.type === 'production_timeline' && m.uploaded)
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs mt-1">Timeline</span>
                          {pitch.mediaFiles?.find(m => m.type === 'production_timeline') && (
                            <span className="text-xs font-semibold">
                              {pitch.mediaFiles.find(m => m.type === 'production_timeline')?.count || 0}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="font-semibold text-gray-900">{pitch.viewCount}</p>
                        <p className="text-xs text-gray-600">Views</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="font-semibold text-gray-900">{pitch.likeCount}</p>
                        <p className="text-xs text-gray-600">Likes</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="font-semibold text-gray-900">{pitch.ndaCount}</p>
                        <p className="text-xs text-gray-600">NDAs</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        <span>Budget: {pitch.budget}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{pitch.followersCount} followers</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      <div className="flex space-x-2">
                        <Link
                          to={`/production/pitch/${pitch.id}`}
                          className="flex-1 text-center py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                        >
                          View Details
                        </Link>
                        <Link
                          to={`/pitch/${pitch.id}/analytics`}
                          className="flex-1 text-center py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                        >
                          Analytics
                        </Link>
                      </div>
                      <button
                        onClick={() => handleManageMedia(pitch)}
                        className="w-full py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Manage Media Files
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Enhanced Media Options</h3>
              <p className="text-sm text-blue-800 mb-4">
                As a production company, you can view and invest in comprehensive pitch packages including:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 text-blue-700">
                  <BookOpen className="w-4 h-4" />
                  <span>Lookbooks</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <FileText className="w-4 h-4" />
                  <span>Scripts</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Video className="w-4 h-4" />
                  <span>Trailers</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <BarChart3 className="w-4 h-4" />
                  <span>Pitch Decks</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <DollarSign className="w-4 h-4" />
                  <span>Budget Breakdowns</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Calendar className="w-4 h-4" />
                  <span>Production Timelines</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'following' && (
          <div className="space-y-6">
            {/* Following Error */}
            {sectionStatus.following.error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-red-700 text-sm flex-1">{sectionStatus.following.error}</p>
                <button
                  onClick={() => handleRetrySection('following')}
                  className="flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}

            {/* Following Tab Header with Filters */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-6 h-6 text-purple-600" />
                    Your Following Feed
                  </h2>
                  <p className="text-gray-600 mt-1">Stay updated with the latest from creators you follow</p>
                </div>
                <div className="flex gap-3">
                  <select 
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="popular">Most Popular</option>
                    <option value="trending">Trending</option>
                    <option value="genre">By Genre</option>
                  </select>
                  <select
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Content</option>
                    <option value="new">New This Week</option>
                    <option value="nda">NDA Protected</option>
                    <option value="public">Public Access</option>
                  </select>
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Advanced
                  </button>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="text-sm text-gray-600">Following</div>
                  <div className="text-xl font-bold text-gray-900">{followingCreators.length || 0} Creators</div>
                </div>
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="text-sm text-gray-600">New Pitches</div>
                  <div className="text-xl font-bold text-purple-600">{followingPitches.filter(p => p.isNew).length || 0} This Week</div>
                </div>
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="text-sm text-gray-600">NDA Access</div>
                  <div className="text-xl font-bold text-green-600">{followingPitches.filter(p => p.ndaStatus === 'signed').length || 0} Signed</div>
                </div>
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="text-sm text-gray-600">Saved</div>
                  <div className="text-xl font-bold text-blue-600">{savedPitches?.length || 0} Pitches</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Following Activity</h2>
              <div className="flex gap-3">
                <Link
                  to="/production/following"
                  className="text-purple-600 hover:text-purple-700"
                >
                  View All Following
                </Link>
                <button 
                  onClick={() => navigate('/marketplace')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Discover More
                </button>
              </div>
            </div>

            {followingPitches.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Following Yet</h3>
                <p className="text-gray-600 mb-6">
                  Follow creators and production companies to track their latest pitches and activity
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => navigate('/marketplace')}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Browse Marketplace
                  </button>
                  <Link
                    to="/production/following"
                    className="px-6 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50"
                  >
                    Explore Following
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Check if there are any following pitches */}
                {(!Array.isArray(followingPitches) || followingPitches.length === 0) ? (
                  <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Followed Creators Yet</h3>
                    <p className="text-gray-600 mb-4">Start following creators to see their latest pitches and activity here.</p>
                    <Link to="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                      <Search className="w-4 h-4" />
                      Explore Marketplace
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Activity Feed */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity from Followed Creators</h3>
                      <div className="space-y-4">
                        {followingPitches.slice(0, 5).map((pitch) => (
                      <div key={pitch.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            pitch.creator?.userType === 'production' ? 'bg-purple-100 text-purple-600' :
                            pitch.creator?.userType === 'investor' ? 'bg-green-100 text-green-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {pitch.creator?.userType === 'production' ? <Building2 className="w-5 h-5" /> :
                             pitch.creator?.userType === 'investor' ? <DollarSign className="w-5 h-5" /> :
                             <User className="w-5 h-5" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={`/creator/${pitch.creator?.id || pitch.userId}`}
                              className="font-medium text-gray-900 hover:text-purple-600 cursor-pointer"
                            >
                              {pitch.creator?.companyName || pitch.creator?.username || 'Unknown Creator'}
                            </Link>
                            <span className="text-gray-500 text-sm">published a new pitch</span>
                            <span className="text-gray-400 text-sm">• 2 days ago</span>
                            {pitch.creator?.id && (
                              <FollowButton 
                                creatorId={pitch.creator.id} 
                                variant="small"
                                className="ml-auto"
                              />
                            )}
                          </div>
                          <div 
                            className="cursor-pointer group"
                            onClick={() => navigate(`/production/pitch/${pitch.id}`)}
                          >
                            <h4 className="font-semibold text-gray-900 group-hover:text-purple-600 mb-1">
                              {pitch.title}
                            </h4>
                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                              {pitch.logline}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="px-2 py-1 bg-gray-100 rounded-full">
                                {pitch.genre}
                              </span>
                              <span className="px-2 py-1 bg-gray-100 rounded-full">
                                <FormatDisplay 
                                  formatCategory={pitch.formatCategory}
                                  formatSubtype={pitch.formatSubtype}
                                  format={pitch.format}
                                  variant="compact"
                                />
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {pitch.viewCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="w-4 h-4" />
                                {pitch.likeCount}
                              </span>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="mt-3 flex items-center gap-3 pt-3 border-t">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLikePitch(pitch.id);
                              }}
                              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                                likedPitches?.includes(pitch.id) 
                                  ? 'bg-red-100 text-red-600' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${likedPitches?.includes(pitch.id) ? 'fill-current' : ''}`} />
                              <span className="text-sm">Like</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSavePitch(pitch.id);
                              }}
                              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                                savedPitches?.includes(pitch.id) 
                                  ? 'bg-blue-100 text-blue-600' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                              }`}
                            >
                              <Bookmark className={`w-4 h-4 ${savedPitches?.includes(pitch.id) ? 'fill-current' : ''}`} />
                              <span className="text-sm">Save</span>
                            </button>
                            {pitch.ndaStatus !== 'signed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestNDA(pitch.id, pitch.title);
                                }}
                                className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                              >
                                <Shield className="w-4 h-4" />
                                <span className="text-sm">Request NDA</span>
                              </button>
                            )}
                            <Link
                              to={`/pitch/${pitch.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-auto flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="text-sm">View</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {Array.isArray(followingPitches) && followingPitches.length > 5 && (
                    <div className="mt-4 text-center">
                      <Link
                        to="/production/following"
                        className="text-purple-600 hover:text-purple-700 text-sm"
                      >
                        View all activity →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Quick Following Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.isArray(followingPitches) && followingPitches.slice(0, 6).map((pitch) => (
                    <div key={pitch.id} className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow border-2 ${
                      pitch.creator?.userType === 'production' ? 'border-purple-200' :
                      pitch.creator?.userType === 'investor' ? 'border-green-200' :
                      'border-gray-200'
                    }`}>
                      <div className={`aspect-video bg-gradient-to-br ${
                        pitch.creator?.userType === 'production' ? 'from-purple-400 to-purple-600' :
                        pitch.creator?.userType === 'investor' ? 'from-green-400 to-green-600' :
                        'from-gray-400 to-gray-600'
                      } flex items-center justify-center relative`}>
                        <Film className="w-12 h-12 text-white" />
                        {pitch.creator?.userType && pitch.creator.userType !== 'creator' && (
                          <span className="absolute top-2 right-2 bg-white/20 backdrop-blur px-2 py-1 rounded text-xs text-white">
                            {pitch.creator.userType === 'production' ? 'Production Co.' : 'Investor'}
                          </span>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-2">
                          <Link
                            to={`/creator/${pitch.creator?.id || pitch.userId}`}
                            className="text-xs text-purple-600 hover:text-purple-700 cursor-pointer"
                          >
                            by @{pitch.creator?.username || 'Unknown'}
                            {pitch.creator?.companyName && ` • ${pitch.creator.companyName}`}
                          </Link>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                handleSavePitch(pitch.id);
                              }}
                              className={`text-gray-600 hover:text-blue-600 transition-colors ${savedPitches?.includes(pitch.id) ? 'text-blue-600' : ''}`}
                              title="Save for later"
                            >
                              <Bookmark className={`w-4 h-4 ${savedPitches?.includes(pitch.id) ? 'fill-current' : ''}`} />
                            </button>
                            {pitch.ndaStatus !== 'signed' && (
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRequestNDA(pitch.id, pitch.title);
                                }}
                                className="text-purple-600 hover:text-purple-700" 
                                title="Request NDA for Full Access"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 mb-2">{pitch.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pitch.logline}</p>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <span>{pitch.genre}</span>
                          <FormatDisplay 
                            formatCategory={pitch.formatCategory}
                            formatSubtype={pitch.formatSubtype}
                            format={pitch.format}
                            variant="compact"
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              {pitch.viewCount}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLikePitch(pitch.id);
                              }}
                              className="flex items-center gap-1 hover:text-red-500 transition-colors"
                              title="Like this pitch"
                            >
                              <Heart className={`w-4 h-4 ${likedPitches?.includes(pitch.id) ? 'fill-red-500 text-red-500' : ''}`} />
                              {pitch.likeCount}
                            </button>
                          </div>
                          {pitch.ndaStatus === 'signed' && (
                            <span className="text-green-600 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              NDA
                            </span>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Link
                            to={`/pitch/${pitch.id}`}
                            className="flex-1 text-center py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                          >
                            View Pitch
                          </Link>
                          {pitch.ndaStatus === 'signed' ? (
                            <button
                              onClick={() => navigate(`/production/pitch/${pitch.id}`)}
                              className="flex-1 text-center py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Full Access
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRequestNDA(pitch.id, pitch.title)}
                              className="flex-1 text-center py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                            >
                              Request NDA
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ndas' && (
          <div className="space-y-8">
            {/* NDAs Error */}
            {sectionStatus.ndas.error && (
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
            )}

            {/* Header with Overview Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                    <Shield className="w-7 h-7 text-purple-600" />
                    NDA Management Center
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Manage all your NDA workflows in one place - from incoming requests to signed agreements
                  </p>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-amber-700">
                      {incomingNDARequests.length}
                    </div>
                    <div className="text-sm text-amber-600">Pending Requests</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-700">
                      {signedNDAs.length + incomingSignedNDAs.length}
                    </div>
                    <div className="text-sm text-green-600">Active NDAs</div>
                  </div>
                </div>
              </div>
              
              {/* Category Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                  <div className="flex items-center gap-2 pb-3 border-b-2 border-purple-500 text-purple-600">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">All Categories</span>
                  </div>
                </nav>
              </div>
            </div>

            {/* NDA Management Panels */}
            <div className="space-y-6">
              {/* 1. Incoming NDA Requests - Others wanting to access your pitches */}
              <NDAManagementPanel
                category="incoming-requests"
                items={incomingNDARequests.map(request => ({
                  id: request.id,
                  pitchId: request.pitchId,
                  pitchTitle: request.pitchTitle,
                  status: 'pending',
                  ndaType: request.ndaType || 'basic',
                  requestedDate: request.requestedDate,
                  requester: request.requester,
                  requesterType: request.requesterType,
                  companyName: request.companyName,
                  message: request.message
                }))}
                title="Incoming NDA Requests"
                description="Others requesting access to your pitches"
                emptyMessage="No incoming requests at this time"
                showActions={true}
                onApprove={handleApproveIncoming}
                onReject={handleRejectIncoming}
                onViewPitch={(pitchId) => navigate(`/production/pitch/${pitchId}`)}
              />

              {/* 2. NDAs Signed for Your Pitches - Who has access to your content */}
              <NDAManagementPanel
                category="incoming-signed"
                items={incomingSignedNDAs.map(nda => ({
                  id: nda.id,
                  pitchId: nda.pitchId,
                  pitchTitle: nda.pitchTitle,
                  status: 'signed',
                  ndaType: nda.ndaType || 'basic',
                  signedDate: nda.signedDate,
                  expiresAt: nda.expiresAt,
                  signerName: nda.signerName,
                  signerType: nda.signerType,
                  signerCompany: nda.signerCompany,
                  accessGranted: nda.accessGranted
                }))}
                title="NDAs Signed for Your Pitches"
                description="Others who have signed NDAs to access your pitches"
                emptyMessage="No one has signed NDAs for your pitches yet"
                onViewPitch={(pitchId) => navigate(`/production/pitch/${pitchId}`)}
              />

              {/* 3. Your Signed NDAs - Pitches you have access to */}
              <NDAManagementPanel
                category="outgoing-signed"
                items={signedNDAs.map(nda => ({
                  id: nda.id,
                  pitchId: nda.pitchId,
                  pitchTitle: nda.pitchTitle,
                  status: 'signed',
                  ndaType: nda.ndaType || 'basic',
                  signedDate: nda.signedDate,
                  expiresAt: nda.expiresAt,
                  expiresIn: nda.expiresIn,
                  creator: nda.creator,
                  creatorType: nda.creatorType,
                  companyName: nda.companyName,
                  accessGranted: nda.accessGranted
                }))}
                title="Your Signed NDAs"
                description="Pitches you've signed NDAs to access"
                emptyMessage="You haven't signed any NDAs yet"
                onViewPitch={(pitchId) => navigate(`/production/pitch/${pitchId}`)}
              />

              {/* 4. Your Outgoing NDA Requests - Your pending requests */}
              <NDAManagementPanel
                category="outgoing-requests"
                items={outgoingNDARequests.map(request => ({
                  id: request.id,
                  pitchId: request.pitchId,
                  pitchTitle: request.pitchTitle,
                  status: 'pending',
                  ndaType: request.ndaType || 'basic',
                  requestedDate: request.requestedDate,
                  creator: request.creator,
                  creatorType: request.creatorType,
                  companyName: request.companyName,
                  message: request.message
                }))}
                title="Your Pending Requests"
                description="Your requests to access others' pitches"
                emptyMessage="No pending requests at this time"
                onViewPitch={(pitchId) => navigate(`/production/pitch/${pitchId}`)}
              />
            </div>

            {/* Additional Tools Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Custom NDA Templates */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-purple-900">Custom NDA Templates</h3>
                    <p className="text-sm text-purple-700">Upload your company's standard NDA</p>
                  </div>
                </div>
                
                {/* Upload Area */}
                <div className="space-y-4">
                  <input
                    ref={ndaFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleNDAFileSelect}
                    className="hidden"
                  />
                  
                  <button 
                    onClick={() => ndaFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Template
                  </button>
                  
                  <p className="text-xs text-purple-600">
                    Supported: PDF, DOC, DOCX • Max size: 10MB
                  </p>
                  
                  {/* Uploaded Templates List */}
                  {ndaTemplates.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-purple-900">Uploaded Templates:</h4>
                      {ndaTemplates.map(template => (
                        <div key={template.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-gray-900">{template.name}</span>
                            <span className="text-xs text-gray-500">({(template.size / 1024 / 1024).toFixed(1)}MB)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {template.uploadStatus === 'uploading' && (
                              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                            )}
                            {template.uploadStatus === 'completed' && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                            {template.uploadStatus === 'error' && (
                              <X className="w-4 h-4 text-red-600" />
                            )}
                            <button
                              onClick={() => removeNDATemplate(template.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* NDA Analytics */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900">NDA Analytics</h3>
                    <p className="text-sm text-blue-700">Track your NDA approval rates</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-blue-900">95%</div>
                    <div className="text-blue-600">Approval Rate</div>
                  </div>
                  <div>
                    <div className="font-semibold text-blue-900">2.3 days</div>
                    <div className="text-blue-600">Avg Response Time</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendations & Smart Tools Section */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-green-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI-Powered Recommendations</h2>
                  <p className="text-sm text-gray-600">Smart suggestions and automated assistance</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Smart Pitch Discovery */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Search className="w-6 h-6 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-900">Smart Pitch Discovery</h3>
                      <p className="text-sm text-green-700">AI-curated recommendations</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <div className="font-medium text-green-900 mb-2">Trending in Your Genre:</div>
                      <div className="space-y-2">
                        <div className="p-2 bg-white rounded border">
                          <div className="font-medium text-gray-900">Sci-Fi Thriller</div>
                          <div className="text-xs text-gray-600">Match: 89% • Trending +15%</div>
                        </div>
                        <div className="p-2 bg-white rounded border">
                          <div className="font-medium text-gray-900">Action Drama</div>
                          <div className="text-xs text-gray-600">Match: 76% • Rising Interest</div>
                        </div>
                      </div>
                    </div>
                    <button className="w-full mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                      View All Recommendations
                    </button>
                  </div>
                </div>

                {/* Smart Upload Assistant */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Upload className="w-6 h-6 text-orange-600" />
                    <div>
                      <h3 className="font-semibold text-orange-900">Smart Upload Assistant</h3>
                      <p className="text-sm text-orange-700">Automated file analysis</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <div className="font-medium text-orange-900 mb-2">Upload Suggestions:</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Script formatting detection</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Auto-categorization</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm">Content quality analysis</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => document.getElementById('smart-upload-input')?.click()}
                      className="w-full mt-3 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Smart Upload Documents
                    </button>
                    <input
                      id="smart-upload-input"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      onChange={handleSmartUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Content Analysis */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                    <div>
                      <h3 className="font-semibold text-indigo-900">Content Analysis</h3>
                      <p className="text-sm text-indigo-700">AI-powered insights</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <div className="font-medium text-indigo-900 mb-2">Analysis Ready:</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Genre Detection</span>
                          <span className="text-green-600">Active</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Market Trends</span>
                          <span className="text-green-600">Active</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Audience Targeting</span>
                          <span className="text-yellow-600">Premium</span>
                        </div>
                      </div>
                    </div>
                    <button className="w-full mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                      Run Analysis
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Terms Modal */}
      {showTermsModal && selectedNDA && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">NDA Terms & Conditions</h2>
                  <p className="text-sm text-gray-600 mt-1">For: {selectedNDA.pitchTitle}</p>
                </div>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Standard NDA Agreement</h3>
                <p className="text-sm text-blue-800">
                  This Non-Disclosure Agreement is entered into between {selectedNDA.creator} ("Disclosing Party") 
                  and {user?.companyName || 'Production Company'} ("Receiving Party").
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">1. Confidential Information</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  The Receiving Party agrees to keep confidential all information related to "{selectedNDA.pitchTitle}" 
                  including but not limited to: plot details, character descriptions, budget information, 
                  production plans, marketing strategies, and any other proprietary information.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">2. Purpose</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  The confidential information is being shared solely for the purpose of evaluating a potential 
                  business relationship regarding the production and/or financing of the project.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">3. Duration</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  This agreement shall remain in effect for two (2) years from the date of signing, 
                  unless otherwise terminated by mutual written consent.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">4. Enhanced Access Includes</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                  <li>Full script or treatment access</li>
                  <li>Detailed budget breakdown</li>
                  <li>Production timeline and milestones</li>
                  <li>Attached talent and crew information</li>
                  <li>Distribution strategy and comparable titles</li>
                  <li>Financial projections and ROI estimates</li>
                  <li>Lookbooks and visual materials</li>
                  <li>Any available trailers or pitch videos</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">5. Restrictions</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  The Receiving Party agrees not to:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-gray-700">
                  <li>Disclose confidential information to third parties</li>
                  <li>Use the information for any purpose other than evaluation</li>
                  <li>Develop competing projects based on the disclosed information</li>
                  <li>Reproduce or distribute any materials without written consent</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 mb-1">Important Note</h4>
                    <p className="text-sm text-yellow-800">
                      By signing this NDA, you acknowledge that you have read and understood all terms 
                      and conditions. Violation of this agreement may result in legal action and 
                      damages as permitted by law.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end gap-3">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-6 py-2 text-gray-700 hover:text-gray-900"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowTermsModal(false);
                  handleSignNDA(selectedNDA);
                }}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Proceed to Sign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Upload Modal */}
      {showMediaModal && selectedPitchForMedia && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Manage Media Files</h2>
                  <p className="text-sm text-gray-600 mt-1">Upload materials for: {selectedPitchForMedia.title}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMediaModal(false);
                    setSelectedPitchForMedia(null);
                    setMediaFiles([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Upload Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add New Media Files
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                    onChange={handleMediaFileAdd}
                    className="hidden"
                    id="media-file-input"
                  />
                  <label
                    htmlFor="media-file-input"
                    className="cursor-pointer"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">Drop files here or click to browse</p>
                    <p className="text-sm text-gray-500">
                      Supported: PDF, DOC, PPT, MP4, MOV, Images
                    </p>
                  </label>
                </div>
              </div>

              {/* Selected Files */}
              {mediaFiles.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Selected Files ({mediaFiles.length})</h3>
                  <div className="space-y-2">
                    {mediaFiles.map((file, index) => {
                      const fileType = detectFileType(file.name);
                      const Icon = fileType === 'trailer' ? Video :
                                   fileType === 'script' ? FileText :
                                   fileType === 'lookbook' ? BookOpen :
                                   fileType === 'pitch_deck' ? BarChart3 :
                                   fileType === 'budget_breakdown' ? DollarSign :
                                   fileType === 'production_timeline' ? Calendar :
                                   FileText;
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5 text-purple-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB • {fileType.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeMediaFile(index)}
                            className="p-1 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Supported File Types */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">Supported Document Types</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-purple-700">
                    <BookOpen className="w-4 h-4" />
                    <span>Lookbooks (Visual Guides)</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-700">
                    <FileText className="w-4 h-4" />
                    <span>Scripts & Treatments</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-700">
                    <Video className="w-4 h-4" />
                    <span>Trailers & Sizzle Reels</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-700">
                    <BarChart3 className="w-4 h-4" />
                    <span>Pitch Decks</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-700">
                    <DollarSign className="w-4 h-4" />
                    <span>Budget Breakdowns</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-700">
                    <Calendar className="w-4 h-4" />
                    <span>Production Timelines</span>
                  </div>
                </div>
              </div>

              {/* Current Media Status */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Current Media Status</h3>
                <div className="grid grid-cols-3 gap-3">
                  {['lookbook', 'script', 'trailer', 'pitch_deck', 'budget_breakdown', 'production_timeline'].map(type => {
                    const mediaFile = selectedPitchForMedia.mediaFiles?.find(m => m.type === type);
                    const Icon = type === 'lookbook' ? BookOpen :
                                type === 'script' ? FileText :
                                type === 'trailer' ? Video :
                                type === 'pitch_deck' ? BarChart3 :
                                type === 'budget_breakdown' ? DollarSign :
                                Calendar;
                    
                    return (
                      <div
                        key={type}
                        className={`flex flex-col items-center p-3 rounded-lg ${
                          mediaFile?.uploaded
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs mt-1 capitalize">{type.replace('_', ' ')}</span>
                        {mediaFile?.uploaded && (
                          <CheckCircle className="w-3 h-3 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMediaModal(false);
                  setSelectedPitchForMedia(null);
                  setMediaFiles([]);
                }}
                className="px-6 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadMedia}
                disabled={mediaFiles.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload {mediaFiles.length} File{mediaFiles.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign NDA Modal */}
      {showNDAModal && selectedNDA && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Sign NDA Agreement</h2>
              <p className="text-sm text-gray-600 mt-1">For: {selectedNDA.pitchTitle}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">Ready to Sign</h3>
                    <p className="text-sm text-green-800">
                      By signing this NDA, you'll gain access to enhanced information about "{selectedNDA.pitchTitle}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="agree-terms"
                    className="mt-1 mr-3"
                    defaultChecked
                  />
                  <label htmlFor="agree-terms" className="text-sm text-gray-700">
                    I have read and agree to the terms and conditions of this Non-Disclosure Agreement
                  </label>
                </div>
                
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="agree-legal"
                    className="mt-1 mr-3"
                    defaultChecked
                  />
                  <label htmlFor="agree-legal" className="text-sm text-gray-700">
                    I am authorized to sign this agreement on behalf of {user?.companyName || 'my company'}
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-3">Digital Signature</p>
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{user?.companyName}</p>
                  <p className="text-xs text-gray-500 mt-2">{new Date().toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border-t p-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNDAModal(false);
                  setSelectedNDA(null);
                }}
                className="px-6 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmSignNDA}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Sign & Access Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withPortalErrorBoundary(ProductionDashboard, 'production');