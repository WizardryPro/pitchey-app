import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Crown, Users, Star, Globe, Edit, Trash2,
  Plus, Check, X, AlertCircle, Save,
  ChevronDown, ChevronUp, Eye, Copy, Settings
} from 'lucide-react';
import { TeamService, type TeamRole } from '@/services/team.service';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'team' | 'analytics' | 'settings';
  isAdvanced?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: any;
  permissions: string[];
  isDefault: boolean;
  isSystemRole: boolean;
  memberCount: number;
  createdDate: string;
  lastModified?: string;
}

interface RoleForm {
  name: string;
  description: string;
  color: string;
  permissions: string[];
  isDefault: boolean;
}

export default function CreatorTeamRoles() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['content']);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>({
    name: '',
    description: '',
    color: 'blue',
    permissions: [],
    isDefault: false
  });

  useEffect(() => {
    void loadData();
  }, []);

  // Helper to get role icon based on role name
  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'owner': return Crown;
      case 'admin':
      case 'administrator': return Shield;
      case 'member': return Users;
      case 'collaborator': return Star;
      case 'viewer': return Globe;
      default: return Users;
    }
  };

  // Helper to get role color based on role name
  const getRoleColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'owner': return 'yellow';
      case 'admin':
      case 'administrator': return 'red';
      case 'member': return 'blue';
      case 'collaborator': return 'purple';
      case 'viewer': return 'gray';
      default: return 'blue';
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Static permissions definition (these don't come from API)
      setPermissions([
        // Content permissions
        { id: 'view-content', name: 'View Content', description: 'View pitch content and projects', category: 'content' },
        { id: 'edit-content', name: 'Edit Content', description: 'Edit and modify pitch content', category: 'content' },
        { id: 'create-content', name: 'Create Content', description: 'Create new pitches and projects', category: 'content' },
        { id: 'delete-content', name: 'Delete Content', description: 'Delete pitches and projects', category: 'content', isAdvanced: true },
        { id: 'publish-content', name: 'Publish Content', description: 'Publish and make content live', category: 'content' },

        // Team permissions
        { id: 'view-team', name: 'View Team', description: 'View team members and roles', category: 'team' },
        { id: 'invite-members', name: 'Invite Members', description: 'Send team invitations', category: 'team' },
        { id: 'manage-members', name: 'Manage Members', description: 'Edit member roles and permissions', category: 'team', isAdvanced: true },
        { id: 'remove-members', name: 'Remove Members', description: 'Remove team members', category: 'team', isAdvanced: true },

        // Analytics permissions
        { id: 'view-analytics', name: 'View Analytics', description: 'Access performance metrics', category: 'analytics' },
        { id: 'export-analytics', name: 'Export Analytics', description: 'Download analytics reports', category: 'analytics' },

        // Settings permissions
        { id: 'manage-settings', name: 'Manage Settings', description: 'Modify team and project settings', category: 'settings', isAdvanced: true },
        { id: 'billing-access', name: 'Billing Access', description: 'View and manage billing', category: 'settings', isAdvanced: true },
        { id: 'transfer-ownership', name: 'Transfer Ownership', description: 'Transfer team ownership', category: 'settings', isAdvanced: true }
      ]);

      // Load teams first to get the primary team ID
      const teams = await TeamService.getTeams();
      const primaryTeam = teams[0];

      if (primaryTeam) {
        setCurrentTeamId(primaryTeam.id);

        // Load roles from API
        const apiRoles = await TeamService.getTeamRoles(primaryTeam.id);

        // Transform API roles to component's Role interface
        const transformedRoles: Role[] = apiRoles.map((role: TeamRole) => {
          // Convert permissions object to array of permission IDs
          const permissionIds: string[] = [];
          if (role.permissions.canEdit) permissionIds.push('edit-content', 'view-content');
          if (role.permissions.canInvite) permissionIds.push('invite-members');
          if (role.permissions.canDelete) permissionIds.push('delete-content', 'remove-members');
          if (role.permissions.canManageRoles) permissionIds.push('manage-members', 'manage-settings');
          if (role.permissions.canViewAnalytics) permissionIds.push('view-analytics');
          if (role.permissions.canManagePitches) permissionIds.push('create-content', 'publish-content');
          if (!permissionIds.includes('view-content')) permissionIds.push('view-content');
          if (!permissionIds.includes('view-team')) permissionIds.push('view-team');

          return {
            id: role.id,
            name: role.name,
            description: role.description || '',
            color: getRoleColor(role.name),
            icon: getRoleIcon(role.name),
            permissions: permissionIds,
            isDefault: role.isDefault,
            isSystemRole: ['owner', 'admin', 'member', 'viewer'].includes(role.id),
            memberCount: role.memberCount,
            createdDate: role.createdAt
          };
        });

        setRoles(transformedRoles);
      } else {
        // No team - show empty state with default roles
        setRoles([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setCreatingRole(true);
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      color: 'blue',
      permissions: [],
      isDefault: false
    });
  };

  const handleEditRole = (role: Role) => {
    if (role.isSystemRole && ['owner', 'admin', 'member', 'viewer'].includes(role.id)) {
      return; // Cannot edit system roles
    }
    setEditingRole(role.id);
    setCreatingRole(false);
    setRoleForm({
      name: role.name,
      description: role.description,
      color: role.color,
      permissions: [...role.permissions],
      isDefault: role.isDefault
    });
  };

  const handleSaveRole = async () => {
    try {
      const roleData: Role = {
        id: editingRole || String(Date.now()),
        name: roleForm.name,
        description: roleForm.description,
        color: roleForm.color,
        icon: getIconByColor(roleForm.color),
        permissions: roleForm.permissions,
        isDefault: roleForm.isDefault,
        isSystemRole: false,
        memberCount: 0,
        createdDate: editingRole ? roles.find(r => r.id === editingRole)?.createdDate || new Date().toISOString() : new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      if (editingRole) {
        setRoles(prev => prev.map(role => role.id === editingRole ? roleData : role));
      } else {
        setRoles(prev => [...prev, roleData]);
      }

      setCreatingRole(false);
      setEditingRole(null);
      resetForm();
    } catch (error) {
      console.error('Failed to save role:', error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role || role.isSystemRole || role.memberCount > 0) {
      return; // Cannot delete system roles or roles with members
    }

    try {
      setRoles(prev => prev.filter(role => role.id !== roleId));
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const handleDuplicateRole = (role: Role) => {
    const duplicatedRole: Role = {
      ...role,
      id: String(Date.now()),
      name: `${role.name} Copy`,
      isDefault: false,
      isSystemRole: false,
      memberCount: 0,
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    setRoles(prev => [...prev, duplicatedRole]);
  };

  const resetForm = () => {
    setRoleForm({
      name: '',
      description: '',
      color: 'blue',
      permissions: [],
      isDefault: false
    });
  };

  const togglePermission = (permissionId: string) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getIconByColor = (color: string) => {
    switch (color) {
      case 'yellow': return Crown;
      case 'red': return Shield;
      case 'blue': return Users;
      case 'purple': return Star;
      case 'gray': return Globe;
      default: return Users;
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'red': return 'bg-red-100 text-red-800';
      case 'blue': return 'bg-blue-100 text-blue-800';
      case 'purple': return 'bg-purple-100 text-purple-800';
      case 'gray': return 'bg-gray-100 text-gray-800';
      case 'green': return 'bg-green-100 text-green-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const groupedPermissions = permissions.reduce((groups, permission) => {
    const category = permission.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(permission);
    return groups;
  }, {} as Record<string, Permission[]>);

  const categoryNames = {
    content: 'Content Management',
    team: 'Team Management',
    analytics: 'Analytics & Reporting',
    settings: 'Settings & Administration'
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
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Roles & Permissions</h1>
            <p className="mt-2 text-sm text-gray-600">
              Define what team members can do within your creative projects
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button
              onClick={() => navigate('/creator/team/members')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Users className="w-4 h-4 mr-2" />
              View Members
            </button>
            <button
              onClick={handleCreateRole}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Roles List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Current Roles</h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {roles.map((role) => {
                  const IconComponent = role.icon;
                  const isEditable = !role.isSystemRole || !['owner', 'admin', 'member', 'viewer'].includes(role.id);
                  
                  return (
                    <div key={role.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getColorClass(role.color)}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{role.name}</h3>
                              {role.isDefault && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Default
                                </span>
                              )}
                              {role.isSystemRole && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  System
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{role.memberCount} member{role.memberCount !== 1 ? 's' : ''}</span>
                              <span>{role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}</span>
                              <span>Created {new Date(role.createdDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDuplicateRole(role)}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            title="Duplicate role"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          
                          {isEditable && (
                            <>
                              <button
                                onClick={() => handleEditRole(role)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                title="Edit role"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              {role.memberCount === 0 && (
                                <button
                                  onClick={() => handleDeleteRole(role.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="Delete role"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Role Form */}
          <div className="sticky top-6">
            {(creatingRole || editingRole) && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {creatingRole ? 'Create New Role' : 'Edit Role'}
                  </h3>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role Name
                    </label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Senior Editor"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={roleForm.description}
                      onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Describe what this role can do..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color
                    </label>
                    <div className="flex gap-2">
                      {['blue', 'purple', 'green', 'yellow', 'red', 'gray'].map(color => (
                        <button
                          key={color}
                          onClick={() => setRoleForm(prev => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-full border-2 ${
                            roleForm.color === color ? 'border-gray-900' : 'border-gray-300'
                          } ${getColorClass(color).split(' ')[0]}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Permissions</h4>
                    <div className="space-y-3">
                      {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                        <div key={category}>
                          <button
                            onClick={() => toggleCategory(category)}
                            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900"
                          >
                            <span>{categoryNames[category as keyof typeof categoryNames]}</span>
                            {expandedCategories.includes(category) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          
                          {expandedCategories.includes(category) && (
                            <div className="mt-2 space-y-2">
                              {categoryPermissions.map(permission => (
                                <label key={permission.id} className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={roleForm.permissions.includes(permission.id)}
                                    onChange={() => togglePermission(permission.id)}
                                    className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {permission.name}
                                      </span>
                                      {permission.isAdvanced && (
                                        <AlertCircle className="w-3 h-3 text-orange-500" />
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500">{permission.description}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Default Role */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleForm.isDefault}
                        onChange={(e) => setRoleForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Default role for new members</span>
                        <p className="text-xs text-gray-500">Automatically assign this role to new team members</p>
                      </div>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleSaveRole}
                      disabled={!roleForm.name.trim()}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {creatingRole ? 'Create Role' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setCreatingRole(false);
                        setEditingRole(null);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Permission Guide */}
            {!creatingRole && !editingRole && (
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-medium text-blue-900 mb-3">Permission Guide</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700">View: See content and data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Edit className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700">Edit: Modify existing content</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plus className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700">Create: Add new content</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700">Manage: Advanced controls</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}