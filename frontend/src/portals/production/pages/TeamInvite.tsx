import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Mail, Send, Clock, CheckCircle, XCircle,
  ArrowLeft, Copy, RefreshCw, Trash2, Eye, AlertCircle,
  Users, Calendar, Shield
} from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { TeamService } from '@/services/team.service';
import { useCurrentTeam } from '@/shared/hooks/useCurrentTeam';

interface PendingInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  invitedBy: string;
  sentAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  inviteLink?: string;
  message?: string;
}

interface InviteFormData {
  email: string;
  name: string;
  role: string;
  department: string;
  message: string;
  permissions: string[];
}

const departments = ['Production', 'Development', 'Marketing', 'Finance', 'Creative', 'Technical'];
const roles = ['Producer', 'Director', 'Writer', 'Editor', 'Cinematographer', 'Sound Designer', 'VFX Artist', 'Assistant Producer'];
const permissions = [
  'view_projects', 'manage_projects', 'approve_budgets', 'manage_team', 
  'creative_control', 'manage_vfx', 'approve_renders', 'edit_scripts',
  'manage_campaigns', 'approve_marketing', 'view_analytics'
];

export default function TeamInvite() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const userType = user?.userType ?? 'production';
  const { teamId } = useCurrentTeam();

  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    name: '',
    role: '',
    department: '',
    message: '',
    permissions: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    void fetchPendingInvitations();
  }, []);

  const fetchPendingInvitations = async () => {
    try {
      setLoading(true);
      setError('');

      const invites = await TeamService.getInvitations();

      type InviteRaw = Record<string, unknown>;
      const mapped: PendingInvitation[] = invites.map(inv => {
        const invRaw = inv as unknown as InviteRaw;
        const email = (inv.email as string | undefined) ?? (invRaw.invitedEmail as string | undefined) ?? '';
        const invitedByName = (invRaw.invitedByName as string | undefined) ?? 'Team member';
        return {
          id: String(inv.id),
          email,
          name: invitedByName !== 'Team member' ? invitedByName : (email.split('@')[0] ?? 'Unknown'),
          role: (inv.role as string | undefined) ?? 'viewer',
          department: 'Not specified',
          invitedBy: invitedByName,
          sentAt: inv.createdAt as string,
          expiresAt: inv.expiresAt as string,
          status: inv.status as PendingInvitation['status'],
          inviteLink: invRaw.token != null ? `${window.location.origin}/invite/${invRaw.token as string}` : undefined,
          message: inv.message as string | undefined,
        };
      });

      setPendingInvitations(mapped);
    } catch (err: unknown) {
      console.error('Failed to fetch invitations:', err);
      setError('Failed to load pending invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof InviteFormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error !== '') setError('');
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSubmitInvitation = async () => {
    try {
      setSubmitting(true);
      setError('');

      if (!formData.email || !formData.name || !formData.role || !formData.department) {
        setError('Please fill in all required fields');
        return;
      }

      if (!teamId) {
        setError('No team found. Please create a team first.');
        return;
      }

      // Map job title roles to access levels for the backend
      const roleMap: Record<string, string> = {
        'Producer': 'editor',
        'Director': 'editor',
        'Writer': 'editor',
        'Editor': 'editor',
        'Cinematographer': 'viewer',
        'Sound Designer': 'viewer',
        'VFX Artist': 'viewer',
        'Assistant Producer': 'viewer',
      };

      await TeamService.inviteToTeam(teamId, {
        email: formData.email,
        role: roleMap[formData.role] ?? 'viewer',
        message: formData.message !== '' ? formData.message : undefined,
      });

      setSuccessMessage('Invitation sent successfully!');
      setFormData({
        email: '',
        name: '',
        role: '',
        department: '',
        message: '',
        permissions: []
      });
      setShowInviteForm(false);

      await fetchPendingInvitations();
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to send invitation:', e);
      setError(e.message !== '' ? e.message : 'Failed to send invitation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvitation = async (inviteId: string) => {
    try {
      setError('');
      await TeamService.resendInvitation(inviteId);
      setSuccessMessage('Invitation resent successfully!');
      await fetchPendingInvitations();
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to resend invitation:', e);
      setError(e.message !== '' ? e.message : 'Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    try {
      setError('');
      await TeamService.cancelInvitation(inviteId);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== inviteId));
      setSuccessMessage('Invitation cancelled successfully');
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to cancel invitation:', e);
      setError(e.message !== '' ? e.message : 'Failed to cancel invitation');
    }
  };

  const copyInviteLink = (link: string) => {
    void navigator.clipboard.writeText(link);
    setSuccessMessage('Invite link copied to clipboard!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'accepted': return 'text-green-600 bg-green-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'accepted': return CheckCircle;
      case 'expired': return XCircle;
      case 'cancelled': return XCircle;
      default: return AlertCircle;
    }
  };

  const InviteForm = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Send Team Invitation</h3>
        <button
          onClick={() => setShowInviteForm(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <XCircle className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="colleague@company.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="John Doe"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role *
          </label>
          <select
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            required
          >
            <option value="">Select Role</option>
            {roles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Department *
          </label>
          <select
            value={formData.department}
            onChange={(e) => handleInputChange('department', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            required
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Permissions
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {permissions.map(permission => (
            <label key={permission} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.permissions.includes(permission)}
                onChange={() => handlePermissionToggle(permission)}
                className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">
                {permission.replace('_', ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Personal Message (Optional)
        </label>
        <textarea
          value={formData.message}
          onChange={(e) => handleInputChange('message', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          rows={4}
          placeholder="Add a personal message to the invitation..."
        />
      </div>

      {error !== '' && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setShowInviteForm(false)}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          onClick={() => { void handleSubmitInvitation(); }}
          disabled={submitting}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-purple-400 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Invitation
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { void navigate('/production/team'); }}
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

        {/* Header with Action */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Invitations</h1>
            <p className="text-gray-600">Invite new team members and manage pending invitations</p>
          </div>
          <button
            onClick={() => setShowInviteForm(true)}
            className="mt-4 md:mt-0 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Send Invitation
          </button>
        </div>

        {/* Invite Form */}
        {showInviteForm && <InviteForm />}

        {/* Pending Invitations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : pendingInvitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No pending invitations</p>
              <p className="text-gray-400">Send your first team invitation to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingInvitations.map((invitation) => {
                const StatusIcon = getStatusIcon(invitation.status);
                const isExpired = new Date(invitation.expiresAt) < new Date();
                
                return (
                  <div key={invitation.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                            {invitation.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{invitation.name}</h3>
                            <p className="text-sm text-gray-600">{invitation.email}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(invitation.status)}`}>
                            <StatusIcon className="w-3 h-3" />
                            {invitation.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>{invitation.role} • {invitation.department}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Invited by {invitation.invitedBy}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {isExpired || invitation.status === 'expired' ? 'Expired' : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>

                        {invitation.message != null && (
                          <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                            <p className="text-sm text-gray-700">"{invitation.message}"</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {invitation.status === 'pending' && (
                          <>
                            <button
                              onClick={() => copyInviteLink(invitation.inviteLink || '')}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="Copy invite link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { void handleResendInvitation(invitation.id); }}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="Resend invitation"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {invitation.inviteLink && (
                          <button
                            onClick={() => window.open(invitation.inviteLink, '_blank')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View invite"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {(invitation.status === 'pending' || invitation.status === 'expired') && (
                          <button
                            onClick={() => { void handleCancelInvitation(invitation.id); }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Cancel invitation"
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
    </div>
  );
}