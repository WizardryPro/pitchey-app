import { useState, useEffect } from 'react';
import { 
  FileText, Clock, Star, CheckCircle, XCircle, Archive, 
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, ThumbsUp, ThumbsDown, 
  AlertCircle, Timer, Edit3, Bookmark
} from 'lucide-react';
import { config, API_URL } from '../../config';

interface Submission {
  id: string;
  title: string;
  creator: string;
  creatorEmail: string;
  submittedDate: string;
  reviewStartedDate: string;
  genre: string;
  budget: number;
  status: 'new' | 'review' | 'shortlisted' | 'accepted' | 'rejected' | 'archived';
  rating: number;
  synopsis: string;
  attachments: number;
  lastActivity: string;
  reviewNotes?: string;
  reviewer?: string;
  reviewProgress: number;
  timeInReview?: number;
}

export default function ProductionSubmissionsReview() {
    
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [reviewerFilter, setReviewerFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'progress' | 'timeInReview' | 'rating' | 'budget'>('timeInReview');

  useEffect(() => {
    const fetchReviewSubmissions = async () => {
      try {
        setLoading(true);
        // Connect to production API
    const response = await fetch(`${API_URL}/api/production/submissions?status=review`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setSubmissions(data.data?.submissions || data.submissions || []);
        } else {
          throw new Error(`Failed to fetch review submissions: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching review submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewSubmissions();
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    const matchesReviewer = reviewerFilter === 'all' || submission.reviewer === reviewerFilter;
    return matchesSearch && matchesGenre && matchesReviewer;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'progress':
        return b.reviewProgress - a.reviewProgress;
      case 'timeInReview':
        return (b.timeInReview || 0) - (a.timeInReview || 0);
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
    nearComplete: submissions.filter(s => s.reviewProgress >= 80).length,
    overdue: submissions.filter(s => (s.timeInReview || 0) > 7).length,
    highRated: submissions.filter(s => s.rating >= 4).length
  };

  const genres = ['all', ...new Set(submissions.map(s => s.genre))];
  const reviewers = ['all', ...new Set(submissions.map(s => s.reviewer).filter(Boolean))];

  const updateStatus = async (pitchId: string, status: string, notes?: string) => {
    try {
      const response = await fetch(`${API_URL}/api/production/submissions/${pitchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, notes })
      });
      const result = await response.json();
      if (result.success) {
        setSubmissions(prev => prev.filter(s => String(s.id) !== pitchId));
      }
    } catch (error) {
      console.error('Failed to update submission status:', error);
    }
  };

  const handleApprove = (submissionId: string) => {
    updateStatus(submissionId, 'accepted');
  };

  const handleReject = (submissionId: string) => {
    updateStatus(submissionId, 'rejected');
  };

  const handleShortlist = (submissionId: string) => {
    updateStatus(submissionId, 'shortlisted');
  };

  const handleAddNote = (submissionId: string) => {
    const note = prompt('Add review note:');
    if (note) {
      updateStatus(submissionId, 'reviewing', note);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-600 bg-green-100';
    if (progress >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-blue-600 bg-blue-100';
  };

  const getTimeInReviewColor = (days: number) => {
    if (days > 7) return 'text-red-600 bg-red-100';
    if (days > 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Review</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.total}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Near Complete</p>
                <p className="text-2xl font-bold text-green-600">{stats.nearComplete}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Rated</p>
                <p className="text-2xl font-bold text-purple-600">{stats.highRated}</p>
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
                  placeholder="Search submissions under review..."
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
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {reviewers.map(reviewer => (
                <option key={reviewer} value={reviewer}>
                  {reviewer === 'all' ? 'All Reviewers' : reviewer}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="timeInReview">Time in Review</option>
              <option value="progress">Progress</option>
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
            {sortedSubmissions.map((submission) => (
              <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        UNDER REVIEW
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTimeInReviewColor(submission.timeInReview || 0)}`}>
                        {submission.timeInReview} DAYS
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{submission.synopsis}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {submission.creator}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Started: {new Date(submission.reviewStartedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${(submission.budget / 1000000).toFixed(1)}M
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {submission.genre}
                      </span>
                      {submission.reviewer && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <Eye className="w-4 h-4" />
                          {submission.reviewer}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Review Progress</span>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getProgressColor(submission.reviewProgress)}`}>
                          {submission.reviewProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${submission.reviewProgress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-gray-600">Current Rating:</span>
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

                    {submission.reviewNotes && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Review Notes:</span> {submission.reviewNotes}
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
                    <button 
                      onClick={() => handleApprove(submission.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Approve
                    </button>
                    <button 
                      onClick={() => handleShortlist(submission.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                      <Bookmark className="w-4 h-4" />
                      Shortlist
                    </button>
                    <button 
                      onClick={() => handleReject(submission.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Reject
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAddNote(submission.id)}
                      className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Add Note
                    </button>
                    <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Contact
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedSubmissions.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No submissions under review</p>
            <p className="text-sm text-gray-400 mt-2">
              Submissions that are actively being reviewed will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}