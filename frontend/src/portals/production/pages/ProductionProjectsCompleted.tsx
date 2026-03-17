import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { CheckCircle, Trophy, Star, TrendingUp, DollarSign, Calendar, Users, MoreVertical, Eye, Download, BarChart3, Award, Film, Archive } from 'lucide-react';
import { config, API_URL } from '@/config';

interface Project {
  id: string;
  title: string;
  genre: string;
  status: 'delivered' | 'theatrical-release' | 'streaming-release' | 'festival-circuit' | 'awards-consideration';
  budget: number;
  finalBudget: number;
  startDate: string;
  wrapDate: string;
  deliveryDate: string;
  releaseDate?: string;
  team: number;
  director?: string;
  producer?: string;
  runtime: number; // in minutes
  rating?: string; // MPAA rating
  boxOffice?: number;
  streamingViews?: number;
  criticsScore?: number;
  audienceScore?: number;
  awards: {
    wins: number;
    nominations: number;
    festivals: string[];
  };
  distribution: {
    theatrical?: boolean;
    streaming?: string[];
    international?: string[];
  };
  roi: number; // Return on Investment percentage
  profitLoss: number; // Actual profit/loss
  performance: 'excellent' | 'good' | 'fair' | 'poor';
  lessons: string[];
  totalDays: number;
  pitch_id?: number | null;
}

const statusColors = {
  delivered: 'bg-green-100 text-green-800 border-green-200',
  'theatrical-release': 'bg-blue-100 text-blue-800 border-blue-200',
  'streaming-release': 'bg-purple-100 text-purple-800 border-purple-200',
  'festival-circuit': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'awards-consideration': 'bg-amber-100 text-amber-800 border-amber-200'
};

const performanceColors = {
  excellent: 'text-green-600 bg-green-50',
  good: 'text-blue-600 bg-blue-50',
  fair: 'text-yellow-600 bg-yellow-50',
  poor: 'text-red-600 bg-red-50'
};

const ratingColors = {
  'G': 'bg-green-100 text-green-700',
  'PG': 'bg-blue-100 text-blue-700',
  'PG-13': 'bg-yellow-100 text-yellow-700',
  'R': 'bg-orange-100 text-orange-700',
  'NC-17': 'bg-red-100 text-red-700'
};

export default function ProductionProjectsCompleted() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [performanceFilter, setPerformanceFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  useEffect(() => {
    fetchCompletedProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, statusFilter, performanceFilter, genreFilter, yearFilter]);

  const fetchCompletedProjects = async () => {
    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/production/projects?status=completed`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error(`Failed to fetch completed projects: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.data?.projects || data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching completed projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load completed projects');
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    const filtered = projects.filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesPerformance = performanceFilter === 'all' || project.performance === performanceFilter;
      const matchesGenre = genreFilter === 'all' || project.genre === genreFilter;
      
      let matchesYear = true;
      if (yearFilter !== 'all') {
        const projectYear = new Date(project.deliveryDate).getFullYear().toString();
        matchesYear = projectYear === yearFilter;
      }

      return matchesStatus && matchesPerformance && matchesGenre && matchesYear;
    });

    setFilteredProjects(filtered);
  };

  const stats = {
    total: projects.length,
    totalBudget: projects.reduce((sum, p) => sum + p.finalBudget, 0),
    totalRevenue: projects.reduce((sum, p) => sum + (p.boxOffice || 0) + (p.profitLoss > 0 ? p.profitLoss : 0), 0),
    avgROI: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.roi, 0) / projects.length) : 0,
    totalAwards: projects.reduce((sum, p) => sum + p.awards.wins, 0),
    excellentProjects: projects.filter(p => p.performance === 'excellent').length,
    avgCriticsScore: projects.filter(p => p.criticsScore).length > 0 
      ? Math.round(projects.filter(p => p.criticsScore).reduce((sum, p) => sum + (p.criticsScore || 0), 0) / projects.filter(p => p.criticsScore).length)
      : 0
  };

  const getROIColor = (roi: number) => {
    if (roi >= 200) return 'text-green-600';
    if (roi >= 100) return 'text-blue-600';
    if (roi >= 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const uniqueGenres = [...new Set(projects.map(p => p.genre))];
  const uniqueYears = [...new Set(projects.map(p => new Date(p.deliveryDate).getFullYear().toString()))];

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-green-600">{stats.excellentProjects} excellent</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-gray-500">vs {formatCurrency(stats.totalBudget)} budget</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average ROI</p>
                <p className={`text-2xl font-bold ${getROIColor(stats.avgROI)}`}>{stats.avgROI}%</p>
              </div>
              <TrendingUp className={`w-8 h-8 ${getROIColor(stats.avgROI)}`} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Awards Won</p>
                <p className="text-2xl font-bold text-amber-600">{stats.totalAwards}</p>
                <p className="text-sm text-gray-500">Critics: {stats.avgCriticsScore}%</p>
              </div>
              <Trophy className="w-8 h-8 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Status</option>
              <option value="delivered">Delivered</option>
              <option value="theatrical-release">Theatrical Release</option>
              <option value="streaming-release">Streaming Release</option>
              <option value="festival-circuit">Festival Circuit</option>
              <option value="awards-consideration">Awards Consideration</option>
            </select>

            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Performance</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>

            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Genres</option>
              {uniqueGenres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Years</option>
              {uniqueYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : error && projects.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">Error: {error}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h3>
                      <p className="text-sm text-gray-600">{project.genre} • {project.runtime} min</p>
                      <div className="flex items-center gap-2 mt-1">
                        {project.rating && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${ratingColors[project.rating as keyof typeof ratingColors] || 'bg-gray-100 text-gray-700'}`}>
                            {project.rating}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          Released: {project.releaseDate ? new Date(project.releaseDate).toLocaleDateString() : 'TBD'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[project.status]}`}>
                        {project.status.replace('-', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${performanceColors[project.performance]}`}>
                        {project.performance.toUpperCase()}
                      </span>
                      <div className="relative" ref={openMenuId === project.id ? menuRef : undefined}>
                        <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}>
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        {openMenuId === project.id && (
                          <div className="absolute right-0 top-8 z-10 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                            <button onClick={() => { navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Eye className="w-4 h-4" />View Details</button>
                            <button onClick={() => { navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Analytics</button>
                            <button onClick={() => { navigate('/production/projects'); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Archive className="w-4 h-4" />Archive</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">ROI</p>
                      <p className={`text-lg font-bold ${getROIColor(project.roi)}`}>
                        {project.roi >= 0 ? '+' : ''}{project.roi}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Profit/Loss</p>
                      <p className={`text-lg font-bold ${project.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(project.profitLoss)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Final Budget</p>
                      <p className="font-semibold">{formatCurrency(project.finalBudget)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Days</p>
                      <p className="font-semibold">{project.totalDays} days</p>
                    </div>
                  </div>

                  {/* Box Office / Streaming */}
                  {(project.boxOffice || project.streamingViews) && (
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      {project.boxOffice && (
                        <div>
                          <p className="text-gray-600">Box Office</p>
                          <p className="font-semibold">{formatCurrency(project.boxOffice)}</p>
                        </div>
                      )}
                      {project.streamingViews && (
                        <div>
                          <p className="text-gray-600">Streaming Views</p>
                          <p className="font-semibold">{(project.streamingViews / 1000000).toFixed(1)}M</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scores */}
                  {(project.criticsScore || project.audienceScore) && (
                    <div className="flex gap-4 mb-4">
                      {project.criticsScore && (
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">Critics: {project.criticsScore}%</span>
                        </div>
                      )}
                      {project.audienceScore && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">Audience: {project.audienceScore}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Awards */}
                  {project.awards.wins > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">
                          {project.awards.wins} wins, {project.awards.nominations} nominations
                        </span>
                      </div>
                      {project.awards.festivals.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {project.awards.festivals.map((festival, index) => (
                            <span key={index} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded">
                              {festival}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Team Info */}
                  <div className="border-t pt-4 mb-4 text-sm">
                    {project.director && (
                      <p className="text-gray-600 mb-1">
                        Director: <span className="font-medium text-gray-900">{project.director}</span>
                      </p>
                    )}
                    {project.producer && (
                      <p className="text-gray-600">
                        Producer: <span className="font-medium text-gray-900">{project.producer}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                      className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Analytics
                    </button>
                    <button
                      onClick={() => toast('Export will be available soon', { icon: 'ℹ️' })}
                      className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && !loading && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No completed projects found</p>
            <p className="text-sm text-gray-400">
              Completed projects will appear here after delivery
            </p>
          </div>
        )}
      </div>
    </div>
  );
}