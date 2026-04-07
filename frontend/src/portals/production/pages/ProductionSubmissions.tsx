import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Clock, Star, CheckCircle, XCircle, Archive,
  Search, Calendar, User, DollarSign,
  Eye, MessageSquare, Film
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'react-hot-toast';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import StartProjectModal from '@portals/production/components/StartProjectModal';

interface Submission {
  id: string;
  userId: string;
  title: string;
  creator: string;
  creatorEmail: string;
  submittedDate: string;
  genre: string;
  budget: number;
  status: 'new' | 'review' | 'shortlisted' | 'accepted' | 'rejected' | 'archived';
  rating: number;
  synopsis: string;
  attachments: number;
  lastActivity: string;
  reviewNotes?: string;
}

const statusConfig = {
  new: { color: 'bg-blue-100 text-blue-800', icon: FileText },
  review: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  shortlisted: { color: 'bg-purple-100 text-purple-800', icon: Star },
  accepted: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
  archived: { color: 'bg-gray-100 text-gray-800', icon: Archive }
};

export default function ProductionSubmissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useBetterAuthStore();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startProjectPitch, setStartProjectPitch] = useState<{ id: number; title: string; genre?: string } | null>(null);
  
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');

  useEffect(() => {
    void fetchAllSubmissions();
  }, []);

  const fetchAllSubmissions = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || '';

      // Fetch both "new" (NDA-signed, unreviewed) and all reviewed submissions
      const [newRes, reviewedRes] = await Promise.all([
        fetch(`${API_URL}/api/production/submissions?status=new&limit=100`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_URL}/api/production/submissions?status=reviewing&limit=100`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
      ]);

      const allItems: any[] = [];

      if (newRes.ok) {
        const newData = await newRes.json();
        allItems.push(...(newData.data?.submissions || []));
      }
      if (reviewedRes.ok) {
        const reviewedData = await reviewedRes.json();
        allItems.push(...(reviewedData.data?.submissions || []));
      }

      // Deduplicate by id
      const seen = new Set<string>();
      const unique = allItems.filter(s => {
        const key = String(s.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const mapped: Submission[] = unique.map((s: any) => ({
        id: s.id?.toString() || '',
        userId: String(s.user_id || ''),
        title: s.title || 'Untitled',
        creator: s.creator || s.creator_name || (s.first_name && s.last_name ? `${s.first_name} ${s.last_name}`.trim() : '') || (s.creator_email ? s.creator_email.split('@')[0] : '') || 'Creator',
        creatorEmail: s.creator_email || '',
        submittedDate: s.created_at || new Date().toISOString(),
        genre: s.genre || 'Unspecified',
        budget: s.estimated_budget || 0,
        status: mapReviewStatus(s.review_status),
        rating: Number(s.review_rating) || 0,
        synopsis: s.logline || s.short_synopsis || '',
        attachments: 0,
        lastActivity: s.updated_at ? getRelativeTime(s.updated_at) : 'Unknown',
        reviewNotes: s.review_notes || undefined
      }));

      setSubmissions(mapped);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateSubmissionStatus = async (pitchId: string, newStatus: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/production/submissions/${pitchId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');

      // Update local state
      const mappedStatus = mapReviewStatus(newStatus);
      setSubmissions(prev =>
        prev.map(s => s.id === pitchId ? { ...s, status: mappedStatus } : s)
      );
      toast.success(`Moved to ${newStatus}`);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    }
  };

  const mapReviewStatus = (status: string): Submission['status'] => {
    const mapping: Record<string, Submission['status']> = {
      new: 'new',
      reviewing: 'review',
      shortlisted: 'shortlisted',
      accepted: 'accepted',
      rejected: 'rejected',
      archived: 'archived'
    };
    return mapping[status] || 'new';
  };

  const getRelativeTime = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    inReview: submissions.filter(s => s.status === 'review').length,
    shortlisted: submissions.filter(s => s.status === 'shortlisted').length
  };


  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">New</p>
                <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Review</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inReview}</p>
              </div>
              <Eye className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Shortlisted</p>
                <p className="text-2xl font-bold text-purple-600">{stats.shortlisted}</p>
              </div>
              <Star className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search submissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  statusFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="hidden md:inline">All</span>
              </button>
              {Object.entries(statusConfig).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`
                    px-4 py-2 rounded-lg transition-colors flex items-center gap-2
                    ${statusFilter === status 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <config.icon className="w-4 h-4" />
                  <span className="hidden md:inline capitalize">{status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => {
              const StatusIcon = statusConfig[submission.status].icon;
              return (
                <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig[submission.status].color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {submission.status}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{submission.synopsis}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {submission.creator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(submission.submittedDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${(submission.budget / 1000000).toFixed(1)}M
                        </span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {submission.genre}
                        </span>
                      </div>

                      {submission.reviewNotes && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Review Note:</span> {submission.reviewNotes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {submission.rating > 0 && (
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < submission.rating 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <span className="text-xs text-gray-500">{submission.lastActivity}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-between items-center pt-4 border-t gap-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/production/pitch/${submission.id}`)}
                        className="px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center gap-1.5 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      {submission.userId !== String(authUser?.id) && (
                        <button
                          onClick={() => navigate(`/production/messages?to=${encodeURIComponent(submission.creatorEmail)}&subject=${encodeURIComponent('Re: ' + submission.title)}`)}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-1.5 text-sm"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Contact
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {submission.status === 'new' && (
                        <button
                          onClick={() => void updateSubmissionStatus(submission.id, 'reviewing')}
                          className="px-3 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg transition text-sm flex items-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Review
                        </button>
                      )}
                      {(submission.status === 'new' || submission.status === 'review') && (
                        <button
                          onClick={() => void updateSubmissionStatus(submission.id, 'shortlisted')}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition text-sm flex items-center gap-1.5"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Shortlist
                        </button>
                      )}
                      {(submission.status === 'review' || submission.status === 'shortlisted') && (
                        <>
                          <button
                            onClick={() => void updateSubmissionStatus(submission.id, 'accepted')}
                            className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition text-sm flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => void updateSubmissionStatus(submission.id, 'rejected')}
                            className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition text-sm flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                      {submission.status === 'accepted' && (
                        <button
                          onClick={() => setStartProjectPitch({ id: parseInt(submission.id), title: submission.title, genre: submission.genre })}
                          className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition text-sm flex items-center gap-1.5"
                        >
                          <Film className="w-3.5 h-3.5" />
                          Start Project
                        </button>
                      )}
                      {submission.status === 'archived' ? (
                        <button
                          onClick={() => void updateSubmissionStatus(submission.id, 'reviewing')}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition text-sm flex items-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Unarchive
                        </button>
                      ) : (
                        <button
                          onClick={() => void updateSubmissionStatus(submission.id, 'archived')}
                          className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition text-sm flex items-center gap-1.5"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredSubmissions.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {statusFilter === 'all' || statusFilter === 'new'
                ? 'No submissions yet'
                : `No ${statusFilter} submissions`}
            </h3>
            <p className="text-gray-500 text-sm">
              {statusFilter === 'all' || statusFilter === 'new'
                ? 'Sign NDAs with creators to see their pitches here for review'
                : 'Move submissions through the pipeline to see them here'}
            </p>
          </div>
        )}
      </div>

      {startProjectPitch && (
        <StartProjectModal
          pitch={startProjectPitch}
          onClose={() => setStartProjectPitch(null)}
        />
      )}
    </div>
  );
}