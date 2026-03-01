import { useState, useEffect } from 'react';
import { GitBranch, ArrowRight, Clock, TrendingUp, DollarSign, Calendar, Users, Filter, BarChart3, CheckCircle, AlertCircle } from 'lucide-react';
import { ProductionService } from '../../services/production.service';

interface PipelineProject {
  id: string;
  title: string;
  genre: string;
  stage: 'development' | 'pre-production' | 'production' | 'post-production' | 'delivery' | 'release';
  budget: number;
  progress: number;
  team: number;
  director?: string;
  producer?: string;
  estimatedCompletion: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  risk: 'low' | 'medium' | 'high';
  daysInStage: number;
  nextMilestone: string;
  blockers: string[];
}

interface PipelineStats {
  totalProjects: number;
  totalBudget: number;
  averageProgress: number;
  projectsByStage: Record<string, number>;
  upcomingDeadlines: number;
  blockedProjects: number;
  onTrackProjects: number;
  behindSchedule: number;
}

const stageColors = {
  development: 'bg-blue-50 border-blue-200 text-blue-800',
  'pre-production': 'bg-purple-50 border-purple-200 text-purple-800',
  production: 'bg-green-50 border-green-200 text-green-800',
  'post-production': 'bg-orange-50 border-orange-200 text-orange-800',
  delivery: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  release: 'bg-emerald-50 border-emerald-200 text-emerald-800'
};

const priorityColors = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-orange-600 bg-orange-50',
  urgent: 'text-red-600 bg-red-50'
};

const riskColors = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-red-600'
};

const stageOrder = ['development', 'pre-production', 'production', 'post-production', 'delivery', 'release'];

export default function ProductionPipeline() {
  const [projects, setProjects] = useState<PipelineProject[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  useEffect(() => {
    fetchPipelineData();
  }, []);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      const data = await ProductionService.getProjects({ limit: 50 });
      const mapped: PipelineProject[] = (data.projects || []).map((p: any) => ({
        id: p.id?.toString() || '',
        title: p.title || 'Untitled',
        genre: p.genre || 'Unknown',
        stage: p.stage || 'development',
        budget: Number(p.budget_allocated || p.estimated_budget) || 0,
        progress: Number(p.completion_percentage) || 0,
        team: 0,
        director: p.director || undefined,
        producer: p.producer || undefined,
        estimatedCompletion: p.target_completion_date || new Date(Date.now() + 90 * 86400000).toISOString(),
        priority: p.priority || 'medium',
        risk: 'low',
        daysInStage: p.start_date ? Math.max(0, Math.floor((Date.now() - new Date(p.start_date).getTime()) / 86400000)) : 0,
        nextMilestone: p.next_milestone || 'No milestone set',
        blockers: []
      }));
      setProjects(mapped);

      // Compute stats from mapped projects
      const projectsByStage: Record<string, number> = {};
      for (const p of mapped) {
        projectsByStage[p.stage] = (projectsByStage[p.stage] || 0) + 1;
      }
      setStats({
        totalProjects: mapped.length,
        totalBudget: mapped.reduce((sum, p) => sum + p.budget, 0),
        averageProgress: mapped.length > 0 ? Math.round(mapped.reduce((sum, p) => sum + p.progress, 0) / mapped.length) : 0,
        projectsByStage,
        upcomingDeadlines: mapped.filter(p => {
          const days = Math.ceil((new Date(p.estimatedCompletion).getTime() - Date.now()) / 86400000);
          return days <= 14 && days > 0;
        }).length,
        blockedProjects: mapped.filter(p => p.blockers.length > 0).length,
        onTrackProjects: mapped.filter(p => p.progress >= 50).length,
        behindSchedule: mapped.filter(p => {
          const days = Math.ceil((new Date(p.estimatedCompletion).getTime() - Date.now()) / 86400000);
          return days <= 0;
        }).length,
      });
      setError(null);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Error fetching pipeline data:', e);
      setError(e.message);
      setProjects([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesStage = selectedStage === 'all' || project.stage === selectedStage;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    const matchesRisk = riskFilter === 'all' || project.risk === riskFilter;
    return matchesStage && matchesPriority && matchesRisk;
  });

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'from-green-500 to-emerald-500';
    if (progress >= 60) return 'from-blue-500 to-cyan-500';
    if (progress >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getDaysUntilCompletion = (completionDate: string) => {
    const today = new Date();
    const completion = new Date(completionDate);
    const diffTime = completion.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div>
                <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
              <button
                onClick={fetchPipelineData}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalProjects || 0}</p>
                <p className="text-sm text-gray-500">{stats?.averageProgress || 0}% avg progress</p>
              </div>
              <GitBranch className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${((stats?.totalBudget || 0) / 1000000).toFixed(1)}M
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">On Track</p>
                <p className="text-2xl font-bold text-green-600">{stats?.onTrackProjects || 0}</p>
                <p className="text-sm text-red-500">{stats?.behindSchedule || 0} behind</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Blocked Projects</p>
                <p className={`text-2xl font-bold ${(stats?.blockedProjects || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats?.blockedProjects || 0}
                </p>
                <p className="text-sm text-gray-500">{stats?.upcomingDeadlines || 0} deadlines</p>
              </div>
              <AlertCircle className={`w-8 h-8 ${(stats?.blockedProjects || 0) > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Pipeline Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stageOrder.map((stage, index) => (
              <div key={stage} className="relative">
                <div className={`p-4 rounded-lg border-2 text-center cursor-pointer transition ${
                  selectedStage === stage ? 'ring-2 ring-purple-500' : ''
                } ${stageColors[stage as keyof typeof stageColors]}`}
                onClick={() => setSelectedStage(selectedStage === stage ? 'all' : stage)}>
                  <div className="text-2xl font-bold">
                    {stats?.projectsByStage?.[stage] || 0}
                  </div>
                  <div className="text-sm font-medium capitalize">
                    {stage.replace('-', ' ')}
                  </div>
                </div>
                {index < stageOrder.length - 1 && (
                  <ArrowRight className="absolute top-1/2 -right-2 transform -translate-y-1/2 text-gray-400 w-4 h-4 hidden lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Stages</option>
              {stageOrder.map(stage => (
                <option key={stage} value={stage}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>

            {(selectedStage !== 'all' || priorityFilter !== 'all' || riskFilter !== 'all') && (
              <button
                onClick={() => {
                  setSelectedStage('all');
                  setPriorityFilter('all');
                  setRiskFilter('all');
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Projects List */}
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const daysUntilCompletion = getDaysUntilCompletion(project.estimatedCompletion);
            
            return (
              <div key={project.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${stageColors[project.stage]}`}>
                          {project.stage.replace('-', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[project.priority]}`}>
                          {project.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{project.genre} • Budget: ${(project.budget / 1000000).toFixed(1)}M</p>
                      <p className="text-sm text-gray-700 font-medium">Next: {project.nextMilestone}</p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{project.progress}%</div>
                      <div className={`text-sm ${daysUntilCompletion <= 7 ? 'text-red-600' : daysUntilCompletion <= 14 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {daysUntilCompletion > 0 ? `${daysUntilCompletion} days left` : 'Overdue'}
                      </div>
                      <div className={`text-sm ${riskColors[project.risk]}`}>
                        {project.risk} risk
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`bg-gradient-to-r ${getProgressColor(project.progress)} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{project.team} team members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{project.daysInStage} days in stage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Due {new Date(project.estimatedCompletion).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Team */}
                  {(project.director || project.producer) && (
                    <div className="flex gap-4 mb-4 text-sm">
                      {project.director && (
                        <span className="text-gray-600">
                          Director: <span className="font-medium text-gray-900">{project.director}</span>
                        </span>
                      )}
                      {project.producer && (
                        <span className="text-gray-600">
                          Producer: <span className="font-medium text-gray-900">{project.producer}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Blockers */}
                  {project.blockers.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">Blockers:</span>
                      </div>
                      <ul className="text-sm text-red-600 space-y-1">
                        {project.blockers.map((blocker, index) => (
                          <li key={index}>• {blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                      View Details
                    </button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No projects found</p>
            <p className="text-sm text-gray-400">
              {selectedStage !== 'all' || priorityFilter !== 'all' || riskFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Projects will appear in the pipeline as they are created'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}