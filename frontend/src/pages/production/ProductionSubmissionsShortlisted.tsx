import { useState, useEffect } from 'react';
import { 
  FileText, Clock, Star, CheckCircle, XCircle, Archive, 
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, ThumbsUp, ThumbsDown, 
  Bookmark, Award, Target, Zap
} from 'lucide-react';
import { config, API_URL } from '../../config';

interface Submission {
  id: string;
  title: string;
  creator: string;
  creatorEmail: string;
  submittedDate: string;
  shortlistedDate: string;
  genre: string;
  budget: number;
  status: 'new' | 'review' | 'shortlisted' | 'accepted' | 'rejected' | 'archived';
  rating: number;
  synopsis: string;
  attachments: number;
  lastActivity: string;
  reviewNotes?: string;
  shortlistReason?: string;
  marketPotential: 'high' | 'medium' | 'low';
  competitionLevel: 'high' | 'medium' | 'low';
  productionReadiness: number;
}

export default function ProductionSubmissionsShortlisted() {
    
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'market' | 'budget' | 'readiness'>('rating');

  useEffect(() => {
    const fetchShortlistedSubmissions = async () => {
      try {
        setLoading(true);
        // Connect to production API
    const response = await fetch(`${API_URL}/api/production/submissions?status=shortlisted`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setSubmissions(data.data?.submissions || data.submissions || []);
        } else {
          throw new Error(`Failed to fetch shortlisted submissions: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching shortlisted submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchShortlistedSubmissions();
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    const matchesMarket = marketFilter === 'all' || submission.marketPotential === marketFilter;
    return matchesSearch && matchesGenre && matchesMarket;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'market':
        const marketOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return (marketOrder[b.marketPotential] || 0) - (marketOrder[a.marketPotential] || 0);
      case 'budget':
        return b.budget - a.budget;
      case 'readiness':
        return b.productionReadiness - a.productionReadiness;
      default:
        return 0;
    }
  });

  const stats = {
    total: submissions.length,
    highPotential: submissions.filter(s => s.marketPotential === 'high').length,
    readyToGo: submissions.filter(s => s.productionReadiness >= 85).length,
    topRated: submissions.filter(s => s.rating === 5).length
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

  const handleApprove = (submissionId: string) => {
    updateStatus(submissionId, 'accepted');
  };

  const handleReject = (submissionId: string) => {
    updateStatus(submissionId, 'rejected');
  };

  const handleStartProduction = (submissionId: string) => {
    updateStatus(submissionId, 'accepted');
  };

  const getMarketPotentialColor = (potential: string) => {
    switch (potential) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCompetitionColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 85) return 'text-green-600 bg-green-100';
    if (readiness >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Shortlisted</p>
                <p className="text-2xl font-bold text-purple-600">{stats.total}</p>
              </div>
              <Bookmark className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Potential</p>
                <p className="text-2xl font-bold text-green-600">{stats.highPotential}</p>
              </div>
              <Target className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Production Ready</p>
                <p className="text-2xl font-bold text-blue-600">{stats.readyToGo}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Top Rated</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.topRated}</p>
              </div>
              <Award className="w-8 h-8 text-yellow-600" />
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
                  placeholder="Search shortlisted submissions..."
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
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Market Potential</option>
              <option value="high">High Potential</option>
              <option value="medium">Medium Potential</option>
              <option value="low">Low Potential</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="rating">Rating</option>
              <option value="market">Market Potential</option>
              <option value="readiness">Production Readiness</option>
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
              <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full flex items-center gap-1">
                        <Bookmark className="w-3 h-3" />
                        SHORTLISTED
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMarketPotentialColor(submission.marketPotential)}`}>
                        {submission.marketPotential.toUpperCase()} POTENTIAL
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
                        Shortlisted: {new Date(submission.shortlistedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${(submission.budget / 1000000).toFixed(1)}M
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {submission.genre}
                      </span>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-gray-600">Rating:</span>
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

                    {/* Market Analysis */}
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Market Potential</div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getMarketPotentialColor(submission.marketPotential)}`}>
                          {submission.marketPotential}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Competition</div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getCompetitionColor(submission.competitionLevel)}`}>
                          {submission.competitionLevel}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Production Readiness</div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getReadinessColor(submission.productionReadiness)}`}>
                          {submission.productionReadiness}%
                        </span>
                      </div>
                    </div>

                    {/* Production Readiness Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Production Readiness</span>
                        <span className="text-sm text-gray-500">{submission.productionReadiness}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${submission.productionReadiness}%` }}
                        ></div>
                      </div>
                    </div>

                    {submission.shortlistReason && (
                      <div className="p-3 bg-purple-50 rounded-lg mb-3">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Shortlist Reason:</span> {submission.shortlistReason}
                        </p>
                      </div>
                    )}

                    {submission.reviewNotes && (
                      <div className="p-3 bg-gray-50 rounded-lg">
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
                      <CheckCircle className="w-4 h-4" />
                      Approve for Production
                    </button>
                    <button 
                      onClick={() => handleStartProduction(submission.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Start Production
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Contact
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleReject(submission.id)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedSubmissions.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg">
            <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No shortlisted submissions found</p>
            <p className="text-sm text-gray-400 mt-2">
              Submissions that have been shortlisted for production consideration will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}