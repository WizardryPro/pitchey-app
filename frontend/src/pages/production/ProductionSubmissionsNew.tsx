import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, Star, CheckCircle, XCircle, Archive,
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, ThumbsUp, ThumbsDown,
  AlertCircle, Bell, ArrowRight
} from 'lucide-react';
import { config, API_URL } from '../../config';

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
  priority?: 'high' | 'medium' | 'low';
  daysOld?: number;
}

export default function ProductionSubmissionsNew() {
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'budget'>('newest');

  useEffect(() => {
    const fetchNewSubmissions = async () => {
      try {
        setLoading(true);
        // Connect to production API
    const response = await fetch(`${API_URL}/api/production/submissions?status=new`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setSubmissions(data.data?.submissions || data.submissions || []);
        } else {
          throw new Error(`Failed to fetch new submissions: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching new submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNewSubmissions();
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime();
      case 'oldest':
        return new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime();
      case 'priority':
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return (priorityOrder[b.priority || 'low'] || 0) - (priorityOrder[a.priority || 'low'] || 0);
      case 'budget':
        return b.budget - a.budget;
      default:
        return 0;
    }
  });

  const stats = {
    total: submissions.length,
    urgent: submissions.filter(s => s.daysOld! > 3).length,
    highPriority: submissions.filter(s => s.priority === 'high').length,
    highBudget: submissions.filter(s => s.budget > 2000000).length
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

  const handleStartReview = (submissionId: string) => {
    updateStatus(submissionId, 'reviewing');
  };

  const handleQuickApprove = (submissionId: string) => {
    updateStatus(submissionId, 'accepted');
  };

  const handleReject = (submissionId: string) => {
    updateStatus(submissionId, 'rejected');
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
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
                <p className="text-sm text-gray-600">Total New</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Urgent Review</p>
                <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-purple-600">{stats.highPriority}</p>
              </div>
              <Star className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Budget</p>
                <p className="text-2xl font-bold text-green-600">{stats.highBudget}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
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
                  placeholder="Search new submissions..."
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
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Priority</option>
              <option value="budget">Budget</option>
            </select>
          </div>
        </div>

        {/* Action Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Review Required</p>
                <p className="text-sm text-blue-700">
                  {stats.total} new submissions await your review. Start with high-priority items.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/production/submissions/review')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              Start Batch Review
              <ArrowRight className="w-4 h-4" />
            </button>
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
              <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        NEW
                      </span>
                      {submission.priority && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(submission.priority)}`}>
                          {submission.priority?.toUpperCase()} PRIORITY
                        </span>
                      )}
                      {submission.daysOld! > 3 && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          URGENT
                        </span>
                      )}
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
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {submission.attachments} files
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-500">{submission.lastActivity}</span>
                    {submission.daysOld !== undefined && (
                      <span className="text-xs text-gray-500">
                        {submission.daysOld === 0 ? 'Just submitted' : `${submission.daysOld} days old`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleStartReview(submission.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Start Review
                    </button>
                    <button 
                      onClick={() => handleQuickApprove(submission.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Quick Approve
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Contact Creator
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleReject(submission.id)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Quick Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedSubmissions.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No new submissions found</p>
            <p className="text-sm text-gray-400 mt-2">
              New submissions will appear here when creators submit their pitches for review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}