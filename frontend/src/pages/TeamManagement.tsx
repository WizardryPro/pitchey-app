import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Mail, Calendar,
  CheckCircle, Clock, Briefcase, AlertCircle,
  RefreshCw, Trash2, Send, Search, Filter, X
} from 'lucide-react';
import { CollaboratorService, Collaborator } from '../services/collaborator.service';
import { toast } from 'react-hot-toast';
import InviteCollaboratorWithProjectPicker from '../portals/production/components/InviteCollaboratorWithProjectPicker';

const ROLE_LABELS: Record<string, string> = {
  director: 'Director',
  line_producer: 'Line Producer',
  dp: 'Director of Photography',
  production_designer: 'Production Designer',
  editor: 'Editor',
  sound_designer: 'Sound Designer',
  custom: 'Custom',
};

export default function TeamManagement() {
  const navigate = useNavigate();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, projects: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await CollaboratorService.getAllTeamCollaborators();
      if (response.success && response.data) {
        setCollaborators(response.data.collaborators);
        setStats(response.data.stats);
      } else {
        setError(response.error || 'Failed to load team data');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemove = async (collaborator: Collaborator) => {
    if (!collaborator.project_id) return;
    if (!confirm(`Remove ${collaborator.user?.name || collaborator.invited_email} from this project?`)) return;
    try {
      const response = await CollaboratorService.removeCollaborator(collaborator.project_id, collaborator.id);
      if (response.success) {
        toast.success('Collaborator removed');
        setCollaborators(prev => prev.filter(c => c.id !== collaborator.id));
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          active: collaborator.status === 'active' ? prev.active - 1 : prev.active,
          pending: collaborator.status === 'pending' ? prev.pending - 1 : prev.pending,
        }));
      } else {
        toast.error(response.error || 'Failed to remove');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    }
  };

  const handleResend = async (collaborator: Collaborator) => {
    if (!collaborator.project_id) return;
    try {
      const response = await CollaboratorService.resendInvite(collaborator.project_id, collaborator.id);
      if (response.success) {
        toast.success('Invitation resent');
      } else {
        toast.error(response.error || 'Failed to resend');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    }
  };

  // Derive unique project names for filter dropdown
  const projectNames = Array.from(new Set(collaborators.map(c => c.project_title).filter(Boolean))) as string[];

  const filtered = collaborators.filter(c => {
    const name = c.user?.name || c.invited_email;
    const email = c.user?.email || c.invited_email;
    const matchesSearch = !searchTerm ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesProject = filterProject === 'all' || c.project_title === filterProject;
    return matchesSearch && matchesStatus && matchesProject;
  });

  const getRoleLabel = (c: Collaborator) =>
    c.role === 'custom' ? (c.custom_role_name || 'Custom') : (ROLE_LABELS[c.role] || c.role);

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Management</h1>
            <p className="text-gray-600">Manage collaborators across your production projects</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Invite Collaborator
            </button>
            <button
              onClick={loadData}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
            <button onClick={loadData} className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Collaborators</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Projects</p>
                <p className="text-2xl font-bold text-blue-600">{stats.projects}</p>
              </div>
              <Briefcase className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </select>
            {projectNames.length > 1 && (
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
              >
                <option value="all">All Projects</option>
                {projectNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Collaborators Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name / Email</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invited</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {(c.user?.name || c.invited_email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{c.user?.name || c.invited_email.split('@')[0]}</p>
                            <p className="text-sm text-gray-500">{c.user?.email || c.invited_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{getRoleLabel(c)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{c.project_title || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'active' ? 'bg-green-100 text-green-800' :
                          c.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {c.invited_at ? new Date(c.invited_at).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'pending' && (
                            <button
                              onClick={() => handleResend(c)}
                              className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded transition"
                              title="Resend invitation"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(c)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                            title="Remove collaborator"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">
              {searchTerm || filterStatus !== 'all' || filterProject !== 'all'
                ? 'No collaborators match your filters'
                : 'No collaborators yet'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {searchTerm || filterStatus !== 'all' || filterProject !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Invite team members to your production projects'}
            </p>
            {!searchTerm && filterStatus === 'all' && filterProject === 'all' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <UserPlus className="w-4 h-4" />
                Invite Collaborator
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal with Project Picker */}
      {showInviteModal && (
        <InviteCollaboratorWithProjectPicker
          onClose={() => setShowInviteModal(false)}
          onInvited={loadData}
        />
      )}
    </div>
  );
}
