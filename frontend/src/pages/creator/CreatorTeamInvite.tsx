import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Link, Copy, Send, Users,
  X, Check, AlertCircle,
  Clock, Globe, Shield, Star,
  ChevronRight, Download, Upload
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { TeamService, type TeamInvitation, type TeamRole } from '../../services/team.service';

interface InviteMethod {
  id: 'email' | 'link' | 'bulk' | 'import';
  name: string;
  description: string;
  icon: any;
  available: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'member' | 'collaborator' | 'viewer';
  permissions: string[];
  invitedDate: string;
  expiresDate: string;
  status: 'pending' | 'expired' | 'resent';
  inviteLink?: string;
  invitedBy: string;
  message?: string;
}

interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canDelete: boolean;
    canManageRoles: boolean;
    canViewAnalytics: boolean;
    canManageProjects: boolean;
  };
  isDefault: boolean;
}

export default function CreatorTeamInvite() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'email' | 'link' | 'bulk' | 'import'>('email');
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [emailForm, setEmailForm] = useState({
    emails: [''],
    role: 'member',
    permissions: [] as string[],
    message: '',
    expiresIn: '7' // days
  });

  const [linkForm, setLinkForm] = useState({
    role: 'member',
    permissions: [] as string[],
    maxUses: '1',
    expiresIn: '7', // days
    requireApproval: false,
    generatedLink: ''
  });

  const [bulkForm, setBulkForm] = useState({
    csvData: '',
    role: 'member',
    permissions: [] as string[],
    message: ''
  });

  const inviteMethods: InviteMethod[] = [
    {
      id: 'email',
      name: 'Email Invitation',
      description: 'Send personalized invites via email',
      icon: Mail,
      available: true
    },
    {
      id: 'link',
      name: 'Invite Link',
      description: 'Generate a shareable invitation link',
      icon: Link,
      available: true
    },
    {
      id: 'bulk',
      name: 'Bulk Import',
      description: 'Import multiple members from CSV',
      icon: Upload,
      available: true
    },
    {
      id: 'import',
      name: 'Import Contacts',
      description: 'Import from Google, LinkedIn, etc.',
      icon: Download,
      available: false // Pro feature
    }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load teams first to get the primary team ID
      const teams = await TeamService.getTeams();
      const primaryTeam = teams[0];

      if (primaryTeam) {
        setCurrentTeamId(primaryTeam.id);

        // Load pending invitations from API
        const invitations = await TeamService.getInvitations();
        const transformedInvites: PendingInvite[] = invitations.map((inv: TeamInvitation) => ({
          id: inv.id,
          email: inv.email,
          name: undefined, // API might not include name
          role: inv.role as 'admin' | 'member' | 'collaborator' | 'viewer',
          permissions: [],
          invitedDate: inv.createdAt,
          expiresDate: inv.expiresAt,
          status: inv.status === 'pending' ? 'pending' : inv.status === 'expired' ? 'expired' : 'pending',
          invitedBy: inv.invitedByName,
          message: inv.message
        }));
        setPendingInvites(transformedInvites);

        // Load role templates from API
        const roles = await TeamService.getTeamRoles(primaryTeam.id);
        const transformedRoles: RoleTemplate[] = roles.map((role: TeamRole) => ({
          id: role.id,
          name: role.name,
          description: role.description || '',
          permissions: {
            canEdit: role.permissions.canEdit,
            canInvite: role.permissions.canInvite,
            canDelete: role.permissions.canDelete,
            canManageRoles: role.permissions.canManageRoles,
            canViewAnalytics: role.permissions.canViewAnalytics,
            canManageProjects: role.permissions.canManagePitches
          },
          isDefault: role.isDefault
        }));
        setRoleTemplates(transformedRoles);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    }
  };

  const handleAddEmail = () => {
    setEmailForm(prev => ({
      ...prev,
      emails: [...prev.emails, '']
    }));
  };

  const handleRemoveEmail = (index: number) => {
    setEmailForm(prev => ({
      ...prev,
      emails: prev.emails.filter((_, i) => i !== index)
    }));
  };

  const handleEmailChange = (index: number, value: string) => {
    setEmailForm(prev => ({
      ...prev,
      emails: prev.emails.map((email, i) => i === index ? value : email)
    }));
  };

  const handleSendEmailInvites = async () => {
    if (!currentTeamId) {
      setError('No team selected. Please create a team first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Send invitations via API
      const validEmails = emailForm.emails.filter(email => email.trim());
      const newInvites: PendingInvite[] = [];

      for (const email of validEmails) {
        const invitation = await TeamService.inviteToTeam(currentTeamId, {
          email: email.trim(),
          role: emailForm.role,
          message: emailForm.message || undefined
        });

        newInvites.push({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role as 'admin' | 'member' | 'collaborator' | 'viewer',
          permissions: emailForm.permissions,
          invitedDate: invitation.createdAt,
          expiresDate: invitation.expiresAt,
          status: 'pending',
          invitedBy: user?.name || 'You',
          message: emailForm.message
        });
      }

      setPendingInvites(prev => [...newInvites, ...prev]);

      // Reset form
      setEmailForm({
        emails: [''],
        role: 'member',
        permissions: [],
        message: '',
        expiresIn: '7'
      });

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);

    } catch (err) {
      console.error('Failed to send invites:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      // Use crypto API for secure token generation
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
      const link = `${window.location.origin}/invite/${token}`;
      setLinkForm(prev => ({
        ...prev,
        generatedLink: link
      }));
    } catch (error) {
      console.error('Failed to generate link:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(linkForm.generatedLink);
    // Show copied confirmation
  };

  const handleResendInvite = async (inviteId: string) => {
    // Note: Resend functionality would need a dedicated API endpoint
    // For now, we update the UI optimistically
    try {
      setPendingInvites(prev => prev.map(invite =>
        invite.id === inviteId
          ? { ...invite, status: 'resent' as const, invitedDate: new Date().toISOString() }
          : invite
      ));
    } catch (err) {
      console.error('Failed to resend invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await TeamService.rejectInvitation(inviteId);
      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));
    } catch (err) {
      console.error('Failed to cancel invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'member': return Users;
      case 'collaborator': return Star;
      case 'viewer': return Globe;
      default: return Users;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'member': return 'bg-blue-100 text-blue-800';
      case 'collaborator': return 'bg-purple-100 text-purple-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'resent': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invite Team Members</h1>
            <p className="mt-2 text-sm text-gray-600">
              Add collaborators to your creative projects
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
              onClick={() => navigate('/creator/team/roles')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Shield className="w-4 h-4 mr-2" />
              Manage Roles
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <Check className="w-5 h-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Invitations sent successfully!
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Your team members will receive email invitations shortly.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Invitation Methods */}
          <div className="lg:col-span-2">
            {/* Method Selection */}
            <div className="bg-white rounded-lg shadow-sm border mb-6">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Invitation Method</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inviteMethods.map((method) => {
                    const IconComponent = method.icon;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setActiveMethod(method.id)}
                        disabled={!method.available}
                        className={`p-4 border rounded-lg transition-all ${
                          activeMethod === method.id
                            ? 'border-purple-500 bg-purple-50'
                            : method.available
                            ? 'border-gray-200 hover:border-gray-300'
                            : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <IconComponent className={`w-5 h-5 mt-0.5 ${
                            activeMethod === method.id ? 'text-purple-600' : 
                            method.available ? 'text-gray-500' : 'text-gray-400'
                          }`} />
                          <div className="text-left">
                            <h3 className={`font-medium ${
                              method.available ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {method.name}
                              {!method.available && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Pro
                                </span>
                              )}
                            </h3>
                            <p className={`text-sm ${
                              method.available ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {method.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Email Invitation Form */}
            {activeMethod === 'email' && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Email Invitations</h3>
                  
                  {/* Email Addresses */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Addresses
                    </label>
                    <div className="space-y-2">
                      {emailForm.emails.map((email, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => handleEmailChange(index, e.target.value)}
                            placeholder="colleague@example.com"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          {emailForm.emails.length > 1 && (
                            <button
                              onClick={() => handleRemoveEmail(index)}
                              className="p-2 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleAddEmail}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                    >
                      + Add another email
                    </button>
                  </div>

                  {/* Role Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <select
                      value={emailForm.role}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {roleTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} - {template.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Personal Message */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Personal Message (Optional)
                    </label>
                    <textarea
                      value={emailForm.message}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                      rows={3}
                      placeholder="Add a personal message to your invitation..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Expiration */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invitation Expires In
                    </label>
                    <select
                      value={emailForm.expiresIn}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, expiresIn: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="1">1 day</option>
                      <option value="3">3 days</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={handleSendEmailInvites}
                    disabled={loading || !emailForm.emails.some(email => email.trim())}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Invitations
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Link Generation Form */}
            {activeMethod === 'link' && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Invitation Link</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Role Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Role
                      </label>
                      <select
                        value={linkForm.role}
                        onChange={(e) => setLinkForm(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {roleTemplates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Max Uses */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Uses
                      </label>
                      <select
                        value={linkForm.maxUses}
                        onChange={(e) => setLinkForm(prev => ({ ...prev, maxUses: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="1">1 person</option>
                        <option value="5">5 people</option>
                        <option value="10">10 people</option>
                        <option value="25">25 people</option>
                        <option value="-1">Unlimited</option>
                      </select>
                    </div>

                    {/* Expiration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expires In
                      </label>
                      <select
                        value={linkForm.expiresIn}
                        onChange={(e) => setLinkForm(prev => ({ ...prev, expiresIn: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="1">1 day</option>
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                        <option value="-1">Never</option>
                      </select>
                    </div>

                    {/* Require Approval */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={linkForm.requireApproval}
                        onChange={(e) => setLinkForm(prev => ({ ...prev, requireApproval: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Require approval before joining
                      </label>
                    </div>
                  </div>

                  {/* Generate/Copy Link */}
                  {!linkForm.generatedLink ? (
                    <button
                      onClick={handleGenerateLink}
                      disabled={loading}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Link className="w-4 h-4 mr-2" />
                          Generate Invitation Link
                        </>
                      )}
                    </button>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Generated Invitation Link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={linkForm.generatedLink}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Share this link with people you want to invite to your team.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pending Invitations Sidebar */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border sticky top-6">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Pending Invitations</h3>
                  <span className="text-sm text-gray-500">{pendingInvites.length}</span>
                </div>

                {pendingInvites.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No pending invitations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingInvites.slice(0, 5).map((invite) => {
                      const RoleIcon = getRoleIcon(invite.role);
                      
                      return (
                        <div key={invite.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {invite.name || invite.email}
                              </p>
                              {invite.name && (
                                <p className="text-xs text-gray-500 truncate">{invite.email}</p>
                              )}
                            </div>
                            <div className="ml-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invite.status)}`}>
                                {invite.status}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mb-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(invite.role)}`}>
                              <RoleIcon className="w-3 h-3 mr-1" />
                              {invite.role}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(invite.invitedDate)}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResendInvite(invite.id)}
                              className="flex-1 text-xs px-2 py-1 text-purple-600 border border-purple-200 rounded hover:bg-purple-50"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleCancelInvite(invite.id)}
                              className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {pendingInvites.length > 5 && (
                      <button
                        onClick={() => navigate('/creator/team/members')}
                        className="w-full text-sm text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1"
                      >
                        View all {pendingInvites.length} invitations
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Role Reference */}
            <div className="bg-blue-50 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-blue-900 mb-2">Role Reference</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Admin</span>
                  <span className="text-blue-600">Full access</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Member</span>
                  <span className="text-blue-600">Edit & collaborate</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Collaborator</span>
                  <span className="text-blue-600">Limited edit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Viewer</span>
                  <span className="text-blue-600">Read only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}