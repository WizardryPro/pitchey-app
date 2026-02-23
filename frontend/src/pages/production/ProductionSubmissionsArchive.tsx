import { useState, useEffect } from 'react';
import { 
  FileText, Clock, Star, CheckCircle, XCircle, Archive, 
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, RotateCcw, Trash2,
  Database, History, Tag
} from 'lucide-react';
import { config, API_URL } from '../../config';

interface ArchivedSubmission {
  id: string;
  title: string;
  creator: string;
  creatorEmail: string;
  submittedDate: string;
  archivedDate: string;
  genre: string;
  budget: number;
  originalStatus: 'new' | 'review' | 'shortlisted' | 'accepted' | 'rejected';
  finalStatus: 'completed' | 'cancelled' | 'expired' | 'archived';
  rating: number;
  synopsis: string;
  attachments: number;
  lastActivity: string;
  archiveReason: string;
  notes?: string;
  archivedBy?: string;
  tags?: string[];
  totalViews?: number;
}

export default function ProductionSubmissionsArchive() {
    
  const [submissions, setSubmissions] = useState<ArchivedSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'archived' | 'submitted' | 'rating' | 'budget'>('archived');

  useEffect(() => {
    const fetchArchivedSubmissions = async () => {
      try {
        setLoading(true);
        // Connect to production API
    const response = await fetch(`${API_URL}/api/production/submissions?status=archived`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setSubmissions(data.data?.submissions || data.submissions || []);
        } else {
          throw new Error(`Failed to fetch archived submissions: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching archived submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedSubmissions();
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    const matchesStatus = statusFilter === 'all' || submission.finalStatus === statusFilter;
    const matchesYear = yearFilter === 'all' || 
                       new Date(submission.archivedDate).getFullYear().toString() === yearFilter;
    return matchesSearch && matchesGenre && matchesStatus && matchesYear;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'archived':
        return new Date(b.archivedDate).getTime() - new Date(a.archivedDate).getTime();
      case 'submitted':
        return new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime();
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
    completed: submissions.filter(s => s.finalStatus === 'completed').length,
    cancelled: submissions.filter(s => s.finalStatus === 'cancelled').length,
    thisYear: submissions.filter(s => {
      const archivedYear = new Date(s.archivedDate).getFullYear();
      const currentYear = new Date().getFullYear();
      return archivedYear === currentYear;
    }).length
  };

  const genres = ['all', ...new Set(submissions.map(s => s.genre))];
  const years = ['all', ...new Set(submissions.map(s => new Date(s.archivedDate).getFullYear().toString()))].sort().reverse();

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

  const handleRestore = (submissionId: string) => {
    updateStatus(submissionId, 'reviewing');
  };

  const handlePermanentDelete = (submissionId: string) => {
    updateStatus(submissionId, 'archived');
  };

  const handleExport = (_submissionId: string) => {
    // Export functionality - future feature
  };

  const getFinalStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      case 'expired': return 'text-yellow-600 bg-yellow-100';
      case 'archived': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getOriginalStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-100';
      case 'review': return 'text-yellow-600 bg-yellow-100';
      case 'shortlisted': return 'text-purple-600 bg-purple-100';
      case 'accepted': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
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
                <p className="text-sm text-gray-600">Total Archived</p>
                <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
              </div>
              <Archive className="w-8 h-8 text-gray-700" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Year</p>
                <p className="text-2xl font-bold text-purple-600">{stats.thisYear}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
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
                  placeholder="Search archived submissions..."
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Final Status</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {years.map(year => (
                <option key={year} value={year}>
                  {year === 'all' ? 'All Years' : year}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="archived">Archived Date</option>
              <option value="submitted">Submitted Date</option>
              <option value="rating">Rating</option>
              <option value="budget">Budget</option>
            </select>
          </div>
        </div>

        {/* Archive Information Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">Archive Information</p>
              <p className="text-sm text-blue-700">
                This archive contains historical submission data for reference, analysis, and compliance purposes.
                Items are archived after completion, cancellation, or expiration.
              </p>
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
            {sortedSubmissions.map((submission) => (
              <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-gray-400">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full flex items-center gap-1">
                        <Archive className="w-3 h-3" />
                        ARCHIVED
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFinalStatusColor(submission.finalStatus)}`}>
                        {submission.finalStatus.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getOriginalStatusColor(submission.originalStatus)}`}>
                        WAS {submission.originalStatus.toUpperCase()}
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
                        Submitted: {new Date(submission.submittedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <History className="w-4 h-4" />
                        Archived: {new Date(submission.archivedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${(submission.budget / 1000000).toFixed(1)}M
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {submission.genre}
                      </span>
                      {submission.totalViews && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Eye className="w-4 h-4" />
                          {submission.totalViews} views
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

                    {/* Tags */}
                    {submission.tags && submission.tags.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {submission.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Archive Reason */}
                    <div className="p-3 bg-gray-50 rounded-lg mb-3">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Archive Reason:</span> {submission.archiveReason}
                      </p>
                      {submission.archivedBy && (
                        <p className="text-xs text-gray-600 mt-1">
                          Archived by: {submission.archivedBy}
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    {submission.notes && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium text-blue-800">Notes:</span> {submission.notes}
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
                      onClick={() => handleRestore(submission.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                    <button 
                      onClick={() => handleExport(submission.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export Data
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Contact Creator
                    </button>
                    <button 
                      onClick={() => handlePermanentDelete(submission.id)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Permanently
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedSubmissions.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No archived submissions found</p>
            <p className="text-sm text-gray-400 mt-2">
              Completed, cancelled, and expired submissions will be stored here for historical reference.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}