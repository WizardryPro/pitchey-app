import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, Mail, Send, Clock, CheckCircle, XCircle,
  RefreshCw, X, Shield, Users, Calendar, AlertCircle,
  Copy, Download, Settings, MoreVertical, Eye
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { TeamService, type TeamInvitation as TeamInvite_ } from '../../services/team.service';

interface Invitation {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  lastReminderSent?: string;
  message?: string;
  permissions: string[];
}

interface InviteForm {
  email: string;
  name: string;
  role: string;
  department: string;
  permissions: string[];
  message: string;
  expiryDays: number;
}

const departments = ['Production', 'Development', 'Marketing', 'Finance', 'Creative', 'Technical'];
const roles = ['Producer', 'Director', 'Writer', 'Editor', 'Cinematographer', 'Sound Designer', 'VFX Artist'];

const availablePermissions = [
  { id: 'manage_projects', name: 'Manage Projects', description: 'Create and edit projects' },
  { id: 'approve_budgets', name: 'Approve Budgets', description: 'Review and approve project budgets' },
  { id: 'manage_team', name: 'Manage Team', description: 'Add, remove, and edit team members' },
  { id: 'creative_control', name: 'Creative Control', description: 'Make creative decisions' },
  { id: 'view_analytics', name: 'View Analytics', description: 'Access reports and analytics' },
  { id: 'manage_contracts', name: 'Manage Contracts', description: 'Handle contracts and agreements' }
];

export default function TeamInvite() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'invite' | 'pending'>('invite');
  const [selectedInvitations, setSelectedInvitations] = useState<string[]>([]);
  
  const [form, setForm] = useState<InviteForm>({
    email: '',
    name: '',
    role: '',
    department: '',
    permissions: [],
    message: '',
    expiryDays: 7
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);

      // Fetch teams first, then get invitations
      const [teams, apiInvites] = await Promise.all([
        TeamService.getTeams().catch(() => []),
        TeamService.getInvitations().catch(() => [])
      ]);

      // Map API invitations to local Invitation type
      const mapped: Invitation[] = apiInvites.map((inv: TeamInvite_) => ({
        id: inv.id,
        email: inv.email,
        name: inv.email.split('@')[0],
        role: inv.role || 'member',
        department: '',
        invitedBy: inv.invitedByName || inv.invitedBy || '',
        invitedAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        status: inv.status === 'rejected' ? 'cancelled' : inv.status as Invitation['status'],
        message: inv.message,
        permissions: []
      }));

      setInvitations(mapped);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to fetch invitations:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (!form.email) newErrors.email = 'Email is required';
    if (!form.name) newErrors.name = 'Name is required';
    if (!form.role) newErrors.role = 'Role is required';
    if (!form.department) newErrors.department = 'Department is required';
    
    if (!form.email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      setSubmitting(true);

      // Get the user's first team (or create one if needed)
      let teams = await TeamService.getTeams().catch(() => []);
      let teamId = teams[0]?.id;

      if (!teamId) {
        const newTeam = await TeamService.createTeam({ name: `${user?.name || 'My'}'s Team` });
        teamId = newTeam.id;
      }

      // Send invitation via API
      const apiInvite = await TeamService.inviteToTeam(teamId, {
        email: form.email,
        role: form.role || 'member',
        message: form.message || undefined
      });

      // Map API response to local Invitation type
      const newInvitation: Invitation = {
        id: apiInvite.id,
        email: form.email,
        name: form.name,
        role: form.role,
        department: form.department,
        invitedBy: user?.name || 'Current User',
        invitedAt: apiInvite.createdAt || new Date().toISOString(),
        expiresAt: apiInvite.expiresAt || new Date(Date.now() + form.expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        permissions: form.permissions,
        message: form.message
      };

      setInvitations(prev => [newInvitation, ...prev]);

      // Reset form
      setForm({
        email: '',
        name: '',
        role: '',
        department: '',
        permissions: [],
        message: '',
        expiryDays: 7
      });

      setErrors({});
      setActiveTab('pending');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to send invitation:', e.message);
      setErrors({ email: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkInvite = async () => {
    const emails = bulkEmails.split('\n').filter(email => email.trim());
    if (emails.length === 0) return;

    try {
      let teams = await TeamService.getTeams().catch(() => []);
      let teamId = teams[0]?.id;

      if (!teamId) {
        const newTeam = await TeamService.createTeam({ name: `${user?.name || 'My'}'s Team` });
        teamId = newTeam.id;
      }

      // Send invitations in parallel
      const results = await Promise.allSettled(
        emails.map(email => TeamService.inviteToTeam(teamId!, { email: email.trim(), role: 'member' }))
      );

      // Refresh the invitations list
      await fetchInvitations();
      setBulkEmails('');
      setShowBulkInvite(false);
      setActiveTab('pending');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Bulk invite failed:', e.message);
    }
  };

  const handleResendInvitation = async (inviteId: string) => {
    try {
      await TeamService.resendInvitation(inviteId);
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === inviteId
            ? { ...inv, lastReminderSent: new Date().toISOString() }
            : inv
        )
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to resend invitation:', e.message);
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    try {
      await TeamService.cancelInvitation(inviteId);
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === inviteId
            ? { ...inv, status: 'cancelled' as const }
            : inv
        )
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to cancel invitation:', e.message);
    }
  };

  const handleSelectInvitation = (inviteId: string) => {
    setSelectedInvitations(prev => 
      prev.includes(inviteId) 
        ? prev.filter(id => id !== inviteId)
        : [...prev, inviteId]
    );
  };

  const handlePermissionChange = (permissionId: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days > 0) return `${days} days ago`;
    
    const futureDays = Math.abs(days);
    if (futureDays === 1) return 'Tomorrow';
    return `In ${futureDays} days`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'accepted': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <X className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'accepted': return 'bg-green-100 text-green-800 border-green-300';
      case 'expired': return 'bg-red-100 text-red-800 border-red-300';
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const pendingInvites = invitations.filter(inv => inv.status === 'pending');
  const expiredInvites = invitations.filter(inv => inv.status === 'expired');

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Invitations</h1>
            <p className="text-gray-600">Invite new members to join your production team</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => setShowBulkInvite(true)}
              className="px-6 py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              Bulk Invite
            </button>
            <button
              onClick={() => navigate('/team/members')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              View Members
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg mb-6 border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition ${
              activeTab === 'invite'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus className="w-5 h-5" />
              Send Invitation
            </div>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition relative ${
              activeTab === 'pending'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Invitations
              {pendingInvites.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                  {pendingInvites.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Invite Form Tab */}
        {activeTab === 'invite' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="colleague@company.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="John Smith"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 ${
                      errors.role ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-400">{errors.role}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 ${
                      errors.department ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  {errors.department && (
                    <p className="mt-1 text-sm text-red-400">{errors.department}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invitation Expiry
                  </label>
                  <select
                    value={form.expiryDays}
                    onChange={(e) => setForm(prev => ({ ...prev, expiryDays: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Shield className="w-4 h-4 inline mr-2" />
                  Permissions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availablePermissions.map(permission => (
                    <label key={permission.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(permission.id)}
                        onChange={() => handlePermissionChange(permission.id)}
                        className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{permission.name}</div>
                        <div className="text-xs text-gray-600">{permission.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Personal Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Message (Optional)
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500"
                  placeholder="Add a personal welcome message..."
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Invitation
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      email: '',
                      name: '',
                      role: '',
                      department: '',
                      permissions: [],
                      message: '',
                      expiryDays: 7
                    });
                    setErrors({});
                  }}
                  className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Pending Invitations Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Sent</p>
                    <p className="text-2xl font-bold text-gray-900">{invitations.length}</p>
                  </div>
                  <Mail className="w-8 h-8 text-indigo-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingInvites.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Accepted</p>
                    <p className="text-2xl font-bold text-green-600">{invitations.filter(i => i.status === 'accepted').length}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Expired</p>
                    <p className="text-2xl font-bold text-red-600">{expiredInvites.length}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
              </div>
            </div>

            {/* Invitations List */}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                {invitations.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg font-medium mb-2">No invitations sent yet</p>
                    <p className="text-gray-500">Start by sending your first team invitation</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Invitee
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Role & Department
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Invited By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Expires
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invitations.map((invitation) => (
                          <tr key={invitation.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{invitation.name}</div>
                                <div className="text-sm text-gray-600">{invitation.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{invitation.role}</div>
                              <div className="text-sm text-gray-600">{invitation.department}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(invitation.status)}
                                <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(invitation.status)}`}>
                                  {invitation.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {invitation.invitedBy}
                              <div className="text-xs text-gray-500">
                                {formatRelativeTime(invitation.invitedAt)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatRelativeTime(invitation.expiresAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                {invitation.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleResendInvitation(invitation.id)}
                                      className="text-indigo-600 hover:text-indigo-500 transition"
                                      title="Resend invitation"
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${invitation.id}`)}
                                      className="text-gray-600 hover:text-gray-500 transition"
                                      title="Copy invite link"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                <button
                                  className="text-gray-600 hover:text-gray-500 transition"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleCancelInvitation(invitation.id)}
                                  className="text-red-600 hover:text-red-500 transition"
                                  title="Cancel invitation"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bulk Invite Modal */}
        {showBulkInvite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Bulk Invite</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Addresses (one per line)
                  </label>
                  <textarea
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500"
                    rows={6}
                    placeholder={`john@company.com\njane@company.com\nalex@company.com`}
                  />
                </div>
                
                <div className="text-sm text-gray-600">
                  Note: Bulk invitations will use default settings. You can customize individual invitations later.
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowBulkInvite(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkInvite}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Send Invitations
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}