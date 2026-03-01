import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, Clock, Star, CheckCircle, XCircle, Archive, 
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';

interface Submission {
  id: string;
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
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  
  const statusFilter = searchParams.get('status') || 'all';

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/production/submissions?status=${statusFilter === 'all' ? 'new' : statusFilter}&limit=50`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to fetch submissions');

      const data = await response.json();
      const items = data.data?.submissions || [];

      const mapped: Submission[] = items.map((s: any) => ({
        id: s.id?.toString() || '',
        title: s.title || 'Untitled',
        creator: s.creator || 'Unknown Creator',
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
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    return matchesStatus && matchesSearch && matchesGenre;
  });

  const stats = {
    total: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    inReview: submissions.filter(s => s.status === 'review').length,
    shortlisted: submissions.filter(s => s.status === 'shortlisted').length
  };

  const genres = ['all', ...new Set(submissions.map(s => s.genre))];

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
            
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {genres.map(genre => (
                <option key={genre} value={genre}>
                  {genre === 'all' ? 'All Genres' : genre}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              {Object.entries(statusConfig).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => navigate(`?status=${status}`)}
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

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {submission.attachments} files
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/production/pitches/${submission.id}`)}
                        className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      <button
                        onClick={() => navigate(`/production/messages?to=${encodeURIComponent(submission.creatorEmail)}&subject=${encodeURIComponent('Re: ' + submission.title)}`)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Contact
                      </button>
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        <Download className="w-4 h-4" />
                      </button>
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
            <p className="text-gray-500">No submissions found</p>
          </div>
        )}
      </div>
    </div>
  );
}