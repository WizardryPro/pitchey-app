import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Scissors, Music, Palette, Clock, TrendingUp, DollarSign, Calendar, Users, MoreVertical, Eye, Download, CheckCircle, AlertCircle, Edit, Archive } from 'lucide-react';
import { config, API_URL } from '@/config';

interface Project {
  id: string;
  title: string;
  genre: string;
  status: 'editing' | 'color-correction' | 'sound-design' | 'vfx' | 'final-mix' | 'deliverables';
  budget: number;
  wrapDate: string;
  expectedDelivery: string;
  progress: number;
  team: number;
  director?: string;
  producer?: string;
  editor?: string;
  colorist?: string;
  soundDesigner?: string;
  phase: 'rough-cut' | 'fine-cut' | 'picture-lock' | 'final-mix' | 'delivery';
  editingProgress: number;
  colorProgress: number;
  soundProgress: number;
  vfxProgress: number;
  totalRuntime: number; // in minutes
  deliveryFormat: string[];
  clientApprovals: {
    roughCut: boolean;
    fineCut: boolean;
    colorCorrection: boolean;
    soundMix: boolean;
    finalDelivery: boolean;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  budget_spent: number;
  daysInPost: number;
  pitch_id?: number | null;
}

const statusColors = {
  editing: 'bg-blue-100 text-blue-800 border-blue-200',
  'color-correction': 'bg-purple-100 text-purple-800 border-purple-200',
  'sound-design': 'bg-green-100 text-green-800 border-green-200',
  vfx: 'bg-orange-100 text-orange-800 border-orange-200',
  'final-mix': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  deliverables: 'bg-emerald-100 text-emerald-800 border-emerald-200'
};

const phaseColors = {
  'rough-cut': 'bg-yellow-100 text-yellow-700',
  'fine-cut': 'bg-blue-100 text-blue-700',
  'picture-lock': 'bg-purple-100 text-purple-700',
  'final-mix': 'bg-green-100 text-green-700',
  delivery: 'bg-emerald-100 text-emerald-700'
};

const priorityColors = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-orange-600 bg-orange-50',
  urgent: 'text-red-600 bg-red-50'
};

export default function ProductionProjectsPost() {
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
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    fetchPostProductionProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, statusFilter, phaseFilter, priorityFilter]);

  const fetchPostProductionProjects = async () => {
    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/production/projects?stage=post-production`, {
      method: 'GET',
      credentials: 'include'
    });

      if (!response.ok) {
        throw new Error(`Failed to fetch post-production projects: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.data?.projects || data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching post-production projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load post-production projects');
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    const filtered = projects.filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesPhase = phaseFilter === 'all' || project.phase === phaseFilter;
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;

      return matchesStatus && matchesPhase && matchesPriority;
    });

    setFilteredProjects(filtered);
  };

  const stats = {
    total: projects.length,
    editing: projects.filter(p => p.status === 'editing').length,
    colorCorrection: projects.filter(p => p.status === 'color-correction').length,
    finalMix: projects.filter(p => p.status === 'final-mix').length,
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    totalSpent: projects.reduce((sum, p) => sum + p.budget_spent, 0),
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
    urgent: projects.filter(p => p.priority === 'urgent').length
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'from-emerald-500 to-green-500';
    if (progress >= 70) return 'from-blue-500 to-cyan-500';
    if (progress >= 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getApprovalCount = (approvals: any) => {
    return Object.values(approvals).filter(Boolean).length;
  };

  const getDaysUntilDelivery = (deliveryDate: string) => {
    const today = new Date();
    const delivery = new Date(deliveryDate);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Post-Production</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Scissors className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Editing</p>
                <p className="text-2xl font-bold text-blue-600">{stats.editing}</p>
              </div>
              <Film className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgProgress}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Urgent Deliveries</p>
                <p className={`text-2xl font-bold ${stats.urgent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.urgent}
                </p>
              </div>
              <Clock className={`w-8 h-8 ${stats.urgent > 0 ? 'text-red-600' : 'text-green-600'}`} />
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
              <option value="editing">Editing</option>
              <option value="color-correction">Color Correction</option>
              <option value="sound-design">Sound Design</option>
              <option value="vfx">VFX</option>
              <option value="final-mix">Final Mix</option>
              <option value="deliverables">Deliverables</option>
            </select>

            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              <option value="all">All Phases</option>
              <option value="rough-cut">Rough Cut</option>
              <option value="fine-cut">Fine Cut</option>
              <option value="picture-lock">Picture Lock</option>
              <option value="final-mix">Final Mix</option>
              <option value="delivery">Delivery</option>
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
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">Error: {error}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => {
              const daysUntilDelivery = getDaysUntilDelivery(project.expectedDelivery);
              const approvalCount = getApprovalCount(project.clientApprovals);
              
              return (
                <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h3>
                        <p className="text-sm text-gray-600">{project.genre} • {project.totalRuntime} min</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[project.status]}`}>
                          {project.status.replace('-', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${phaseColors[project.phase]}`}>
                          {project.phase.replace('-', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[project.priority]}`}>
                          {project.priority.toUpperCase()}
                        </span>
                        <div className="relative" ref={openMenuId === project.id ? menuRef : undefined}>
                          <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}>
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {openMenuId === project.id && (
                            <div className="absolute right-0 top-8 z-10 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                              <button onClick={() => { navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Eye className="w-4 h-4" />View Details</button>
                              <button onClick={() => { navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Edit className="w-4 h-4" />Edit</button>
                              <button onClick={() => { navigate('/production/projects'); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Archive className="w-4 h-4" />Archive</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Overall Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Overall Progress</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`bg-gradient-to-r ${getProgressColor(project.progress)} h-2.5 rounded-full transition-all duration-300`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Department Progress */}
                    <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">Edit</span>
                          <span>{project.editingProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${project.editingProgress}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">Color</span>
                          <span>{project.colorProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${project.colorProgress}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">Sound</span>
                          <span>{project.soundProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${project.soundProgress}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-600">VFX</span>
                          <span>{project.vfxProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${project.vfxProgress}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Project Details */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-600">Delivery</p>
                        <p className={`font-semibold ${daysUntilDelivery <= 7 ? 'text-red-600' : daysUntilDelivery <= 14 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {daysUntilDelivery > 0 ? `${daysUntilDelivery} days` : 'Overdue'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Approvals</p>
                        <p className="font-semibold">{approvalCount}/5</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Days in Post</p>
                        <p className="font-semibold">{project.daysInPost} days</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Budget Used</p>
                        <p className="font-semibold">{((project.budget_spent / project.budget) * 100).toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Team Info */}
                    <div className="border-t pt-4 mb-4 text-sm">
                      {project.editor && (
                        <p className="text-gray-600 mb-1">
                          Editor: <span className="font-medium text-gray-900">{project.editor}</span>
                        </p>
                      )}
                      {project.colorist && (
                        <p className="text-gray-600 mb-1">
                          Colorist: <span className="font-medium text-gray-900">{project.colorist}</span>
                        </p>
                      )}
                      {project.soundDesigner && (
                        <p className="text-gray-600">
                          Sound: <span className="font-medium text-gray-900">{project.soundDesigner}</span>
                        </p>
                      )}
                    </div>

                    {/* Delivery Formats */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Delivery Formats:</p>
                      <div className="flex flex-wrap gap-1">
                        {project.deliveryFormat.map((format, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {format}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      <button
                        onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                        className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Dailies
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredProjects.length === 0 && !loading && (
          <div className="text-center py-12">
            <Scissors className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No post-production projects found</p>
            <p className="text-sm text-gray-400">
              Projects will appear here when they enter post-production phase
            </p>
          </div>
        )}
      </div>
    </div>
  );
}