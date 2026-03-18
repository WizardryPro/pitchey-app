import { useState, useEffect, useCallback } from 'react';
import { Film, AlertCircle, TrendingUp, DollarSign, Plus, MoreVertical, Eye, Edit, Trash2, ArrowRight, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import StartProjectModal from '../components/StartProjectModal';

// Menu state for three-dot dropdown
type MenuState = number | null;

interface PipelineProject {
  id: number;
  title: string;
  stage: string;
  status: string;
  priority: string;
  budget_allocated: number;
  budget_spent: number;
  budget_remaining: number;
  completion_percentage: number;
  start_date: string | null;
  target_completion_date: string | null;
  next_milestone: string | null;
  milestone_date: string | null;
  pitch_id: number | null;
  genre: string | null;
  format: string | null;
  logline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STAGE_ORDER = ['development', 'pre-production', 'production', 'post-production', 'delivery', 'release'] as const;

function getNextStage(current: string): string | null {
  const idx = STAGE_ORDER.indexOf(current as typeof STAGE_ORDER[number]);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function formatStageName(stage: string): string {
  return stage.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

const stageColors: Record<string, string> = {
  development: 'bg-blue-100 text-blue-800',
  'pre-production': 'bg-indigo-100 text-indigo-800',
  production: 'bg-purple-100 text-purple-800',
  'post-production': 'bg-orange-100 text-orange-800',
  delivery: 'bg-teal-100 text-teal-800',
  release: 'bg-green-100 text-green-800',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

function formatBudget(amount: number): string {
  if (!amount || amount === 0) return 'TBD';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Not set' : d.toLocaleDateString();
}

export default function ProductionProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PipelineProject[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<MenuState>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ projects: PipelineProject[] }>('/api/production/projects');
      if (response.success) {
        setProjects(response.data?.projects || []);
      } else {
        setProjects([]);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load projects:', e);
      setError('Failed to load projects. Please try again.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleAdvanceStage = async (projectId: number, currentStage: string) => {
    const next = getNextStage(currentStage);
    if (!next) return;
    if (!window.confirm(`Move project to ${formatStageName(next)}?`)) return;
    try {
      await apiClient.put(`/api/production/projects/${projectId}`, { stage: next });
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, stage: next } : p
      ));
      toast.success(`Moved to ${formatStageName(next)}`);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to advance stage');
    }
  };

  const handleArchiveProject = async (projectId: number) => {
    if (!window.confirm('Archive this project?')) return;
    try {
      await apiClient.put(`/api/production/projects/${projectId}`, { status: 'cancelled' });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success('Project archived');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to archive project');
    }
  };

  const filteredProjects = filter === 'all'
    ? projects
    : projects.filter(p => p.stage === filter);

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    budget: projects.reduce((sum, p) => sum + (Number(p.budget_allocated) || 0), 0),
    avgProgress: projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / projects.length)
      : 0,
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Projects</h1>
            <p className="text-gray-600 mt-1">Manage your production pipeline</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
              <button onClick={() => void loadProjects()} className="ml-auto text-red-600 hover:text-red-800 font-medium">Retry</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Film className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">{formatBudget(stats.budget)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgProgress}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
              {['all', 'development', 'pre-production', 'production', 'post-production', 'delivery', 'release'].map((stage) => (
                <button
                  key={stage}
                  onClick={() => setFilter(stage)}
                  className={`py-3 px-6 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
                    filter === stage
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {stage === 'all' ? 'All' : stage.replace('-', ' ')}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <Film className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {projects.length === 0 ? 'No projects yet' : 'No projects in this stage'}
            </h3>
            <p className="text-gray-500 mb-6">
              {projects.length === 0
                ? 'Create your first production project to start tracking progress'
                : 'Move projects through stages as they progress'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-5 h-5" />
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                      {project.genre && <p className="text-sm text-gray-600">{project.genre}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageColors[project.stage] || 'bg-gray-100 text-gray-800'}`}>
                        {project.stage.replace('-', ' ')}
                      </span>
                      <span className={`text-xs font-medium ${priorityColors[project.priority] || 'text-gray-600'}`}>
                        {project.priority}
                      </span>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        {openMenuId === project.id && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-40">
                            {project.pitch_id && (
                              <button
                                onClick={() => { navigate(`/production/pitch/${project.pitch_id}`); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                View Pitch
                              </button>
                            )}
                            <button
                              onClick={() => { navigate(`/production/pitch/${project.pitch_id || project.id}`); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => { void handleArchiveProject(project.id); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Archive
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{project.completion_percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.completion_percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Budget</p>
                      <p className="font-semibold">{formatBudget(Number(project.budget_allocated))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Spent</p>
                      <p className="font-semibold">{formatBudget(Number(project.budget_spent))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Start Date</p>
                      <p className="font-semibold">{formatDate(project.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Target</p>
                      <p className="font-semibold">{formatDate(project.target_completion_date)}</p>
                    </div>
                  </div>

                  {/* Next Milestone */}
                  {project.next_milestone && (
                    <div className="border-t pt-3 mb-4">
                      <p className="text-sm text-gray-600">
                        Next: <span className="font-medium text-gray-900">{project.next_milestone}</span>
                        {project.milestone_date && (
                          <span className="text-gray-500"> — {formatDate(project.milestone_date as string)}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Linked Pitch */}
                  {project.pitch_id && (
                    <div className="border-t pt-3 mb-4">
                      <button
                        onClick={() => navigate(`/production/pitch/${project.pitch_id}`)}
                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        <Film className="w-3.5 h-3.5" />
                        View original pitch
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {project.pitch_id && (
                      <button
                        onClick={() => navigate(`/production/pitch/${project.pitch_id}`)}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Pitch
                      </button>
                    )}
                    {getNextStage(project.stage) && (
                      <button
                        onClick={() => void handleAdvanceStage(project.id, project.stage)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Move to {formatStageName(getNextStage(project.stage)!)}
                      </button>
                    )}
                    {project.stage === 'release' && (
                      <span className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                        Released
                      </span>
                    )}
                    <button
                      onClick={() => void handleArchiveProject(project.id)}
                      className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Archive project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal — with pitch picker */}
      {showCreateModal && (
        <StartProjectModal
          showPicker
          onClose={() => setShowCreateModal(false)}
          onCreated={() => void loadProjects()}
        />
      )}
    </div>
  );
}
