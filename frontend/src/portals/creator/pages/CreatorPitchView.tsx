import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import LogoLoader from '@/components/LogoLoader';
import { 
  ArrowLeft, Eye, Heart, Share2, Edit, Trash2, BarChart3, 
  Shield, MessageSquare, Clock, Calendar, User, Tag, 
  DollarSign, Briefcase, TrendingUp, Users,
  FileText, Download, Lock, Unlock, BookOpen, Image as ImageIcon
} from 'lucide-react';

// Per-document-type display metadata for the grouped Attachments list. Mirrors the
// types the uploader offers (DocumentUpload DOCUMENT_TYPES); the type a creator picks
// on upload drives the icon + group here. Order controls group sequence.
const DOC_TYPE_META: Record<string, { label: string; Icon: typeof FileText; color: string; order: number }> = {
  pitch_deck:           { label: 'Pitch Deck / Lookbook', Icon: BarChart3,  color: 'text-purple-600', order: 1 },
  lookbook:             { label: 'Lookbooks',             Icon: BookOpen,   color: 'text-pink-600',   order: 2 },
  script:               { label: 'Scripts',               Icon: FileText,   color: 'text-blue-600',   order: 3 },
  treatment:            { label: 'Treatments',            Icon: FileText,   color: 'text-emerald-600',order: 4 },
  budget:               { label: 'Budget',                Icon: DollarSign, color: 'text-amber-600',  order: 5 },
  nda:                  { label: 'NDA Documents',         Icon: Shield,     color: 'text-red-600',    order: 6 },
  supporting_materials: { label: 'Supporting Materials',  Icon: ImageIcon,  color: 'text-gray-500',   order: 7 },
};
const DOC_TYPE_FALLBACK = { label: 'Other', Icon: FileText, color: 'text-gray-500', order: 99 };
import { pitchAPI } from '@/lib/api';
import apiClient from '@/lib/api-client';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import FormatDisplay from '@/components/FormatDisplay';
import FeedbackDisplay from '@/components/feedback/FeedbackDisplay';
import WhoViewedPanel from '@features/analytics/components/WhoViewedPanel';
import FollowButton from '@features/browse/components/FollowButton';
import InterestedCard from '@features/pitches/components/InterestedCard';
import CollaborationWorkspace from '@features/pitches/components/CollaborationWorkspace';
import { toast } from 'react-hot-toast';

interface Pitch {
  id: string;
  userId: string;
  title: string;
  collaboration?: {
    id: number;
    status: string;             // 'pending' | 'accepted'
    role: string | null;
    withUserId: number;
    withName: string | null;    // the production company
  } | null;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  pages?: number;
  shortSynopsis: string;
  longSynopsis?: string;
  budget: string;
  estimatedBudget?: string;
  productionTimeline?: string;
  targetAudience?: string;
  comparableFilms?: string;
  status: 'draft' | 'published' | 'in_review' | 'optioned' | 'produced';
  visibility: 'public' | 'private' | 'nda_only';
  views: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
  hasSignedNDA?: boolean;
  ndaCount?: number;
  thumbnail?: string;
  pitchDeck?: string;
  script?: string;
  trailer?: string;
  documents?: PitchDocument[];
}

interface PitchDocument {
  id: number;
  file_name: string;
  original_file_name?: string;
  file_url: string;
  mime_type?: string;
  document_type?: string;
  requires_nda?: boolean;
}

interface Analytics {
  totalViews: number;
  uniqueViews: number;
  avgViewTime: string;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topReferrers: Array<{ source: string; count: number }>;
  viewsByDay: Array<{ date: string; views: number }>;
}

interface NDARequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterCompany?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  message?: string;
}

interface ProductionFeedback {
  id: number;
  content: string;
  category: string;
  author: string;
  created_at: string;
  company_name?: string;
  reviewer_name: string;
  user_type: string;
}

const CreatorPitchView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user: authUser } = useBetterAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'ndas' | 'conversations' | 'feedback' | 'collaboration'>('overview');
  const [collabBusy, setCollabBusy] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [feedback, setFeedback] = useState<ProductionFeedback[]>([]);

  useEffect(() => {
    if (id) {
      fetchPitchData();
      checkOwnership();
    }
  }, [id]);

  const fetchPitchData = async () => {
    try {
      setLoading(true);
      
      // For creators, try public endpoint first then authenticated
      let response;

      try {
        // Try public endpoint first for better reliability
        response = await pitchAPI.getPublicById(parseInt(id!));

        // If authenticated, try to get enhanced data
        if (isAuthenticated) {
          try {
            const authResponse = await pitchAPI.getById(parseInt(id!));
            response = authResponse; // Use authenticated data if available
          } catch (authError) {
          }
        }
      } catch (publicError) {
        // If public fails, try authenticated as fallback
        response = await pitchAPI.getById(parseInt(id!));
      }
      
      setPitch(response);
      // Set ownership from the loaded pitch (the mount-time checkOwnership() runs
      // before the fetch resolves, so pitch is still null there). Trust the
      // backend's computed isOwner, falling back to an id comparison.
      const ownsIt = !!(response as any).isOwner
        || (authUser?.id ? String(authUser.id) === String(response.userId) || String(authUser.id) === String(response.creator?.id) : false);
      setIsOwner(ownsIt);

      // Fetch analytics if owner
      if (authUser?.id && (String(authUser.id) === String(response.userId) || String(authUser.id) === String(response.creator?.id))) {
        try {
          const analyticsData = await pitchAPI.getAnalytics(parseInt(id!));
          setAnalytics(analyticsData);
        } catch (err) {
        }
        
        try {
          const ndaData = await (pitchAPI as any).getNDARequests(parseInt(id!));
          setNdaRequests(ndaData);
        } catch (err) {
        }
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Failed to load pitch details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch shared production feedback when tab is active
  useEffect(() => {
    if (activeTab === 'feedback' && isOwner && id) {
      apiClient.get(`/api/creator/pitches/${id}/feedback`)
        .then((res) => {
          const data = (res.data || res) as Record<string, unknown>;
          setFeedback((data.feedback as ProductionFeedback[]) || []);
        })
        .catch(() => setFeedback([]));
    }
  }, [activeTab, isOwner, id]);

  const checkOwnership = () => {
    setIsOwner(authUser?.id ? String(pitch?.userId) === String(authUser.id) : false);
  };

  const handleEdit = () => {
    navigate(`/creator/pitches/${id}/edit`);
  };

  // Respond to a producer's pitch-scoped collaboration proposal. On accept, the
  // producer's Team Plan + Notes become a shared workspace both can co-edit.
  const respondToCollaboration = async (status: 'accepted' | 'rejected') => {
    const collabId = pitch?.collaboration?.id;
    if (!collabId || collabBusy) return;
    setCollabBusy(true);
    try {
      const res = await apiClient.put(`/api/collaborations/${collabId}/status`, { status });
      if (res.success) {
        toast.success(status === 'accepted' ? 'Collaboration accepted — workspace is now shared.' : 'Collaboration declined.');
        if (status === 'accepted') setActiveTab('collaboration');
        await fetchPitchData();
      } else {
        toast.error(res.error?.message || 'Could not update the collaboration.');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setCollabBusy(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this pitch? This action cannot be undone.')) {
      try {
        await pitchAPI.delete(parseInt(id!));
        navigate('/creator/pitches');
      } catch (error) {
        console.error('Failed to delete pitch:', error);
      }
    }
  };

  const handleVisibilityToggle = async () => {
    if (!pitch) return;
    
    const newVisibility = pitch.visibility === 'public' ? 'private' : 'public';
    try {
      await (pitchAPI as any).updateVisibility(parseInt(id!), newVisibility);
      setPitch({ ...pitch, visibility: newVisibility });
    } catch (error) {
      console.error('Failed to update visibility:', error);
    }
  };

  const handleNDAAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      await (pitchAPI as any).handleNDARequest(parseInt(id!), requestId, action);
      setNdaRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, status: action === 'approve' ? 'approved' : 'rejected' }
            : req
        )
      );
    } catch (error) {
      console.error('Failed to handle NDA request:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <LogoLoader size="md" />
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Pitch</h2>
            <p className="text-gray-600 mb-6">{error || 'Pitch not found'}</p>
            <button
              onClick={() => navigate('/creator/pitches')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Back to My Pitches
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/creator/pitches')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to My Pitches
            </button>
            
            {isOwner && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleVisibilityToggle}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    pitch.visibility === 'public' 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {pitch.visibility === 'public' ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  {pitch.visibility === 'public' ? 'Public' : 'Private'}
                </button>
                
                <button
                  onClick={handleEdit}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
                
                <button
                  onClick={handleDelete}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            )}

            {/* Viewing someone else's pitch: a creator can Follow + Message the
                creator (no NDA request for creators). Message starts a conversation
                (1 credit per new person). Follow previously vanished after sign-in
                because this portal view lacked it. */}
            {!isOwner && pitch.userId && (
              <div className="flex items-center gap-3">
                {/* Follow now lives in the unified InterestedCard in the sidebar */}
                <button
                  onClick={() => navigate(`/creator/messages?recipient=${pitch.userId}&pitch=${id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> Message
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pitch Details */}
          <div className="lg:col-span-2">
            {/* Collaboration proposal banner — a producer wants to co-develop this
                pitch. Pending → accept/decline; accepted → jump to the shared workspace. */}
            {isOwner && pitch.collaboration?.status === 'pending' && (
              <div className="mb-6 rounded-xl bg-indigo-50 ring-1 ring-inset ring-indigo-200 p-5">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 shrink-0 text-indigo-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-indigo-900">
                      {pitch.collaboration.withName || 'A production company'} wants to co-develop this pitch
                    </p>
                    <p className="mt-0.5 text-sm text-indigo-700">
                      Accept to open a shared Team Plan &amp; Notes workspace you'll both edit. You can close it anytime; your pitch stays yours.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => respondToCollaboration('accepted')}
                        disabled={collabBusy}
                        className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {collabBusy ? 'Working…' : 'Accept collaboration'}
                      </button>
                      <button
                        onClick={() => respondToCollaboration('rejected')}
                        disabled={collabBusy}
                        className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isOwner && pitch.collaboration?.status === 'accepted' && activeTab !== 'collaboration' && (
              <button
                onClick={() => setActiveTab('collaboration')}
                className="mb-6 flex w-full items-center gap-3 rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-200 p-4 text-left transition hover:bg-emerald-100"
              >
                <Users className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-800">Co-developing with {pitch.collaboration.withName || 'a production company'}</p>
                  <p className="mt-0.5 text-sm text-emerald-700">Open the shared Team Plan &amp; Notes workspace →</p>
                </div>
              </button>
            )}

            {/* Tabs for Owner */}
            {isOwner && (
              <div className="bg-white rounded-xl shadow-lg mb-6">
                <div className="flex border-b">
                  {[
                    'overview', 'analytics', 'ndas', 'conversations', 'feedback',
                    ...(pitch.collaboration?.status === 'accepted' ? ['collaboration'] : []),
                  ].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                        activeTab === tab
                          ? 'text-purple-600 border-b-2 border-purple-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab === 'ndas' ? 'NDAs' : tab === 'collaboration' ? 'Collaboration' : tab}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'collaboration' && isOwner && pitch.collaboration?.status === 'accepted' && (
              <CollaborationWorkspace
                pitchId={Number(pitch.id)}
                partnerName={pitch.collaboration.withName || undefined}
              />
            )}

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                {pitch.thumbnail && (
                  <img 
                    src={pitch.thumbnail} 
                    alt={pitch.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{pitch.title}</h1>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {pitch.genre}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    <FormatDisplay 
                      formatCategory={pitch.formatCategory}
                      formatSubtype={pitch.formatSubtype}
                      format={pitch.format}
                      variant="compact"
                    />
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {pitch.status}
                  </span>
                </div>

                <p className="text-xl text-gray-700 mb-6 italic">"{pitch.logline}"</p>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Synopsis</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  </div>
                  
                  {pitch.longSynopsis && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Synopsis</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{pitch.longSynopsis}</p>
                    </div>
                  )}
                  
                  {pitch.comparableFilms && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparable Films</h3>
                      <p className="text-gray-700">{pitch.comparableFilms}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && isOwner && analytics && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h2>
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">{analytics.totalViews}</div>
                    <div className="text-sm text-gray-600">Total Views</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">{analytics.uniqueViews}</div>
                    <div className="text-sm text-gray-600">Unique Views</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{analytics.avgViewTime}</div>
                    <div className="text-sm text-gray-600">Avg. View Time</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-600">{analytics.viewsToday}</div>
                    <div className="text-sm text-gray-600">Views Today</div>
                  </div>
                  <div className="bg-pink-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-pink-600">{analytics.viewsThisWeek}</div>
                    <div className="text-sm text-gray-600">This Week</div>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-indigo-600">{analytics.viewsThisMonth}</div>
                    <div className="text-sm text-gray-600">This Month</div>
                  </div>
                </div>

                {/* Top Referrers */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
                  <div className="space-y-2">
                    {analytics.topReferrers.map((referrer, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b">
                        <span className="text-gray-700">{referrer.source}</span>
                        <span className="text-gray-500">{referrer.count} views</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* "Who viewed your deck" — owner-only, tier-gated (moat #2) */}
            {activeTab === 'analytics' && isOwner && id && (
              <div className="mt-6">
                <WhoViewedPanel pitchId={parseInt(id)} />
              </div>
            )}

            {activeTab === 'ndas' && isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">NDA Requests</h2>
                
                {ndaRequests.length > 0 ? (
                  <div className="space-y-4">
                    {ndaRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{request.requesterName}</h4>
                            {request.requesterCompany && (
                              <p className="text-sm text-gray-600">{request.requesterCompany}</p>
                            )}
                            {request.message && (
                              <p className="text-sm text-gray-700 mt-2">{request.message}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Requested {new Date(request.requestedAt).toLocaleDateString()}
                            </p>
                          </div>
                          
                          {request.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleNDAAction(request.id, 'approve')}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleNDAAction(request.id, 'reject')}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          
                          {request.status !== 'pending' && (
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              request.status === 'approved' 
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {request.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No NDA requests yet</p>
                )}
              </div>
            )}

            {activeTab === 'conversations' && isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Conversations</h2>
                <p className="text-sm text-gray-500 mb-6">Users who have signed the NDA for this pitch. You can message them directly.</p>

                {(() => {
                  const approvedSigners = ndaRequests.filter(r => r.status === 'approved');
                  if (approvedSigners.length > 0) {
                    return (
                      <div className="space-y-3">
                        {approvedSigners.map((request) => (
                          <div key={request.id} className="flex items-center justify-between border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">{request.requesterName}</h4>
                                {request.requesterCompany && (
                                  <p className="text-sm text-gray-500">{request.requesterCompany}</p>
                                )}
                                <p className="text-xs text-gray-400">
                                  NDA signed {new Date(request.requestedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => navigate(`/creator/messages?recipient=${request.requesterId}&subject=${encodeURIComponent(`Re: ${pitch?.title || 'Pitch'}`)}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Message
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No signed NDAs yet</p>
                      <p className="text-sm text-gray-400 mt-1">Once investors or producers sign your NDA, you can start conversations with them here.</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'feedback' && isOwner && (
              <>
              {/* Community Feedback */}
              <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Community Feedback</h2>
                <p className="text-sm text-gray-500 mb-6">Structured reviews from investors, production companies, and peers</p>
                <FeedbackDisplay pitchId={Number(id)} />
              </div>

              {/* Production Notes */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Production Notes</h2>
                <p className="text-sm text-gray-500 mb-6">Notes shared by production companies reviewing your pitch</p>
                {feedback.length > 0 ? (
                  <div className="space-y-4">
                    {feedback.map((fb) => (
                      <div key={fb.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium capitalize">
                              {fb.category}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(fb.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2">{fb.content}</p>
                        <p className="text-xs text-gray-500">
                          {fb.company_name || fb.reviewer_name}
                          {fb.company_name && fb.reviewer_name && fb.reviewer_name !== fb.company_name
                            ? ` — ${fb.reviewer_name}`
                            : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No feedback yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Production companies can share notes when reviewing your pitch.
                    </p>
                  </div>
                )}
              </div>
              </>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Unified "Interested?" box — like / follow creator / save (shared across portals) */}
            {!isOwner && pitch.userId && (
              <InterestedCard
                pitchId={pitch.id}
                creatorId={parseInt(pitch.userId)}
                isAuthenticated={isAuthenticated}
                isOwner={isOwner}
                fromPath={`/creator/pitch/${id}`}
              />
            )}

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Eye className="h-4 w-4 mr-2" />
                    Views
                  </span>
                  <span className="font-semibold">{pitch.views}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Heart className="h-4 w-4 mr-2" />
                    Likes
                  </span>
                  <span className="font-semibold">{pitch.likes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Shield className="h-4 w-4 mr-2" />
                    NDAs
                  </span>
                  <span className="font-semibold">{pitch.ndaCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Production Details */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 text-sm">Budget</span>
                  <p className="font-semibold">{pitch.budget}</p>
                </div>
                {pitch.productionTimeline && (
                  <div>
                    <span className="text-gray-600 text-sm">Timeline</span>
                    <p className="font-semibold">{pitch.productionTimeline}</p>
                  </div>
                )}
                {pitch.targetAudience && (
                  <div>
                    <span className="text-gray-600 text-sm">Target Audience</span>
                    <p className="font-semibold">{pitch.targetAudience}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            {pitch.documents && pitch.documents.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h3>
                <div className="space-y-2">
                  {/* Group documents by their type so like files sit together, each
                      with the icon for that type and a lock when NDA-gated. */}
                  {pitch.documents && pitch.documents.length > 0 && (() => {
                    const groups = new Map<string, PitchDocument[]>();
                    for (const d of pitch.documents) {
                      const t = d.document_type || 'other';
                      if (!groups.has(t)) groups.set(t, []);
                      groups.get(t)!.push(d);
                    }
                    return [...groups.entries()]
                      .sort((a, b) => (DOC_TYPE_META[a[0]]?.order ?? 99) - (DOC_TYPE_META[b[0]]?.order ?? 99))
                      .map(([type, docs]) => {
                        const meta = DOC_TYPE_META[type] || DOC_TYPE_FALLBACK;
                        const Icon = meta.Icon;
                        return (
                          <div key={type} className="mb-3 last:mb-0">
                            <p className="flex items-center gap-1.5 mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-gray-400">
                              <Icon className={`h-3.5 w-3.5 ${meta.color}`} /> {meta.label}
                            </p>
                            <div className="space-y-1">
                              {docs.map((doc) => (
                                <a
                                  key={doc.id}
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                                >
                                  <span className="flex items-center min-w-0 text-blue-600">
                                    <Icon className={`h-4 w-4 mr-2 shrink-0 ${meta.color}`} />
                                    <span className="truncate">{doc.original_file_name || doc.file_name}</span>
                                    {doc.requires_nda && (
                                      <Lock className="h-3 w-3 ml-2 shrink-0 text-gray-400" aria-label="NDA required to view" />
                                    )}
                                  </span>
                                  <Download className="h-4 w-4 text-gray-400 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </div>
            )}

            {/* Share Options */}
            {isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Share</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorPitchView;