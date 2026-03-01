import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Trophy, Film, Calendar, DollarSign,
  Star, TrendingUp, Award, Download, Search,
  Filter, BarChart3, Users, Globe, Clock,
  Play, FileText, ExternalLink, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

interface CompletedProject {
  id: number;
  pitch_id?: number;
  pitch_title?: string;
  pitch_genre?: string;
  company_name?: string;
  completion_date?: string;
  investment_amount?: number;
  final_return?: number;
  roi_percentage?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  // For backward compatibility
  title?: string;
  company?: string;
  genre?: string;
  completionDate?: string;
  investmentAmount?: number;
  finalReturn?: number;
  roi?: number;
  duration?: string;
  distributionStatus?: 'released' | 'in-distribution' | 'pending-release';
  revenue?: {
    boxOffice?: number;
    streaming?: number;
    international?: number;
    merchandising?: number;
    total: number;
  };
  awards?: string[];
  rating?: number;
  synopsis?: string;
  marketPerformance?: 'exceeded' | 'met' | 'below' | 'pending';
}

const CompletedProjects = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<CompletedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'released' | 'in-distribution' | 'pending-release'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'roi' | 'revenue'>('recent');

  useEffect(() => {
    loadCompletedProjects();
  }, []);

  const loadCompletedProjects = async () => {
    try {
      setLoading(true);
      const response = await investorApi.getCompletedProjects();
      
      if (response.success && response.data) {
        // Transform API data to match component expectations
        const transformedProjects = ((response.data as any).projects || []).map((project: any) => {
          return {
            id: project.id,
            pitch_id: project.pitch_id,
            pitch_title: project.pitch_title,
            pitch_genre: project.pitch_genre,
            company_name: project.company_name,
            completion_date: project.completion_date,
            investment_amount: project.investment_amount,
            final_return: project.final_return,
            roi_percentage: project.roi_percentage,
            status: project.status,
            created_at: project.created_at,
            updated_at: project.updated_at,
            // Map to expected field names for UI
            title: project.pitch_title,
            company: project.company_name || 'Unknown Company',
            genre: project.pitch_genre || 'Unknown',
            completionDate: project.completion_date || project.updated_at,
            investmentAmount: project.investment_amount || 0,
            finalReturn: project.final_return || 0,
            roi: project.roi_percentage || 0,
            duration: project.status === 'completed' ? '18 months' : '12 months',
            distributionStatus: project.status === 'completed' ? 'released' : 'pending-release',
            revenue: {
              boxOffice: Math.floor((project.final_return || 0) * 0.6),
              streaming: Math.floor((project.final_return || 0) * 0.2),
              international: Math.floor((project.final_return || 0) * 0.15),
              merchandising: Math.floor((project.final_return || 0) * 0.05),
              total: project.final_return || 0
            },
            awards: project.roi_percentage >= 100 ? ['Outstanding Performance Award'] : [],
            rating: Math.min(10, 6 + (project.roi_percentage || 0) / 50),
            synopsis: `${project.pitch_title} - A compelling ${(project.pitch_genre || 'drama').toLowerCase()} production.`,
            marketPerformance: project.roi_percentage >= 75 ? 'exceeded' : project.roi_percentage >= 25 ? 'met' : project.roi_percentage >= 0 ? 'below' : 'pending'
          };
        });
        
        setProjects(transformedProjects);
      } else {
        console.error('Failed to load completed projects:', response.error || 'Unknown error');
        setProjects([]);
      }
    } catch (error) {
      console.error('Failed to load completed projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'released':
        return 'text-green-600 bg-green-100';
      case 'in-distribution':
        return 'text-blue-600 bg-blue-100';
      case 'pending-release':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'exceeded':
        return 'text-green-600';
      case 'met':
        return 'text-blue-600';
      case 'below':
        return 'text-red-600';
      case 'pending':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const filteredProjects = projects
    .filter(project => {
      if (filterStatus !== 'all' && project.distributionStatus !== filterStatus) return false;
      if (searchQuery && 
          !(project.title || project.pitch_title || '').toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(project.company || project.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(project.genre || project.pitch_genre || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'roi':
          return (b.roi || b.roi_percentage || 0) - (a.roi || a.roi_percentage || 0);
        case 'revenue':
          return (b.revenue?.total || b.final_return || 0) - (a.revenue?.total || a.final_return || 0);
        case 'recent':
        default:
          const aDate = new Date(a.completionDate || a.completion_date || a.updated_at || '').getTime();
          const bDate = new Date(b.completionDate || b.completion_date || b.updated_at || '').getTime();
          return bDate - aDate;
      }
    });

  const totalInvested = projects.reduce((sum, p) => sum + (p.investmentAmount || p.investment_amount || 0), 0);
  const totalReturns = projects.reduce((sum, p) => sum + (p.finalReturn || p.final_return || 0), 0);
  const averageROI = projects.length > 0 ? projects.reduce((sum, p) => sum + (p.roi || p.roi_percentage || 0), 0) / projects.length : 0;
  const successfulProjects = projects.filter(p => (p.roi || p.roi_percentage || 0) > 50).length;

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Completed Projects</h1>
              <p className="text-gray-600 mt-2">
                Review your successful investments and their performance
              </p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Returns</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReturns)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average ROI</p>
                  <p className="text-2xl font-bold text-blue-600">{averageROI.toFixed(1)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {((successfulProjects / projects.length) * 100).toFixed(0)}%
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="completed-projects-search"
                    name="completed-projects-search"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="released">Released</option>
                <option value="in-distribution">In Distribution</option>
                <option value="pending-release">Pending Release</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="recent">Most Recent</option>
                <option value="roi">Highest ROI</option>
                <option value="revenue">Highest Revenue</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <div className="space-y-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Project Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                        <p className="text-sm text-gray-600">{project.company} • {project.genre}</p>
                      </div>
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(project.distributionStatus || 'pending-release')}`}>
                        {(project.distributionStatus || 'pending-release').replace('-', ' ')}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-4">{project.synopsis}</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Completion Date</p>
                        <p className="text-sm font-medium">{new Date(project.completionDate || '').toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-sm font-medium">{project.duration || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Market Performance</p>
                        <p className={`text-sm font-medium ${getPerformanceColor(project.marketPerformance || 'pending')}`}>
                          {project.marketPerformance || 'pending'}
                        </p>
                      </div>
                      {(project.rating || 0) > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Rating</p>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-500 mr-1" />
                            <span className="text-sm font-medium">{project.rating || 0}/10</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Awards */}
                    {(project.awards || []).length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Awards & Recognition</p>
                        <div className="flex flex-wrap gap-2">
                          {(project.awards || []).map((award, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                              <Award className="h-3 w-3 mr-1" />
                              {award}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial Performance */}
                  <div className="lg:w-80">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Financial Performance</h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Investment</span>
                          <span className="text-sm font-medium">{formatCurrency(project.investmentAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Returns</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(project.finalReturn || 0)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-3">
                          <span className="text-sm font-semibold">ROI</span>
                          <span className={`text-lg font-bold ${(project.roi || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(project.roi || 0) > 0 ? '+' : ''}{project.roi || 0}%
                          </span>
                        </div>
                      </div>

                      {(project.revenue?.total || 0) > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-semibold text-gray-900 mb-2">Revenue Breakdown</p>
                          <div className="space-y-2 text-xs">
                            {project.revenue?.boxOffice && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Box Office</span>
                                <span>{formatCurrency(project.revenue.boxOffice)}</span>
                              </div>
                            )}
                            {project.revenue?.streaming && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Streaming</span>
                                <span>{formatCurrency(project.revenue.streaming)}</span>
                              </div>
                            )}
                            {project.revenue?.international && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">International</span>
                                <span>{formatCurrency(project.revenue.international)}</span>
                              </div>
                            )}
                            {project.revenue?.merchandising && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Merchandising</span>
                                <span>{formatCurrency(project.revenue.merchandising)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold pt-2 border-t">
                              <span>Total Revenue</span>
                              <span>{formatCurrency(project.revenue?.total || 0)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <FileText className="h-3 w-3 mr-1" />
                          Report
                        </Button>
                        <Button size="sm" className="flex-1">
                          View Details
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No completed projects found</h3>
              <p className="text-gray-600">Try adjusting your filters or search criteria</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CompletedProjects;