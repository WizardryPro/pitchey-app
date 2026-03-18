import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Users, UserPlus, Search, Filter, MoreVertical,
  Edit2, Trash2, Mail, Phone, Calendar, Star,
  Briefcase, Shield, CheckCircle, XCircle, Clock,
  Eye, Download, Settings
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { TeamService } from '../../services/team.service';
import { CollaboratorService } from '../../services/collaborator.service';
import { ProductionService } from '@portals/production/services/production.service';
import { useCurrentTeam } from '@/shared/hooks/useCurrentTeam';
import { Permission } from '@features/auth/hooks/usePermissions';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department: string;
  joinDate: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
  avatar?: string;
  projects: number;
  rating: number;
  permissions: string[];
  location?: string;
  skills: string[];
  reportsTo?: string;
}

interface FilterOptions {
  department: string;
  role: string;
  status: string;
  skills: string;
}

const departments = ['Production', 'Development', 'Marketing', 'Finance', 'Creative', 'Technical'];
const roles = ['Producer', 'Director', 'Writer', 'Editor', 'Cinematographer', 'Sound Designer', 'VFX Artist'];
const statuses = ['active', 'inactive', 'pending'];

export default function TeamMembers() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  const { teamId } = useCurrentTeam();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'department' | 'joinDate' | 'rating'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<FilterOptions>({
    department: 'all',
    role: 'all',
    status: 'all',
    skills: 'all'
  });

  useEffect(() => {
    if (teamId) {
      fetchTeamMembers();
    } else {
      // No formal team — load collaborators from projects instead
      fetchCollaborators();
    }
  }, [teamId]);

  const fetchCollaborators = async () => {
    try {
      setLoading(true);
      // Get production projects to find collaborators
      const projectsData = await ProductionService.getProjects({ limit: 50 });
      const projects = projectsData.projects || [];

      // Fetch collaborators from each project
      const allCollaborators: TeamMember[] = [];
      const seenIds = new Set<string>();

      for (const project of projects.slice(0, 10)) {
        try {
          const res = await CollaboratorService.listCollaborators(project.id);
          const collaborators = (res as any)?.data?.collaborators || (res as any)?.collaborators || [];
          for (const c of collaborators) {
            const id = String(c.id || c.user_id || c.userId);
            if (!seenIds.has(id)) {
              seenIds.add(id);
              allCollaborators.push({
                id,
                name: c.name || c.email?.split('@')[0] || 'Collaborator',
                email: c.email || '',
                role: c.role || c.access_level || 'viewer',
                department: 'Collaborator',
                joinDate: c.invited_at || c.created_at || new Date().toISOString(),
                lastActive: c.last_active || new Date().toISOString(),
                status: c.status === 'accepted' ? 'active' : c.status === 'pending' ? 'pending' : 'active',
                projects: 1,
                rating: 0,
                permissions: derivePermissions(c.role || 'viewer'),
                skills: [],
              });
            }
          }
        } catch {
          // Skip projects with no collaborator access
        }
      }

      setTeamMembers(allCollaborators);
    } catch (err) {
      console.error('Failed to fetch collaborators:', err);
    } finally {
      setLoading(false);
    }
  };

  const derivePermissions = (role: string): string[] => {
    // Map team roles to backend RBAC permissions for consistency
    switch (role) {
      case 'owner': return [
        Permission.PRODUCTION_CREATE_PROJECT,
        Permission.PRODUCTION_MANAGE_CREW,
        Permission.PRODUCTION_SCHEDULE,
        Permission.PRODUCTION_BUDGET,
        Permission.PITCH_EDIT_OWN,
        Permission.PITCH_DELETE_OWN,
      ];
      case 'editor': return [
        Permission.PRODUCTION_CREATE_PROJECT,
        Permission.PRODUCTION_SCHEDULE,
        Permission.PITCH_EDIT_OWN,
        Permission.DOCUMENT_UPLOAD,
      ];
      case 'viewer': return [
        Permission.PITCH_VIEW_PUBLIC,
        Permission.DOCUMENT_VIEW_PUBLIC,
      ];
      default: return [Permission.PITCH_VIEW_PUBLIC];
    }
  };

  const fetchTeamMembers = async () => {
    if (!teamId) return;
    try {
      setLoading(true);

      const members = await TeamService.getTeamMembers(teamId);

      const mapped: TeamMember[] = members.map(m => ({
        id: String(m.userId || m.id),
        name: m.name || (m.email ? m.email.split('@')[0] : 'Unknown'),
        email: m.email || '',
        role: m.role || 'viewer',
        department: 'Not specified',
        joinDate: m.joinedDate || (m as any).joinedAt || new Date().toISOString(),
        lastActive: m.lastActive || new Date().toISOString(),
        status: m.status || 'active',
        projects: 0,
        rating: 0,
        permissions: derivePermissions(m.role),
        skills: m.skills || [],
      }));

      setTeamMembers(mapped);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!teamId || !confirm('Are you sure you want to remove this member?')) return;
    try {
      await TeamService.removeMember(teamId, memberId);
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (memberId: string) => {
    if (!teamId) return;
    const newRole = prompt('Enter new role (owner, editor, viewer):');
    if (!newRole || !['owner', 'editor', 'viewer'].includes(newRole)) return;
    try {
      await TeamService.updateMemberRole(teamId, memberId, newRole);
      await fetchTeamMembers();
    } catch (err: any) {
      console.error('Failed to update role:', err);
      alert(err.message || 'Failed to update role');
    }
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(
      selectedMembers.length === filteredMembers.length 
        ? [] 
        : filteredMembers.map(member => member.id)
    );
  };

  const filteredMembers = teamMembers
    .filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDepartment = filters.department === 'all' || member.department === filters.department;
      const matchesRole = filters.role === 'all' || member.role === filters.role;
      const matchesStatus = filters.status === 'all' || member.status === filters.status;
      
      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      const direction = sortOrder === 'asc' ? 1 : -1;
      
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * direction;
        case 'role':
          return a.role.localeCompare(b.role) * direction;
        case 'department':
          return a.department.localeCompare(b.department) * direction;
        case 'joinDate':
          return (new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()) * direction;
        case 'rating':
          return (a.rating - b.rating) * direction;
        default:
          return 0;
      }
    });

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'inactive': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <CheckCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Management</h1>
            <p className="text-gray-600">{filteredMembers.length} {teamId ? 'members in your team' : 'collaborators across your projects'}</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => navigate(`/${userType}/team/invite`)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </button>
            <button
              onClick={() => toast('Team export coming soon', { icon: 'ℹ️' })}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search members by name, email, role, or skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border border-gray-300 rounded-lg transition flex items-center gap-2 ${
                showFilters ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="all">All Roles</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="all">All Status</option>
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ department: 'all', role: 'all', status: 'all', skills: 'all' })}
                  className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedMembers.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="text-indigo-900">
              {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => toast('Bulk role update coming soon', { icon: 'ℹ️' })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Update Roles
              </button>
              <button
                onClick={() => toast('Bulk removal coming soon', { icon: 'ℹ️' })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Remove Members
              </button>
            </div>
          </div>
        )}

        {/* Members Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                      />
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('role')}
                    >
                      Role {sortBy === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('department')}
                    >
                      Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('rating')}
                    >
                      Rating {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleSelectMember(member.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{member.name}</div>
                            <div className="text-sm text-gray-600">{member.location}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{member.role}</div>
                        {member.reportsTo && (
                          <div className="text-xs text-gray-600">Reports to {member.reportsTo}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-50 text-purple-700">
                          {member.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {member.email}
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="w-4 h-4" />
                            {member.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(member.status)}
                          <span className={`text-sm ${
                            member.status === 'active' ? 'text-green-600' :
                            member.status === 'pending' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {member.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Last active {formatRelativeTime(member.lastActive)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-gray-900">{member.rating}</span>
                        </div>
                        <div className="text-xs text-gray-600">{member.projects} projects</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/team/member/${member.id}`)}
                            className="text-indigo-600 hover:text-indigo-500 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateRole(member.id)}
                            className="text-gray-600 hover:text-gray-500 transition"
                            title="Change role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-500 transition"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-500 transition">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredMembers.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium mb-2">
              {searchTerm || filters.department !== 'all' || filters.role !== 'all' || filters.status !== 'all'
                ? 'No team members match your filters'
                : 'No team members yet'}
            </p>
            <p className="text-gray-500 mb-4">
              {searchTerm || filters.department !== 'all' || filters.role !== 'all' || filters.status !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Invite collaborators to your projects or create a team to get started'}
            </p>
            <button
              onClick={() => navigate(`/${userType}/team/invite`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
}