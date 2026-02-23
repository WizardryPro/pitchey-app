import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, Star, CheckCircle, XCircle, Archive,
  Filter, Search, Calendar, User, DollarSign, TrendingUp,
  Eye, Download, MessageSquare, Play, Pause, Settings,
  Award, Briefcase, Users, BarChart3
} from 'lucide-react';
import { config, API_URL } from '../../config';

interface Submission {
  id: string;
  title: string;
  creator: string;
  creatorEmail: string;
  submittedDate: string;
  acceptedDate: string;
  genre: string;
  budget: number;
  status: 'new' | 'review' | 'shortlisted' | 'accepted' | 'rejected' | 'archived';
  rating: number;
  synopsis: string;
  attachments: number;
  lastActivity: string;
  reviewNotes?: string;
  productionStatus: 'pre-production' | 'production' | 'post-production' | 'completed';
  productionStartDate?: string;
  estimatedCompletion?: string;
  productionProgress: number;
  contractStatus: 'pending' | 'signed' | 'in-negotiation';
  assignedProducer?: string;
  team?: string[];
}

export default function ProductionSubmissionsAccepted() {
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [productionFilter, setProductionFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'progress' | 'budget' | 'completion' | 'rating'>('progress');

  useEffect(() => {
    const fetchAcceptedSubmissions = async () => {
      try {
        setLoading(true);
        // Connect to production API
    const response = await fetch(`${API_URL}/api/production/submissions?status=accepted`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setSubmissions(data.data?.submissions || data.submissions || []);
        } else {
          throw new Error(`Failed to fetch accepted submissions: ${response.status}`);
        }
      } catch (error) {
        console.error('Error fetching accepted submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAcceptedSubmissions();
  }, []);

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          submission.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || submission.genre === selectedGenre;
    const matchesProduction = productionFilter === 'all' || submission.productionStatus === productionFilter;
    const matchesContract = contractFilter === 'all' || submission.contractStatus === contractFilter;
    return matchesSearch && matchesGenre && matchesProduction && matchesContract;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'progress':
        return b.productionProgress - a.productionProgress;
      case 'budget':
        return b.budget - a.budget;
      case 'completion':
        if (!a.estimatedCompletion || !b.estimatedCompletion) return 0;
        return new Date(a.estimatedCompletion).getTime() - new Date(b.estimatedCompletion).getTime();
      case 'rating':
        return b.rating - a.rating;
      default:
        return 0;
    }
  });

  const stats = {
    total: submissions.length,
    inProduction: submissions.filter(s => s.productionStatus === 'production').length,
    completed: submissions.filter(s => s.productionStatus === 'completed').length,
    totalBudget: submissions.reduce((sum, s) => sum + s.budget, 0)
  };

  const genres = ['all', ...new Set(submissions.map(s => s.genre))];

  const handleViewProject = (submissionId: string) => {
    navigate(`/production/projects/${submissionId}`);
  };

  const handleManageProduction = (submissionId: string) => {
    navigate(`/production/projects/${submissionId}`);
  };

  const handleViewContract = (_submissionId: string) => {
    // Contract management - future feature
  };

  const getProductionStatusColor = (status: string) => {
    switch (status) {
      case 'pre-production': return 'text-blue-600 bg-blue-100';
      case 'production': return 'text-yellow-600 bg-yellow-100';
      case 'post-production': return 'text-purple-600 bg-purple-100';
      case 'completed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getContractStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'in-negotiation': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Accepted</p>
                <p className="text-2xl font-bold text-green-600">{stats.total}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Production</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inProduction}</p>
              </div>
              <Play className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-purple-600">{stats.completed}</p>
              </div>
              <Award className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-blue-600">${(stats.totalBudget / 1000000).toFixed(1)}M</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
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
                  placeholder="Search accepted submissions..."
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
              value={productionFilter}
              onChange={(e) => setProductionFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Production Status</option>
              <option value="pre-production">Pre-Production</option>
              <option value="production">Production</option>
              <option value="post-production">Post-Production</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Contract Status</option>
              <option value="signed">Signed</option>
              <option value="pending">Pending</option>
              <option value="in-negotiation">In Negotiation</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="progress">Production Progress</option>
              <option value="completion">Estimated Completion</option>
              <option value="budget">Budget</option>
              <option value="rating">Rating</option>
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
              <div key={submission.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{submission.title}</h3>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        ACCEPTED
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getProductionStatusColor(submission.productionStatus)}`}>
                        {submission.productionStatus.toUpperCase().replace('-', ' ')}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getContractStatusColor(submission.contractStatus)}`}>
                        CONTRACT {submission.contractStatus.toUpperCase()}
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
                        Accepted: {new Date(submission.acceptedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${(submission.budget / 1000000).toFixed(1)}M
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {submission.genre}
                      </span>
                      {submission.assignedProducer && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <Briefcase className="w-4 h-4" />
                          {submission.assignedProducer}
                        </span>
                      )}
                    </div>

                    {/* Production Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      {submission.productionStartDate && (
                        <div>
                          <span className="text-sm text-gray-600">Production Start:</span>
                          <span className="ml-2 text-sm font-medium">
                            {new Date(submission.productionStartDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {submission.estimatedCompletion && (
                        <div>
                          <span className="text-sm text-gray-600">Est. Completion:</span>
                          <span className="ml-2 text-sm font-medium">
                            {new Date(submission.estimatedCompletion).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Production Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Production Progress</span>
                        <span className="text-sm text-gray-500">{submission.productionProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(submission.productionProgress)}`}
                          style={{ width: `${submission.productionProgress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Team */}
                    {submission.team && submission.team.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Production Team</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {submission.team.map((member, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {member}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {submission.reviewNotes && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Notes:</span> {submission.reviewNotes}
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
                      onClick={() => handleViewProject(submission.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Project
                    </button>
                    <button 
                      onClick={() => handleManageProduction(submission.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Manage Production
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleViewContract(submission.id)}
                      className="px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      View Contract
                    </button>
                    <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Contact Creator
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
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No accepted submissions found</p>
            <p className="text-sm text-gray-400 mt-2">
              Submissions that have been approved for production will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}