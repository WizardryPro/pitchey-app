import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Shield, Mail, Calendar,
  MoreVertical, Edit2, Trash2, CheckCircle, XCircle,
  Briefcase, Star, AlertCircle, RefreshCw
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { TeamService, Team, TeamMember as ServiceTeamMember } from '../services/team.service';
import { toast } from 'react-hot-toast';

interface DisplayMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'pending' | 'inactive';
  joinedDate: string;
  teamId: string;
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<DisplayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviting, setInviting] = useState(false);

  const loadTeamData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchedTeams = await TeamService.getTeams();
      setTeams(fetchedTeams);

      // Gather members from all teams
      const allMembers: DisplayMember[] = [];
      for (const team of fetchedTeams) {
        if (team.members) {
          for (const m of team.members) {
            allMembers.push({
              id: m.id,
              name: m.name || m.email,
              email: m.email,
              role: m.role,
              status: m.status,
              joinedDate: m.joinedDate,
              teamId: team.id,
            });
          }
        } else {
          try {
            const teamMembers = await TeamService.getTeamMembers(team.id);
            for (const m of teamMembers) {
              allMembers.push({
                id: m.id,
                name: m.name || m.email,
                email: m.email,
                role: m.role,
                status: m.status,
                joinedDate: m.joinedDate,
                teamId: team.id,
              });
            }
          } catch {
            // Team may not have members endpoint
          }
        }
      }
      setMembers(allMembers);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load team data:', e.message);
      setError(e.message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleInvite = async () => {
    if (!inviteEmail || teams.length === 0) return;
    setInviting(true);
    try {
      await TeamService.inviteToTeam(teams[0].id, {
        email: inviteEmail,
        role: inviteRole,
        message: inviteMessage || undefined,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      setInviteMessage('');
      loadTeamData();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await TeamService.removeMember(teamId, memberId);
      toast.success('Member removed');
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to remove member');
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    total: members.length,
    active: members.filter(m => m.status === 'active').length,
    pending: members.filter(m => m.status === 'pending').length,
    teams: teams.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <DashboardHeader
        user={user}
        userType={userType as any}
        title="Team Management"
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Management</h1>
            <p className="text-gray-600">Manage your production team, roles, and permissions</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={teams.length === 0}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </button>
            <button
              onClick={loadTeamData}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition"
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
            <button onClick={loadTeamData} className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
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
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Teams</p>
                <p className="text-2xl font-bold text-blue-600">{stats.teams}</p>
              </div>
              <Briefcase className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
              />
            </div>

            <button
              onClick={() => navigate(`/${userType}/team/roles`)}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Manage Roles
            </button>
          </div>
        </div>

        {/* Team Members Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <div key={member.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-300 transition shadow-sm">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600 capitalize">{member.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      {member.email}
                    </div>
                    {member.joinedDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        Joined {new Date(member.joinedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      member.status === 'active' ? 'bg-green-100 text-green-800' :
                      member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {member.status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRemoveMember(member.teamId, member.id)}
                      className="p-2 text-red-500 hover:bg-gray-50 rounded-lg transition"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredMembers.length === 0 && !loading && !error && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No team members found</p>
            {teams.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">Create a team first to start managing members</p>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Invite Team Member</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
                  placeholder="colleague@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="collaborator">Collaborator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
                  rows={3}
                  placeholder="Add a personal message to the invitation..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail || inviting}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
