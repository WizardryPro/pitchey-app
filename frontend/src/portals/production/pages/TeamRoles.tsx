import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Edit2, Save, Plus, Trash2, ArrowLeft,
  CheckCircle, XCircle, Eye, EyeOff, Lock, Unlock,
  Settings, UserCheck, AlertCircle, Crown, Star, Info
} from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { TeamService } from '@/services/team.service';
import { useCurrentTeam } from '@/shared/hooks/useCurrentTeam';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'project' | 'team' | 'finance' | 'content' | 'admin';
  level: 'low' | 'medium' | 'high' | 'critical';
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  memberCount: number;
  isDefault: boolean;
  isSystemRole: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  isActive: boolean;
}

const defaultPermissions: Permission[] = [
  // Project permissions
  { id: 'view_projects', name: 'View Projects', description: 'Can view project details and status', category: 'project', level: 'low' },
  { id: 'edit_projects', name: 'Edit Projects', description: 'Can edit project information and settings', category: 'project', level: 'medium' },
  { id: 'create_projects', name: 'Create Projects', description: 'Can create new projects', category: 'project', level: 'medium' },
  { id: 'delete_projects', name: 'Delete Projects', description: 'Can delete projects', category: 'project', level: 'critical' },
  { id: 'manage_timeline', name: 'Manage Timeline', description: 'Can modify project timelines and milestones', category: 'project', level: 'medium' },
  
  // Team permissions
  { id: 'view_team', name: 'View Team', description: 'Can view team members and their roles', category: 'team', level: 'low' },
  { id: 'invite_members', name: 'Invite Members', description: 'Can invite new team members', category: 'team', level: 'medium' },
  { id: 'manage_members', name: 'Manage Members', description: 'Can edit team member information and roles', category: 'team', level: 'high' },
  { id: 'remove_members', name: 'Remove Members', description: 'Can remove team members', category: 'team', level: 'high' },
  
  // Finance permissions
  { id: 'view_budgets', name: 'View Budgets', description: 'Can view project budgets and financial data', category: 'finance', level: 'low' },
  { id: 'edit_budgets', name: 'Edit Budgets', description: 'Can modify budget allocations', category: 'finance', level: 'high' },
  { id: 'approve_expenses', name: 'Approve Expenses', description: 'Can approve expense requests', category: 'finance', level: 'high' },
  { id: 'view_financial_reports', name: 'View Financial Reports', description: 'Can access detailed financial reports', category: 'finance', level: 'medium' },
  
  // Content permissions
  { id: 'view_content', name: 'View Content', description: 'Can view project content and assets', category: 'content', level: 'low' },
  { id: 'edit_content', name: 'Edit Content', description: 'Can modify project content', category: 'content', level: 'medium' },
  { id: 'approve_content', name: 'Approve Content', description: 'Can approve content for publication', category: 'content', level: 'high' },
  { id: 'manage_assets', name: 'Manage Assets', description: 'Can upload and organize project assets', category: 'content', level: 'medium' },
  
  // Admin permissions
  { id: 'admin_access', name: 'Admin Access', description: 'Full administrative access to all features', category: 'admin', level: 'critical' },
  { id: 'manage_roles', name: 'Manage Roles', description: 'Can create and modify user roles', category: 'admin', level: 'critical' },
  { id: 'system_settings', name: 'System Settings', description: 'Can modify system-wide settings', category: 'admin', level: 'critical' },
  { id: 'view_audit_logs', name: 'View Audit Logs', description: 'Can access system audit logs', category: 'admin', level: 'medium' }
];

export default function TeamRoles() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  const { teamId } = useCurrentTeam();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions] = useState<Permission[]>(defaultPermissions);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (teamId) fetchRolesAndMembers();
  }, [teamId]);

  const roleNameMap: Record<string, string> = {
    owner: 'Owner',
    editor: 'Editor',
    viewer: 'Viewer',
    admin: 'Admin',
    member: 'Team Member',
    collaborator: 'Collaborator',
  };

  const fetchRolesAndMembers = async () => {
    if (!teamId) return;
    try {
      setLoading(true);
      setError('');

      const [apiRoles, members] = await Promise.all([
        TeamService.getTeamRoles(teamId),
        TeamService.getTeamMembers(teamId),
      ]);

      // Map members to local TeamMember shape
      const mappedMembers: TeamMember[] = members.map(m => ({
        id: String(m.userId || m.id),
        name: m.name || (m.email ? m.email.split('@')[0] : 'Unknown'),
        email: m.email || '',
        role: roleNameMap[m.role] || m.role,
        isActive: m.status === 'active',
      }));
      setTeamMembers(mappedMembers);

      // Build roles with real member counts
      const roleCounts: Record<string, number> = {};
      for (const m of members) {
        const displayName = roleNameMap[m.role] || m.role;
        roleCounts[displayName] = (roleCounts[displayName] || 0) + 1;
      }

      // Map API roles to local Role shape, using default permission sets
      const rolePermissionMap: Record<string, string[]> = {
        Owner: defaultPermissions.map(p => p.id),
        Admin: defaultPermissions.filter(p => p.level !== 'critical' || p.id === 'admin_access').map(p => p.id),
        Editor: ['view_projects', 'edit_projects', 'create_projects', 'manage_timeline', 'view_team', 'invite_members', 'view_budgets', 'view_content', 'edit_content', 'manage_assets'],
        'Team Member': ['view_projects', 'view_team', 'view_content', 'edit_content', 'manage_assets'],
        Collaborator: ['view_projects', 'view_content'],
        Viewer: ['view_projects', 'view_team', 'view_content'],
      };

      const mappedRoles: Role[] = apiRoles.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        permissions: rolePermissionMap[r.name] || ['view_projects', 'view_content'],
        memberCount: roleCounts[r.name] || r.memberCount || 0,
        isDefault: r.isDefault,
        isSystemRole: r.name === 'Owner',
        color: r.name === 'Owner' ? 'purple' : r.name === 'Editor' ? 'blue' : r.name === 'Admin' ? 'green' : 'gray',
        createdAt: r.createdAt,
        updatedAt: r.createdAt,
      }));

      setRoles(mappedRoles);
    } catch (err: any) {
      console.error('Failed to fetch roles and members:', err);
      setError('Failed to load roles and team members');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async (roleData: Partial<Role>) => {
    if (!teamId) return;
    try {
      // Optimistic update
      const optimisticRole: Role = {
        id: roleData.id || `temp_${Date.now()}`,
        name: roleData.name || 'New Role',
        description: roleData.description || '',
        permissions: roleData.permissions || [],
        memberCount: roleData.memberCount || 0,
        isDefault: false,
        isSystemRole: false,
        color: roleData.color || 'gray',
        createdAt: roleData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (roleData.id && !roleData.id.startsWith('new_') && !roleData.id.startsWith('temp_')) {
        setRoles(prev => prev.map(r => r.id === roleData.id ? { ...r, ...roleData } as Role : r));
      } else {
        setRoles(prev => [...prev, optimisticRole]);
      }

      const saved = await TeamService.saveTeamRole(teamId, {
        id: roleData.id?.startsWith('new_') || roleData.id?.startsWith('temp_') ? undefined : roleData.id,
        name: roleData.name || 'New Role',
        description: roleData.description || '',
      });

      // Replace optimistic with real
      if (!roleData.id || roleData.id.startsWith('new_') || roleData.id.startsWith('temp_')) {
        setRoles(prev => prev.map(r => r.id === optimisticRole.id ? { ...optimisticRole, id: saved.id } : r));
      }

      setSuccessMessage('Role saved successfully.');
      setEditingRole(null);
      setShowCreateRole(false);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to save role:', e);
      setError('Failed to save role: ' + e.message);
      // Rollback
      fetchRolesAndMembers();
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!teamId) return;
    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    const previousRoles = [...roles];
    try {
      setRoles(prev => prev.filter(role => role.id !== roleId));
      await TeamService.deleteTeamRole(teamId, roleId);
      setSuccessMessage('Role deleted successfully.');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to delete role:', e);
      setError('Failed to delete role: ' + e.message);
      setRoles(previousRoles);
    }
  };

  const getPermissionsByCategory = (category: string) => {
    return permissions.filter(p => category === 'all' || p.category === category);
  };

  const getPermissionLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRoleIcon = (role: Role) => {
    if (role.isSystemRole) return Crown;
    if (role.name.toLowerCase().includes('producer')) return Star;
    if (role.name.toLowerCase().includes('director')) return Eye;
    return UserCheck;
  };

  const RoleEditor = ({ role, isNew = false }: { role: Role | null, isNew?: boolean }) => {
    const [formData, setFormData] = useState({
      name: role?.name || '',
      description: role?.description || '',
      permissions: role?.permissions || [],
      color: role?.color || 'blue'
    });

    const handlePermissionToggle = (permissionId: string) => {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.includes(permissionId)
          ? prev.permissions.filter(p => p !== permissionId)
          : [...prev.permissions, permissionId]
      }));
    };

    const handleSubmit = () => {
      if (!formData.name.trim()) {
        setError('Role name is required');
        return;
      }
      handleSaveRole({
        ...role,
        ...formData,
        id: role?.id || `new_${Date.now()}`
      });
    };

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            {isNew ? 'Create New Role' : `Edit ${role?.name}`}
          </h3>
          <button
            onClick={() => {
              setEditingRole(null);
              setShowCreateRole(false);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Enter role name"
              disabled={role?.isSystemRole}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Theme
            </label>
            <select
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="purple">Purple</option>
              <option value="red">Red</option>
              <option value="yellow">Yellow</option>
              <option value="gray">Gray</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            rows={3}
            placeholder="Describe this role's responsibilities"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Permissions
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              <option value="project">Project</option>
              <option value="team">Team</option>
              <option value="finance">Finance</option>
              <option value="content">Content</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-3">
              {getPermissionsByCategory(selectedCategory).map(permission => (
                <div key={permission.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(permission.id)}
                    onChange={() => handlePermissionToggle(permission.id)}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded mt-1"
                    disabled={role?.isSystemRole}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{permission.name}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionLevelColor(permission.level)}`}>
                        {permission.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{permission.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setEditingRole(null);
              setShowCreateRole(false);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isNew ? 'Create Role' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/production/team')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Team Management
          </button>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-blue-800 text-sm">
            Manage your team roles and permissions. Member counts reflect real team data.
          </p>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Roles & Permissions</h1>
            <p className="text-gray-600">Manage team roles and control access permissions</p>
          </div>
          <button
            onClick={() => setShowCreateRole(true)}
            className="mt-4 md:mt-0 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Role
          </button>
        </div>

        {/* Role Editor */}
        {(editingRole || showCreateRole) && (
          <div className="mb-8">
            <RoleEditor role={editingRole} isNew={showCreateRole} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {roles.map((role) => {
              const RoleIcon = getRoleIcon(role);
              const rolePermissions = permissions.filter(p => role.permissions.includes(p.id));
              const criticalPermissions = rolePermissions.filter(p => p.level === 'critical').length;

              return (
                <div key={role.id} className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-${role.color}-500 rounded-lg flex items-center justify-center`}>
                        <RoleIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">{role.name}</h3>
                          {role.isSystemRole && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                              System
                            </span>
                          )}
                          {role.isDefault && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingRole(role)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        disabled={role.isSystemRole}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!role.isSystemRole && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{role.memberCount}</div>
                      <div className="text-xs text-gray-600">Members</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{rolePermissions.length}</div>
                      <div className="text-xs text-gray-600">Permissions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{criticalPermissions}</div>
                      <div className="text-xs text-gray-600">Critical</div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Key Permissions:</h4>
                    <div className="flex flex-wrap gap-1">
                      {rolePermissions.slice(0, 6).map(permission => (
                        <span
                          key={permission.id}
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionLevelColor(permission.level)}`}
                        >
                          {permission.name}
                        </span>
                      ))}
                      {rolePermissions.length > 6 && (
                        <span className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-full">
                          +{rolePermissions.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Team members with this role */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Team Members:</h4>
                    <div className="flex flex-wrap gap-2">
                      {teamMembers
                        .filter(member => member.role === role.name)
                        .slice(0, 3)
                        .map(member => (
                          <div key={member.id} className="flex items-center gap-2 text-sm">
                            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-gray-700">{member.name}</span>
                          </div>
                        ))}
                      {teamMembers.filter(member => member.role === role.name).length > 3 && (
                        <span className="text-sm text-gray-500">
                          +{teamMembers.filter(member => member.role === role.name).length - 3} more
                        </span>
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