/**
 * Team Service - API client for team management operations
 * Integrates with /api/teams endpoints in the Pitchey backend
 */

import { apiClient } from '../lib/api-client';

// Types for team data
export interface TeamMember {
  id: string;
  userId: string;
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

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  invitedBy: string;
  invitedByName: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

export interface TeamRole {
  id: string;
  name: string;
  description?: string;
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canDelete: boolean;
    canManageRoles: boolean;
    canViewAnalytics: boolean;
    canManagePitches: boolean;
  };
  memberCount: number;
  isDefault: boolean;
  createdAt: string;
}

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string } | string;
}

export class TeamService {
  /**
   * Get all teams for the current user
   */
  static async getTeams(): Promise<Team[]> {
    const response = await apiClient.get<{ teams: Team[] }>('/api/teams');

    if (!response.success || !(response.data as any)?.teams) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to fetch teams');
    }

    return (response.data as any).teams;
  }

  /**
   * Get a specific team by ID with members
   */
  static async getTeamById(teamId: string): Promise<Team> {
    const response = await apiClient.get<{ team: Team }>(`/api/teams/${teamId}`);

    if (!response.success || !(response.data as any)?.team) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to fetch team');
    }

    return (response.data as any).team;
  }

  /**
   * Get all members of a team
   */
  static async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const response = await apiClient.get<{ members: TeamMember[] }>(`/api/teams/${teamId}/members`);

    if (!response.success || !(response.data as any)?.members) {
      // If no members endpoint, try getting from team details
      const team = await this.getTeamById(teamId);
      return team.members || [];
    }

    return (response.data as any).members;
  }

  /**
   * Create a new team
   */
  static async createTeam(data: { name: string; description?: string }): Promise<Team> {
    const response = await apiClient.post<{ team: Team }>('/api/teams', data);

    if (!response.success || !(response.data as any)?.team) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to create team');
    }

    return (response.data as any).team;
  }

  /**
   * Update a team
   */
  static async updateTeam(teamId: string, data: { name?: string; description?: string }): Promise<Team> {
    const response = await apiClient.put<{ team: Team }>(`/api/teams/${teamId}`, data);

    if (!response.success || !(response.data as any)?.team) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to update team');
    }

    return (response.data as any).team;
  }

  /**
   * Delete a team
   */
  static async deleteTeam(teamId: string): Promise<void> {
    const response = await apiClient.delete<{ message: string }>(`/api/teams/${teamId}`);

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to delete team');
    }
  }

  /**
   * Invite a member to a team
   */
  static async inviteToTeam(teamId: string, data: { email: string; role?: string; message?: string }): Promise<TeamInvitation> {
    const response = await apiClient.post<{ invitation: TeamInvitation }>(`/api/teams/${teamId}/invite`, data);

    if (!response.success || !(response.data as any)?.invitation) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to send invitation');
    }

    return (response.data as any).invitation;
  }

  /**
   * Get pending invitations for the current user
   */
  static async getInvitations(): Promise<TeamInvitation[]> {
    const response = await apiClient.get<{ invites: TeamInvitation[] }>('/api/teams/invites');

    if (!response.success || !(response.data as any)?.invites) {
      return [];
    }

    return (response.data as any).invites;
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(inviteId: string): Promise<void> {
    const response = await apiClient.post<{ message: string }>(`/api/teams/invites/${inviteId}/accept`, {});

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to accept invitation');
    }
  }

  /**
   * Reject an invitation
   */
  static async rejectInvitation(inviteId: string): Promise<void> {
    const response = await apiClient.post<{ message: string }>(`/api/teams/invites/${inviteId}/reject`, {});

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to reject invitation');
    }
  }

  /**
   * Update a team member's role
   */
  static async updateMemberRole(teamId: string, memberId: string, role: string): Promise<void> {
    const response = await apiClient.put<{ message: string }>(`/api/teams/${teamId}/members/${memberId}`, { role });

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to update member role');
    }
  }

  /**
   * Remove a member from a team
   */
  static async removeMember(teamId: string, memberId: string): Promise<void> {
    const response = await apiClient.delete<{ message: string }>(`/api/teams/${teamId}/members/${memberId}`);

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to remove member');
    }
  }

  /**
   * Get team roles
   */
  static async getTeamRoles(teamId: string): Promise<TeamRole[]> {
    const response = await apiClient.get<{ roles: TeamRole[] }>(`/api/teams/${teamId}/roles`);

    if (!response.success || !(response.data as any)?.roles) {
      return [];
    }

    return (response.data as any).roles;
  }

  /**
   * Resend an invitation
   */
  static async resendInvitation(inviteId: string): Promise<TeamInvitation> {
    const response = await apiClient.post<{ invitation: TeamInvitation }>(`/api/teams/invites/${inviteId}/resend`, {});

    if (!response.success || !(response.data as any)?.invitation) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to resend invitation');
    }

    return (response.data as any).invitation;
  }

  /**
   * Cancel (delete) an invitation
   */
  static async cancelInvitation(inviteId: string): Promise<void> {
    const response = await apiClient.delete<{ message: string }>(`/api/teams/invites/${inviteId}`);

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to cancel invitation');
    }
  }

  /**
   * Create or update a team role
   */
  static async saveTeamRole(teamId: string, role: Partial<TeamRole>): Promise<TeamRole> {
    const method = role.id ? 'put' : 'post';
    const url = role.id ? `/api/teams/${teamId}/roles/${role.id}` : `/api/teams/${teamId}/roles`;

    const response = await apiClient[method]<{ role: TeamRole }>(url, role);

    if (!response.success || !(response.data as any)?.role) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to save role');
    }

    return (response.data as any).role;
  }

  /**
   * Delete a team role
   */
  static async deleteTeamRole(teamId: string, roleId: string): Promise<void> {
    const response = await apiClient.delete<{ message: string }>(`/api/teams/${teamId}/roles/${roleId}`);

    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to delete role');
    }
  }
}

export default TeamService;
