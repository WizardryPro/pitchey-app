import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, MoreVertical,
  Shield, Edit, Trash2, Clock, CheckCircle,
  XCircle, AlertCircle, Crown, Star, MessageSquare,
  Calendar, Activity, Settings, Globe, Lock
} from 'lucide-react';
import { TeamService, type TeamMember as ApiTeamMember } from '@/services/team.service';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'collaborator' | 'viewer';
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canDelete: boolean;
    canManageRoles: boolean;
  };
  status: 'active' | 'pending' | 'inactive';
  joinedDate: string;
  lastActive: string;
  invitedBy?: string;
  projects: string[];
  bio?: string;
  skills: string[];
  isPublic: boolean;
  contributionScore: number;
}

interface TeamFilters {
  role: 'all' | 'owner' | 'admin' | 'member' | 'collaborator' | 'viewer';
  status: 'all' | 'active' | 'pending' | 'inactive';
  permissions: 'all' | 'can-edit' | 'can-manage';
}

export default function CreatorTeamMembers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TeamFilters>({
    role: 'all',
    status: 'all',
    permissions: 'all'
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTeamMembers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [members, filters, searchQuery]);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      // Get teams first, then get members from the first/primary team
      const teams = await TeamService.getTeams();

      const primaryTeam = teams[0];
      if (primaryTeam) {
        setCurrentTeamId(primaryTeam.id);
        const apiMembers = await TeamService.getTeamMembers(primaryTeam.id);

        // Transform API response to match component's TeamMember interface
        const transformedMembers: TeamMember[] = apiMembers.map((m: ApiTeamMember) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          avatar: m.avatar,
          role: m.role,
          permissions: m.permissions,
          status: m.status,
          joinedDate: m.joinedDate,
          lastActive: m.lastActive,
          invitedBy: m.invitedBy,
          projects: m.projects || [],
          bio: m.bio,
          skills: m.skills || [],
          isPublic: m.isPublic ?? true,
          contributionScore: m.contributionScore ?? 0
        }));

        setMembers(transformedMembers);
      } else {
        // No teams yet - show empty state
        setMembers([]);
      }
    } catch (error) {
      console.error('Failed to load team members:', error);
      // On error, set empty members array instead of leaving stale data
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...members];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply role filter
    if (filters.role !== 'all') {
      filtered = filtered.filter(member => member.role === filters.role);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(member => member.status === filters.status);
    }

    // Apply permissions filter
    if (filters.permissions !== 'all') {
      if (filters.permissions === 'can-edit') {
        filtered = filtered.filter(member => member.permissions.canEdit);
      } else if (filters.permissions === 'can-manage') {
        filtered = filtered.filter(member => member.permissions.canManageRoles);
      }
    }

    setFilteredMembers(filtered);
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map(m => m.id));
    }
  };

  const handleBulkAction = async (action: 'remove' | 'change-role') => {
    if (selectedMembers.length === 0 || !currentTeamId) return;

    setError(null);
    try {
      if (action === 'remove') {
        // Remove each selected member
        await Promise.all(
          selectedMembers.map(memberId =>
            TeamService.removeMember(currentTeamId, memberId)
          )
        );
        // Refresh the member list
        await loadTeamMembers();
      }
      // For 'change-role', we would need a modal to select the new role
      // This can be implemented as a follow-up feature
      setSelectedMembers([]);
    } catch (err) {
      console.error('Bulk action failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to perform action');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown;
      case 'admin': return Shield;
      case 'member': return Users;
      case 'collaborator': return Star;
      case 'viewer': return Globe;
      default: return Users;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'member': return 'bg-blue-100 text-blue-800';
      case 'collaborator': return 'bg-purple-100 text-purple-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'pending': return Clock;
      case 'inactive': return XCircle;
      default: return AlertCircle;
    }
  };

  const formatLastActive = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage your creative team and collaborators
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button
              onClick={() => navigate('/creator/team/roles')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Roles
            </button>
            <button
              onClick={() => navigate('/creator/team/invite')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="collaborator">Collaborator</option>
                <option value="viewer">Viewer</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={filters.permissions}
                onChange={(e) => setFilters(prev => ({ ...prev, permissions: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Permissions</option>
                <option value="can-edit">Can Edit</option>
                <option value="can-manage">Can Manage</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedMembers.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 bg-purple-50 rounded-md">
              <span className="text-sm text-purple-700">
                {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('change-role')}
                  className="text-sm px-3 py-1 text-purple-600 hover:text-purple-700"
                >
                  Change Role
                </button>
                <button
                  onClick={() => handleBulkAction('remove')}
                  className="text-sm px-3 py-1 text-red-600 hover:text-red-700"
                >
                  Remove Selected
                </button>
                <button
                  onClick={() => setSelectedMembers([])}
                  className="text-sm px-3 py-1 text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredMembers.length} of {members.length} members
          </p>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
              onChange={handleSelectAll}
              className="mr-2 rounded border-gray-300"
            />
            Select all
          </label>
        </div>

        {/* Members Grid */}
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
            <p className="text-gray-600 mb-6">
              {members.length === 0 
                ? "Start building your team by inviting collaborators."
                : "No members match your current filters."
              }
            </p>
            <button
              onClick={() => navigate('/creator/team/invite')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite First Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMembers.map((member) => {
              const RoleIcon = getRoleIcon(member.role);
              const StatusIcon = getStatusIcon(member.status);
              
              return (
                <div key={member.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleSelectMember(member.id)}
                          className="mt-1 rounded border-gray-300"
                        />
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-lg font-semibold text-purple-600">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{member.name}</h3>
                          <p className="text-sm text-gray-600">{member.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {member.isPublic ? (
                          <Globe className="w-4 h-4 text-green-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="relative">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Role and Status */}
                    <div className="flex gap-2 mb-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {member.role}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {member.status}
                      </span>
                    </div>

                    {/* Bio */}
                    {member.bio && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {member.bio}
                      </p>
                    )}

                    {/* Skills */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.slice(0, 3).map((skill, index) => (
                          <span key={index} className="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                        {member.skills.length > 3 && (
                          <span className="text-xs text-gray-500">+{member.skills.length - 3} more</span>
                        )}
                      </div>
                    </div>

                    {/* Projects */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">Projects</p>
                      <div className="text-sm text-gray-600">
                        {member.projects.length > 0 ? (
                          <span>{member.projects.length} active project{member.projects.length > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-gray-400">No active projects</span>
                        )}
                      </div>
                    </div>

                    {/* Contribution Score */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">Contribution Score</span>
                        <span className="text-xs font-medium text-gray-900">{member.contributionScore}/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${member.contributionScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>Joined {new Date(member.joinedDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        <span>Last active {formatLastActive(member.lastActive)}</span>
                      </div>
                      {member.invitedBy && (
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-3 h-3" />
                          <span>Invited by {member.invitedBy}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <button
                        onClick={() => navigate(`/creator/messages?to=${encodeURIComponent(member.email)}`)}
                        className="flex-1 px-3 py-2 text-sm border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 mr-1 inline" />
                        Message
                      </button>
                      <button
                        onClick={() => navigate(`/creator/team/roles`)}
                        className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => {
                            if (currentTeamId && confirm(`Remove ${member.name} from team?`)) {
                              TeamService.removeMember(currentTeamId, member.id).then(() => {
                                setMembers(prev => prev.filter(m => m.id !== member.id));
                              }).catch(err => console.error('Failed to remove member:', err));
                            }
                          }}
                          className="px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}