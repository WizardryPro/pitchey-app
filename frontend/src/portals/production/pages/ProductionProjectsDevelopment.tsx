import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertTriangle, TrendingUp, DollarSign, Calendar, Users, MoreVertical, Eye, Edit, Trash2, PlusCircle, Filter, Search, Archive } from 'lucide-react';
import { config, API_URL } from '@/config';

interface Project {
  id: string;
  title: string;
  genre: string;
  status: 'development' | 'pre-production' | 'script-review' | 'financing' | 'casting' | 'planning';
  budget: number;
  estimatedStartDate: string;
  progress: number;
  team: number;
  director?: string;
  producer?: string;
  scriptwriter?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  phase: 'concept' | 'script' | 'planning' | 'pre-production';
  lastActivity: string;
  daysInDevelopment: number;
  pitch_id?: number | null;
}

const statusColors = {
  development: 'bg-blue-100 text-blue-800 border-blue-200',
  'pre-production': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'script-review': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  financing: 'bg-green-100 text-green-800 border-green-200',
  casting: 'bg-purple-100 text-purple-800 border-purple-200',
  planning: 'bg-orange-100 text-orange-800 border-orange-200'
};

const priorityColors = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-orange-600 bg-orange-50',
  urgent: 'text-red-600 bg-red-50'
};

const phaseColors = {
  concept: 'bg-gray-100 text-gray-700',
  script: 'bg-blue-100 text-blue-700',
  planning: 'bg-indigo-100 text-indigo-700',
  'pre-production': 'bg-purple-100 text-purple-700'
};

export default function ProductionProjectsDevelopment() {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  useEffect(() => {
    fetchDevelopmentProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, statusFilter, priorityFilter, phaseFilter]);

  const fetchDevelopmentProjects = async () => {
    try {
      setLoading(true);
    const response = await fetch(`${API_URL}/api/production/projects?stage=development`, {
      method: 'GET',
      credentials: 'include'
    });

      if (!response.ok) {
        throw new Error(`Failed to fetch development projects: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.data?.projects || data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching development projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load development projects');
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    const filtered = projects.filter(project => {
      const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.director?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.producer?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
      const matchesPhase = phaseFilter === 'all' || project.phase === phaseFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesPhase;
    });

    setFilteredProjects(filtered);
  };

  const stats = {
    total: projects.length,
    scriptReview: projects.filter(p => p.status === 'script-review').length,
    financing: projects.filter(p => p.status === 'financing').length,
    casting: projects.filter(p => p.status === 'casting').length,
    totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
    urgent: projects.filter(p => p.priority === 'urgent').length
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total in Development</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Script Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.scriptReview}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
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
                <p className="text-sm text-gray-600">Urgent Priority</p>
                <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search projects, genres, directors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
              >
                <option value="all">All Status</option>
                <option value="development">Development</option>
                <option value="script-review">Script Review</option>
                <option value="financing">Financing</option>
                <option value="casting">Casting</option>
                <option value="planning">Planning</option>
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
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
              >
                <option value="all">All Phases</option>
                <option value="concept">Concept</option>
                <option value="script">Script</option>
                <option value="planning">Planning</option>
                <option value="pre-production">Pre-Production</option>
              </select>
            </div>
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
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">Error: {error}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h3>
                      <p className="text-sm text-gray-600">{project.genre}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[project.status]}`}>
                        {project.status.replace('-', ' ')}
                      </span>
                      <div className="relative" ref={openMenuId === project.id ? menuRef : undefined}>
                        <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}>
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        {openMenuId === project.id && (
                          <div className="absolute right-0 top-8 z-10 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                            <button onClick={() => { navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Eye className="w-4 h-4" />View Details</button>
                            <button onClick={() => { navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Edit className="w-4 h-4" />Edit</button>
                            <button onClick={() => { navigate('/production/projects'); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" />Delete Draft</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Priority and Phase */}
                  <div className="flex gap-2 mb-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[project.priority]}`}>
                      {project.priority.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${phaseColors[project.phase]}`}>
                      {project.phase}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Development Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Budget</p>
                      <p className="font-semibold">${(project.budget / 1000000).toFixed(1)}M</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Team Size</p>
                      <p className="font-semibold">{project.team} members</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Est. Start</p>
                      <p className="font-semibold">{new Date(project.estimatedStartDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Days in Dev</p>
                      <p className="font-semibold">{project.daysInDevelopment} days</p>
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="border-t pt-4 mb-4">
                    {project.director && (
                      <p className="text-sm text-gray-600 mb-1">
                        Director: <span className="font-medium text-gray-900">{project.director}</span>
                      </p>
                    )}
                    {project.producer && (
                      <p className="text-sm text-gray-600 mb-1">
                        Producer: <span className="font-medium text-gray-900">{project.producer}</span>
                      </p>
                    )}
                    {project.scriptwriter && (
                      <p className="text-sm text-gray-600">
                        Writer: <span className="font-medium text-gray-900">{project.scriptwriter}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Last activity: {new Date(project.lastActivity).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                      className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No development projects found</p>
            <p className="text-sm text-gray-400">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || phaseFilter !== 'all'
                ? 'Try adjusting your search criteria'
                : 'Projects will appear here as they enter development stage'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}