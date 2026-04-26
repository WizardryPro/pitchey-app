import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Share2, Eye, Calendar, User, Clock, Tag, Film, LogIn, FileText, Lock, Shield, Briefcase, DollarSign, WifiOff, RefreshCw, Bookmark, Heart } from 'lucide-react';
import PitcheyRating from '../components/PitcheyRating';
import { pitchService } from '@features/pitches/services/pitch.service';
import { createDownloadClickHandler } from '../utils/fileDownloads';
import type { Pitch } from '@features/pitches/services/pitch.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import BackButton from '../components/BackButton';
import EnhancedNDARequest from '@features/ndas/components/NDA/EnhancedNDARequest';
import FormatDisplay from '../components/FormatDisplay';
import FollowButton from '@features/browse/components/FollowButton';
import SocialProofBadge from '@shared/components/SocialProofBadge';
import { formatCurrency } from '@shared/utils/formatters';
import FeedbackSection from '../components/feedback/FeedbackSection';
import HeatBadge, { getHeatScore } from '../components/HeatBadge';
import VerificationBadge from '../components/VerificationBadge';
import HumanMadeBadge from '../components/HumanMadeBadge';
import { viewService } from '@features/analytics/services/view.service';
import PortalTopNav from '@shared/components/layout/PortalTopNav';

export default function PitchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const isInsidePortal = /^\/(watcher|creator|investor|production|admin)\//.test(location.pathname);
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useBetterAuthStore();
  const goToLogin = () => navigate('/portals', { state: { from: location.pathname + location.search } });
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showEnhancedNDARequest, setShowEnhancedNDARequest] = useState(false);
  const [hasSignedNDA, setHasSignedNDA] = useState(false);
  const isOnline = useOnlineStatus();

  // Check if current user owns this pitch
  // First check the isOwner flag from backend, then fallback to comparing IDs
  // Handle both direct user object and nested user.data structure
  const getUserId = (): number | null => {
    if (!user) return null;
    // Check if user has an id directly
    if (user.id !== undefined) return user.id;
    // Check if user is nested in data
    if ((user as any).data?.id !== undefined) return (user as any).data.id;
    // Check if user has user property
    if ((user as any).user?.id !== undefined) return (user as any).user.id;
    return null;
  };
  
  const currentUserId = getUserId();
  
  // Secure owner check - only return true if IDs are valid and match
  const isOwner = (() => {
    // First check the backend-provided isOwner flag (most reliable)
    if (pitch?.isOwner === true) return true;
    
    // If no backend flag, validate IDs manually
    if (!currentUserId || !pitch) return false;
    
    // Check pitch.userId (ensure both IDs are valid numbers)
    if (pitch.userId) {
      const pitchUserId = Number(pitch.userId);
      const currentUserIdNum = Number(currentUserId);
      
      // Only return true if both are valid numbers and match
      if (!isNaN(pitchUserId) && !isNaN(currentUserIdNum) && pitchUserId === currentUserIdNum) {
        return true;
      }
    }
    
    // Check pitch.creator.id (ensure both IDs are valid numbers)
    if (pitch.creator?.id) {
      const creatorId = Number(pitch.creator.id);
      const currentUserIdNum = Number(currentUserId);
      
      // Only return true if both are valid numbers and match
      if (!isNaN(creatorId) && !isNaN(currentUserIdNum) && creatorId === currentUserIdNum) {
        return true;
      }
    }
    
    // Default to false for security
    return false;
  })();
  
  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id, isAuthenticated]);

  // View-duration heartbeat — drives the consumption gate on feedback submission.
  // Only track for authenticated non-owner viewers; start once pitch is loaded.
  useEffect(() => {
    if (!id || !pitch || isOwner || !isAuthenticated) return;
    viewService.startViewTracking(id);
    return () => { viewService.stopViewTracking(id); };
  }, [id, pitch, isOwner, isAuthenticated]);


  const hasValidSession = (): boolean => {
    const validAuth = isAuthenticated && user && (user.id || (user as any).data?.id || (user as any).user?.id);
    return !!validAuth;
  };

  const fetchPitch = async (pitchId: number) => {
    try {
      const validAuth = hasValidSession();

      const pitch = validAuth 
        ? await pitchService.getByIdAuthenticated(pitchId)
        : await pitchService.getById(pitchId);
      
      // Check if protected content fields are present (indicates NDA access)
      const hasProtectedFields = !!(
        pitch.budget_breakdown ||
        pitch.attached_talent ||
        pitch.financial_projections ||
        pitch.distribution_plan ||
        pitch.marketing_strategy ||
        pitch.private_attachments ||
        pitch.contact_details ||
        pitch.revenue_model
      );
      
      // If protected fields are present, wrap them in protectedContent structure that frontend expects
      if (hasProtectedFields) {
        pitch.protectedContent = {
          budgetBreakdown: pitch.budget_breakdown,
          attachedTalent: pitch.attached_talent,
          financialProjections: pitch.financial_projections,
          distributionPlan: pitch.distribution_plan,
          marketingStrategy: pitch.marketing_strategy,
          privateAttachments: pitch.private_attachments,
          contactDetails: pitch.contact_details,
          revenueModel: pitch.revenue_model,
          productionTimeline: pitch.production_timeline
        };
      }

      setPitch(pitch);
      const ndaStatus = pitch.hasSignedNDA || pitch.hasNDA || hasProtectedFields;
      setHasSignedNDA(ndaStatus);
      
      // Track view for analytics (only if not the owner)
      if (!pitch.isOwner) {
        await pitchService.trackView(pitchId);
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      
      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          setError(`Pitch #${pitchId} not found. It may have been removed or you may not have permission to view it.`);
        } else if (error.message.includes('403')) {
          setError('You do not have permission to view this pitch. Please log in or contact the owner.');
        } else if (error.message.includes('401')) {
          setError('Please log in to view this pitch.');
        } else {
          setError(`Failed to load pitch: ${error.message}`);
        }
      } else {
        setError('Pitch not found or failed to load');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!pitch || !isAuthenticated) return;
    try {
      const originalSaved = isSaved;
      setIsSaved(!isSaved);
      const { API_URL } = await import('../config');
      if (originalSaved) {
        await fetch(`${API_URL}/api/saved-pitches/${pitch.id}`, { method: 'DELETE', credentials: 'include' });
      } else {
        await fetch(`${API_URL}/api/saved-pitches`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pitchId: pitch.id }),
        });
      }
    } catch (err) {
      console.error('Error toggling save:', err);
      setIsSaved(isSaved); // revert
    }
  };

  const handleNDASigned = () => {
    setHasSignedNDA(true);
    setError(null);

    // Refresh pitch data to get enhanced information
    if (id) {
      // Add a small delay to ensure the backend has processed the NDA
      setTimeout(() => {
        fetchPitch(parseInt(id));
      }, 500);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 animate-pulse">
        {!isInsidePortal && <PortalTopNav />}
        {/* Skeleton header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="h-8 bg-gray-200 rounded w-2/3" />
                <div className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-10 bg-gray-200 rounded-lg w-40" />
                <div className="h-10 bg-gray-200 rounded-lg w-20" />
              </div>
            </div>
          </div>
        </header>
        {/* Skeleton hero image */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="aspect-[21/9] bg-gray-200 rounded-xl" />
        </div>
        {/* Skeleton content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/6" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gray-50">
        {!isInsidePortal && <PortalTopNav />}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <BackButton />
              <h1 className="text-2xl font-bold text-gray-900">Pitch Not Found</h1>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-gray-600">{error}</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => {
                if (id) {
                  setError(null);
                  setLoading(true);
                  fetchPitch(parseInt(id));
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isInsidePortal && <PortalTopNav />}
      {/* Connectivity Banner */}
      {!isOnline && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-red-700 text-sm">You are offline. Some features may not work.</p>
          </div>
        </div>
      )}

      {/* Header — title/meta block. The standalone "Back to Marketplace" chrome
          that used to sit above this was removed; PortalTopNav above provides
          navigation and the dedicated back row just duplicated chrome. */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Title & Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                  {pitch.title}
                </h1>
                {pitch.seekingInvestment && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 whitespace-nowrap">
                    💰 Seeking Investment
                  </span>
                )}
              </div>

              {/* Creator & Meta Info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                {(hasSignedNDA || isOwner) ? (
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>By</span>
                    <span
                      className="hover:text-purple-600 cursor-pointer font-medium text-gray-900"
                      onClick={() => navigate(`/creator/${pitch.creator?.id}`)}
                    >
                      {pitch.creator?.name || pitch.creator?.username || 'Unknown Creator'}
                    </span>
                    <VerificationBadge tier={(pitch as any).creator_verification_tier || (pitch.creator as any)?.verificationTier} />
                    {isAuthenticated && !isOwner && pitch.creator?.id && (
                      <FollowButton creatorId={pitch.creator.id} variant="small" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 italic">Creator info hidden — NDA required</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{pitch.genre}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-gray-400" />
                  <FormatDisplay
                    formatCategory={pitch.formatCategory}
                    formatSubtype={pitch.formatSubtype}
                    format={pitch.format}
                    variant="compact"
                  />
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              {!isAuthenticated ? (
                <button
                  onClick={goToLogin}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Interact
                </button>
              ) : (
                <>
                  {!hasSignedNDA && !isOwner && (
                    <button
                      onClick={() => setShowEnhancedNDARequest(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
                    >
                      <Shield className="w-4 h-4" />
                      Request Enhanced Access
                    </button>
                  )}
                  {hasSignedNDA && (
                    <span className="flex items-center gap-2 px-4 py-2.5 bg-green-100 text-green-700 rounded-lg font-medium">
                      <Shield className="w-4 h-4" />
                      NDA Signed
                    </span>
                  )}
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      {(pitch.titleImage || (pitch as any).title_image) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="relative aspect-[21/9] overflow-hidden rounded-xl bg-gray-100">
            <img
              src={pitch.titleImage || (pitch as any).title_image}
              alt={pitch.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{pitch.title}</h2>
                    <HeatBadge score={getHeatScore(pitch as unknown as Record<string, unknown>)} variant="inline" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {pitch.genre}
                    </div>
                    <HumanMadeBadge aiUsed={(pitch as any).aiUsed ?? (pitch as any).ai_used} />
                    <div className="flex items-center gap-1">
                      <Film className="w-4 h-4" />
                      <FormatDisplay
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="compact"
                      />
                    </div>
                  </div>
                </div>
                {pitch.status === 'published' && (
                  <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
                    Published
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Logline</h3>
                  <p className="text-gray-700">{pitch.logline}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Synopsis</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  {(pitch as { synopsisTruncated?: boolean }).synopsisTruncated && (
                    <p className="mt-3 text-sm text-gray-500 italic">
                      You're reading a teaser. Sign up as a{' '}
                      <Link to="/signup" className="text-purple-600 hover:text-purple-700 font-medium">
                        Creator, Investor, or Production
                      </Link>{' '}
                      account to read the full synopsis.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Information - NDA Protected */}
            {!hasSignedNDA && !isOwner ? (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-sm p-6 border-2 border-blue-200">
                <div className="flex items-start space-x-3">
                  <Lock className="w-6 h-6 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Enhanced Information Available
                    </h3>
                    <p className="text-gray-700 mb-4">
                      {pitch.creator?.userType === 'production' 
                        ? "This production company has additional confidential information available including budget details, financing structure, and distribution plans."
                        : pitch.creator?.userType === 'investor'
                        ? "This investor has proprietary information about funding terms and investment structure."
                        : "Additional project details are available under NDA including full treatment, budget breakdown, and production timeline."}
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 mb-4">
                      <li className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        Budget & Financial Projections
                      </li>
                      <li className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400" />
                        Production Timeline & Milestones
                      </li>
                      <li className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        Attached Talent & Key Crew
                      </li>
                      <li className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-400" />
                        Distribution Strategy & Comparables
                      </li>
                    </ul>
                    <button
                      onClick={() => setShowEnhancedNDARequest(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Shield className="w-5 h-5" />
                      Request Access
                    </button>
                  </div>
                </div>
              </div>
            ) : (hasSignedNDA || isOwner) && pitch?.protectedContent ? (
              <div key={`protected-${hasSignedNDA}-${pitch?.id}`} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Enhanced Information</h3>
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    <Shield className="w-3 h-3" />
                    NDA Protected
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Budget Breakdown with improved null checks */}
                  {pitch.protectedContent?.budgetBreakdown && 
                   typeof pitch.protectedContent.budgetBreakdown === 'object' && 
                   pitch.protectedContent.budgetBreakdown !== null && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Budget Breakdown</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        {pitch.protectedContent.budgetBreakdown.total && (
                          <p className="text-sm font-semibold">
                            Total Budget: {formatCurrency(pitch.protectedContent.budgetBreakdown.total)}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {pitch.protectedContent.budgetBreakdown.production && (
                            <div className="text-sm text-gray-600">
                              Production: {formatCurrency(pitch.protectedContent.budgetBreakdown.production)}
                            </div>
                          )}
                          {pitch.protectedContent.budgetBreakdown.marketing && (
                            <div className="text-sm text-gray-600">
                              Marketing: {formatCurrency(pitch.protectedContent.budgetBreakdown.marketing)}
                            </div>
                          )}
                          {pitch.protectedContent.budgetBreakdown.distribution && (
                            <div className="text-sm text-gray-600">
                              Distribution: {formatCurrency(pitch.protectedContent.budgetBreakdown.distribution)}
                            </div>
                          )}
                          {pitch.protectedContent.budgetBreakdown.contingency && (
                            <div className="text-sm text-gray-600">
                              Contingency: {formatCurrency(pitch.protectedContent.budgetBreakdown.contingency)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Production Timeline with improved null checks */}
                  {pitch.protectedContent?.productionTimeline && 
                   typeof pitch.protectedContent.productionTimeline === 'string' && 
                   pitch.protectedContent.productionTimeline.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Production Timeline</h4>
                      <p className="text-gray-700 whitespace-pre-line">{pitch.protectedContent.productionTimeline}</p>
                    </div>
                  )}
                  
                  {/* Attached Talent with improved null checks */}
                  {pitch.protectedContent?.attachedTalent && 
                   Array.isArray(pitch.protectedContent.attachedTalent) && 
                   pitch.protectedContent.attachedTalent.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Attached Talent</h4>
                      <div className="space-y-2">
                        {pitch.protectedContent.attachedTalent.map((talent, index) => (
                          <div key={index} className="bg-gray-50 p-2 rounded">
                            <p className="text-sm font-semibold">{talent?.role}: {talent?.name}</p>
                            {talent?.notable_works && Array.isArray(talent.notable_works) && (
                              <p className="text-xs text-gray-600">Notable: {talent.notable_works.join(', ')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Financial Projections with improved null checks */}
                  {pitch.protectedContent?.financialProjections && 
                   typeof pitch.protectedContent.financialProjections === 'object' && 
                   pitch.protectedContent.financialProjections !== null && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Financial Projections</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        {pitch.protectedContent.financialProjections.roi && (
                          <p className="text-sm font-semibold">ROI: {pitch.protectedContent.financialProjections.roi}%</p>
                        )}
                        {pitch.protectedContent.financialProjections.break_even_months && (
                          <p className="text-sm text-gray-600">
                            Break-even: {pitch.protectedContent.financialProjections.break_even_months} months
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Distribution Plan with improved null checks */}
                  {pitch.protectedContent?.distributionPlan && 
                   typeof pitch.protectedContent.distributionPlan === 'string' && 
                   pitch.protectedContent.distributionPlan.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Distribution Plan</h4>
                      <p className="text-gray-700">{pitch.protectedContent.distributionPlan}</p>
                    </div>
                  )}
                  
                  {/* Marketing Strategy with improved null checks */}
                  {pitch.protectedContent?.marketingStrategy && 
                   typeof pitch.protectedContent.marketingStrategy === 'string' && 
                   pitch.protectedContent.marketingStrategy.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Marketing Strategy</h4>
                      <p className="text-gray-700">{pitch.protectedContent.marketingStrategy}</p>
                    </div>
                  )}
                  
                  {/* Revenue Model with improved null checks */}
                  {pitch.protectedContent?.revenueModel && 
                   typeof pitch.protectedContent.revenueModel === 'string' && 
                   pitch.protectedContent.revenueModel.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Revenue Model</h4>
                      <p className="text-gray-700">{pitch.protectedContent.revenueModel}</p>
                    </div>
                  )}
                  
                  {/* Private Attachments with improved null checks */}
                  {pitch.protectedContent?.privateAttachments && 
                   Array.isArray(pitch.protectedContent.privateAttachments) && 
                   pitch.protectedContent.privateAttachments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Private Documents</h4>
                      <div className="space-y-2">
                        {pitch.protectedContent.privateAttachments.map((doc, index) => (
                          <button 
                            key={index} 
                            onClick={createDownloadClickHandler(doc?.url, doc?.name)}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm hover:underline cursor-pointer border-none bg-transparent p-0"
                          >
                            <FileText className="w-4 h-4" />
                            {doc?.name || `Document ${index + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Contact Details with improved null checks */}
                  {pitch.protectedContent?.contactDetails && 
                   typeof pitch.protectedContent.contactDetails === 'object' && 
                   pitch.protectedContent.contactDetails !== null && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Contact Information</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        {pitch.protectedContent.contactDetails.producer && (
                          <div className="mb-2">
                            <p className="text-sm font-semibold">Producer</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.producer.name}</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.producer.email}</p>
                          </div>
                        )}
                        {pitch.protectedContent.contactDetails.agent && (
                          <div>
                            <p className="text-sm font-semibold">Agent</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.agent.name}</p>
                            <p className="text-sm text-gray-600">{(pitch.protectedContent.contactDetails.agent as any).agency}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback message if no protected content is available */}
                  {Object.keys(pitch.protectedContent || {}).length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        No enhanced information is currently available for this pitch. 
                        The creator may not have added protected content yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Fallback: Show message if NDA-signed user has no protected content (not for owner)
              hasSignedNDA && !isOwner && !pitch?.protectedContent ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-yellow-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-yellow-800 mb-1">
                        Enhanced Information Unavailable
                      </h3>
                      <p className="text-yellow-700 text-sm">
                        This pitch doesn't have additional protected content available at this time.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null
            )}

            {/* Media */}
            {(pitch.titleImage || pitch.scriptUrl || pitch.trailerUrl) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Media & Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pitch.titleImage && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Cover Image</h4>
                      <img 
                        src={pitch.titleImage} 
                        alt="Pitch cover" 
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  {pitch.scriptUrl && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Script</h4>
                      <a 
                        href={pitch.scriptUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
                      >
                        <User className="w-4 h-4" />
                        View Script
                      </a>
                    </div>
                  )}
                  {pitch.trailerUrl && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Trailer</h4>
                      <a 
                        href={pitch.trailerUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
                      >
                        <Film className="w-4 h-4" />
                        Watch Trailer
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Structured Feedback — hidden until NDA signed */}
            {(hasSignedNDA || isOwner) && (
              <FeedbackSection
                pitchId={pitch.id}
                isOwner={isOwner}
                isAuthenticated={isAuthenticated}
                userType={(user as any)?.userType || (user as any)?.user_type || ''}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Engagement & Social Proof — aggregate visible to all authenticated
                viewers; named likers/viewers only exposed to owner + NDA-signed */}
            {isAuthenticated && (
              <SocialProofBadge
                pitchId={pitch.id}
                viewCount={pitch.viewCount || 0}
                likeCount={pitch.likeCount || 0}
                isOwner={isOwner}
                isAuthenticated={isAuthenticated}
              />
            )}

            {/* Pitchey Score + Likes — visible to all viewers (auth gating only applies to named-liker breakdown above) */}
            {((pitch as any).pitchey_score_avg > 0 || (pitch as any).viewer_score_avg > 0 || (pitch.likeCount || 0) > 0) && (
              <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                {(pitch as any).pitchey_score_avg > 0 && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600 font-medium shrink-0">Pitchey Score</span>
                    <PitcheyRating mode="display" value={(pitch as any).pitchey_score_avg} />
                  </div>
                )}
                {(pitch as any).viewer_score_avg > 0 && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600 font-medium shrink-0">Viewer Score</span>
                    <PitcheyRating mode="display" value={(pitch as any).viewer_score_avg} />
                  </div>
                )}
                {(pitch.likeCount || 0) > 0 && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-600 font-medium shrink-0">Likes</span>
                    <span className="inline-flex items-center gap-1.5 text-gray-900 font-semibold">
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                      {pitch.likeCount}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Engagement Actions */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2">
              {isAuthenticated && !isOwner && (
                <button
                  onClick={handleSave}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition ${
                    isSaved
                      ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              )}
            </div>

            {/* Project Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Creator</div>
                    <div className="text-gray-500">
                      {(hasSignedNDA || isOwner)
                        ? (pitch.creator?.name || pitch.creator?.username || 'Unknown')
                        : 'Hidden — NDA required'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Published</div>
                    <div className="text-gray-500">
                      {pitch.createdAt && !isNaN(new Date(pitch.createdAt).getTime())
                        ? new Date(pitch.createdAt).toLocaleDateString()
                        : 'Recently'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {isAuthenticated ? (
                  <>
                    {isOwner ? (
                      // Owner-specific actions
                      <>
                        <button
                          onClick={() => navigate(`/creator/pitches/${id}/edit`)}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                          Edit Pitch
                        </button>
                        <button
                          onClick={() => navigate(`/creator/pitches/${id}/analytics`)}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="20" x2="12" y2="10"/>
                            <line x1="18" y1="20" x2="18" y2="4"/>
                            <line x1="6" y1="20" x2="6" y2="16"/>
                          </svg>
                          View Analytics
                        </button>
                      </>
                    ) : (
                      // Viewer actions (non-owner)
                      <button
                        onClick={() => setShowEnhancedNDARequest(true)}
                        disabled={hasSignedNDA}
                        className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                          hasSignedNDA 
                            ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        {hasSignedNDA ? 'NDA Signed' : 'Request NDA Access'}
                      </button>
                    )}
                    <button className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      <Share2 className="w-4 h-4" />
                      Share Pitch
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={goToLogin}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In to Interact
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      <Share2 className="w-4 h-4" />
                      Share Pitch
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced NDA Request Modal */}
      {pitch && (
        <EnhancedNDARequest
          isOpen={showEnhancedNDARequest}
          onClose={() => setShowEnhancedNDARequest(false)}
          pitchId={pitch.id}
          pitchTitle={pitch.title}
          creatorName={pitch.creator?.username || (pitch.creator as any)?.companyName || 'Creator'}
          creatorType={(pitch.creator?.userType as 'creator' | 'investor' | 'production') || 'creator'}
          onSuccess={handleNDASigned}
        />
      )}

    </div>
  );
}