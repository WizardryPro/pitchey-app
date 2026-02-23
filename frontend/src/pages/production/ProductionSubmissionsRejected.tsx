import { useState, useEffect } from 'react';
import { 
  FileText, Clock, Star, CheckCircle, XCircle, Archive, 
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, RotateCcw, AlertTriangle,
  RefreshCw, Trash2, FileX
} from 'lucide-react';
import { config, API_URL } from '../../config';

interface Submission {
  id: string;
  title: string;
  creator: string;
  creatorEmail: string;
  submittedDate: string;
  rejectedDate: string;
  genre: string;
  budget: number;
  status: 'new' | 'review' | 'shortlisted' | 'accepted' | 'rejected' | 'archived';
  rating: number;
  synopsis: string;
  attachments: number;
  lastActivity: string;
  rejectionReason: string;
  rejectionCategory: 'budget' | 'content' | 'market' | 'quality' | 'legal' | 'other';
  feedback?: string;
  canResubmit: boolean;
  rejectedBy?: string;
}

export default function ProductionSubmissionsRejected() {
    
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [rejectionFilter, setRejectionFilter] = useState('all');
  const [resubmitFilter, setResubmitFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'rating' | 'budget'>('recent');

  useEffect(() => {
    const fetchRejectedSubmissions = async () => {
      try {
        setLoading(true);
        // Connect to production API
    const response = await fetch(`${API_URL}/api/production/submissions?status=rejected`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setSubmissions(data.data?.submissions || data.submissions || []);
        } else {
          throw new Error(`Failed to fetch rejected submissions: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching rejected submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRejectedSubmissions();
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    const matchesRejection = rejectionFilter === 'all' || submission.rejectionCategory === rejectionFilter;
    const matchesResubmit = resubmitFilter === 'all' || 
                           (resubmitFilter === 'allowed' && submission.canResubmit) ||
                           (resubmitFilter === 'not-allowed' && !submission.canResubmit);
    return matchesSearch && matchesGenre && matchesRejection && matchesResubmit;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.rejectedDate).getTime() - new Date(a.rejectedDate).getTime();
      case 'oldest':
        return new Date(a.rejectedDate).getTime() - new Date(b.rejectedDate).getTime();
      case 'rating':
        return b.rating - a.rating;
      case 'budget':
        return b.budget - a.budget;
      default:
        return 0;
    }
  });

  const stats = {
    total: submissions.length,
    canResubmit: submissions.filter(s => s.canResubmit).length,
    thisMonth: submissions.filter(s => {
      const rejectedDate = new Date(s.rejectedDate);
      const now = new Date();
      return rejectedDate.getMonth() === now.getMonth() && rejectedDate.getFullYear() === now.getFullYear();
    }).length,
    budgetIssues: submissions.filter(s => s.rejectionCategory === 'budget').length
  };

  const genres = ['all', ...new Set(submissions.map(s => s.genre))];

  const updateStatus = async (pitchId: string, status: string) => {
    try {
      const response = await fetch(`${API_URL}/api/production/submissions/${pitchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (result.success) {
        setSubmissions(prev => prev.filter(s => String(s.id) !== pitchId));
      }
    } catch (error) {
      console.error('Failed to update submission status:', error);
    }
  };

  const handleReconsider = (submissionId: string) => {
    updateStatus(submissionId, 'reviewing');
  };

  const handleArchive = (submissionId: string) => {
    updateStatus(submissionId, 'archived');
  };

  const handleDelete = (submissionId: string) => {
    updateStatus(submissionId, 'archived');
  };

  const handleSendFeedback = (_submissionId: string) => {
    // Navigate to messages
  };

  const getRejectionCategoryColor = (category: string) => {
    switch (category) {
      case 'budget': return 'text-yellow-600 bg-yellow-100';
      case 'content': return 'text-blue-600 bg-blue-100';
      case 'market': return 'text-purple-600 bg-purple-100';
      case 'quality': return 'text-red-600 bg-red-100';
      case 'legal': return 'text-gray-600 bg-gray-100';
      case 'other': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRejectionCategoryIcon = (category: string) => {
    switch (category) {
      case 'budget': return DollarSign;
      case 'content': return FileText;
      case 'market': return TrendingUp;
      case 'quality': return AlertTriangle;
      case 'legal': return FileX;
      case 'other': return XCircle;
      default: return XCircle;
    }
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.total}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Can Resubmit</p>
                <p className="text-2xl font-bold text-blue-600">{stats.canResubmit}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-purple-600">{stats.thisMonth}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Budget Issues</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.budgetIssues}</p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-600" />
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
                  placeholder="Search rejected submissions..."
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

            <select
              value={rejectionFilter}
              onChange={(e) => setRejectionFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Rejection Reasons</option>
              <option value="budget">Budget Concerns</option>
              <option value="content">Content Issues</option>
              <option value="market">Market Concerns</option>
              <option value="quality">Quality Issues</option>
              <option value="legal">Legal Issues</option>
              <option value="other">Other</option>
            </select>

            <select
              value={resubmitFilter}
              onChange={(e) => setResubmitFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Resubmit Status</option>
              <option value="allowed">Can Resubmit</option>
              <option value="not-allowed">Cannot Resubmit</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="recent">Recently Rejected</option>
              <option value="oldest">Oldest First</option>
              <option value="rating">Rating</option>
              <option value="budget">Budget</option>
            </select>
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSubmissions.map((submission) => {
              const CategoryIcon = getRejectionCategoryIcon(submission.rejectionCategory);
              return (
                <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          REJECTED
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getRejectionCategoryColor(submission.rejectionCategory)}`}>
                          <CategoryIcon className="w-3 h-3" />
                          {submission.rejectionCategory.toUpperCase()}
                        </span>
                        {submission.canResubmit && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            CAN RESUBMIT
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{submission.synopsis}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {submission.creator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Rejected: {new Date(submission.rejectedDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${(submission.budget / 1000000).toFixed(1)}M
                        </span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {submission.genre}
                        </span>
                        {submission.rejectedBy && (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" />
                            Rejected by {submission.rejectedBy}
                          </span>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-gray-600">Final Rating:</span>
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
                        <span className="text-sm text-gray-500">({submission.rating}/5)</span>
                      </div>

                      {/* Rejection Reason */}
                      <div className="p-3 bg-red-50 rounded-lg mb-3">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium text-red-800">Rejection Reason:</span> {submission.rejectionReason}
                        </p>
                      </div>

                      {/* Feedback */}
                      {submission.feedback && (
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium text-yellow-800">Feedback:</span> {submission.feedback}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-500">{submission.lastActivity}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <FileText className="w-3 h-3" />
                        {submission.attachments} files
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="flex gap-2">
                      {submission.canResubmit && (
                        <button 
                          onClick={() => handleReconsider(submission.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reconsider
                        </button>
                      )}
                      <button 
                        onClick={() => handleArchive(submission.id)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
                      >
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSendFeedback(submission.id)}
                        className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Send Feedback
                      </button>
                      <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(submission.id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sortedSubmissions.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No rejected submissions found</p>
            <p className="text-sm text-gray-400 mt-2">
              Submissions that have been rejected will appear here with rejection reasons and feedback.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}