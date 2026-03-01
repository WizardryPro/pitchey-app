import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import TeamService from '../team.service';

const mockTeam = {
  id: 't1',
  name: 'Creative Team',
  description: 'Our main team',
  ownerId: 'u1',
  ownerName: 'Alice',
  memberCount: 3,
  projectCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-10T00:00:00Z',
};

const mockMember = {
  id: 'm1',
  userId: 'u2',
  name: 'Bob',
  email: 'bob@example.com',
  role: 'member' as const,
  permissions: { canEdit: true, canInvite: false, canDelete: false, canManageRoles: false },
  status: 'active' as const,
  joinedDate: '2026-01-05T00:00:00Z',
  lastActive: '2026-02-01T00:00:00Z',
  projects: [],
  skills: [],
  isPublic: true,
  contributionScore: 50,
};

const mockInvitation = {
  id: 'inv1',
  teamId: 't1',
  teamName: 'Creative Team',
  email: 'charlie@example.com',
  role: 'member',
  status: 'pending' as const,
  invitedBy: 'u1',
  invitedByName: 'Alice',
  expiresAt: '2026-03-01T00:00:00Z',
  createdAt: '2026-02-01T00:00:00Z',
};

describe('TeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getTeams ────────────────────────────────────────────────────
  describe('getTeams', () => {
    it('returns teams on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { teams: [mockTeam] } });

      const result = await TeamService.getTeams();

      expect(mockGet).toHaveBeenCalledWith('/api/teams');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Creative Team');
    });

    it('throws when API fails', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } });

      await expect(TeamService.getTeams()).rejects.toThrow('Unauthorized');
    });

    it('throws when no teams in response', async () => {
      mockGet.mockResolvedValue({ success: false, error: 'Server error' });

      await expect(TeamService.getTeams()).rejects.toThrow('Server error');
    });
  });

  // ─── getTeamById ─────────────────────────────────────────────────
  describe('getTeamById', () => {
    it('returns team by id on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { team: mockTeam } });

      const result = await TeamService.getTeamById('t1');

      expect(mockGet).toHaveBeenCalledWith('/api/teams/t1');
      expect(result.id).toBe('t1');
      expect(result.name).toBe('Creative Team');
    });

    it('throws when team not found', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Team not found' } });

      await expect(TeamService.getTeamById('missing')).rejects.toThrow('Team not found');
    });
  });

  // ─── getTeamMembers ──────────────────────────────────────────────
  describe('getTeamMembers', () => {
    it('returns members from /members endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: { members: [mockMember] } });

      const result = await TeamService.getTeamMembers('t1');

      expect(mockGet).toHaveBeenCalledWith('/api/teams/t1/members');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });

    it('falls back to getTeamById members when endpoint fails', async () => {
      const teamWithMembers = { ...mockTeam, members: [mockMember] };

      mockGet
        .mockResolvedValueOnce({ success: false }) // /members endpoint fails
        .mockResolvedValueOnce({ success: true, data: { team: teamWithMembers } }); // fallback

      const result = await TeamService.getTeamMembers('t1');

      expect(result).toHaveLength(1);
    });

    it('returns empty array when fallback team has no members', async () => {
      mockGet
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true, data: { team: mockTeam } });

      const result = await TeamService.getTeamMembers('t1');

      expect(result).toEqual([]);
    });
  });

  // ─── createTeam ──────────────────────────────────────────────────
  describe('createTeam', () => {
    it('posts and returns new team', async () => {
      mockPost.mockResolvedValue({ success: true, data: { team: mockTeam } });

      const result = await TeamService.createTeam({ name: 'Creative Team', description: 'Our main team' });

      expect(mockPost).toHaveBeenCalledWith('/api/teams', {
        name: 'Creative Team',
        description: 'Our main team',
      });
      expect(result.name).toBe('Creative Team');
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Name already taken' } });

      await expect(TeamService.createTeam({ name: 'Duplicate' })).rejects.toThrow('Name already taken');
    });
  });

  // ─── updateTeam ──────────────────────────────────────────────────
  describe('updateTeam', () => {
    it('puts and returns updated team', async () => {
      const updatedTeam = { ...mockTeam, name: 'Updated Team' };
      mockPut.mockResolvedValue({ success: true, data: { team: updatedTeam } });

      const result = await TeamService.updateTeam('t1', { name: 'Updated Team' });

      expect(mockPut).toHaveBeenCalledWith('/api/teams/t1', { name: 'Updated Team' });
      expect(result.name).toBe('Updated Team');
    });

    it('throws on failure', async () => {
      mockPut.mockResolvedValue({ success: false, error: { message: 'Update failed' } });

      await expect(TeamService.updateTeam('t1', { name: 'Bad' })).rejects.toThrow('Update failed');
    });
  });

  // ─── deleteTeam ──────────────────────────────────────────────────
  describe('deleteTeam', () => {
    it('calls delete on correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await TeamService.deleteTeam('t1');

      expect(mockDelete).toHaveBeenCalledWith('/api/teams/t1');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(TeamService.deleteTeam('t1')).rejects.toThrow('Not found');
    });
  });

  // ─── inviteToTeam ────────────────────────────────────────────────
  describe('inviteToTeam', () => {
    it('posts invite and returns invitation', async () => {
      mockPost.mockResolvedValue({ success: true, data: { invitation: mockInvitation } });

      const result = await TeamService.inviteToTeam('t1', {
        email: 'charlie@example.com',
        role: 'member',
        message: 'Join us!',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/teams/t1/invite', {
        email: 'charlie@example.com',
        role: 'member',
        message: 'Join us!',
      });
      expect(result.email).toBe('charlie@example.com');
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Already a member' } });

      await expect(
        TeamService.inviteToTeam('t1', { email: 'x@example.com' })
      ).rejects.toThrow('Already a member');
    });
  });

  // ─── getInvitations ──────────────────────────────────────────────
  describe('getInvitations', () => {
    it('returns invitations on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { invites: [mockInvitation] } });

      const result = await TeamService.getInvitations();

      expect(mockGet).toHaveBeenCalledWith('/api/teams/invites');
      expect(result).toHaveLength(1);
    });

    it('returns empty array on failure (no throw)', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await TeamService.getInvitations();

      expect(result).toEqual([]);
    });
  });

  // ─── acceptInvitation ────────────────────────────────────────────
  describe('acceptInvitation', () => {
    it('posts to accept endpoint', async () => {
      mockPost.mockResolvedValue({ success: true });

      await TeamService.acceptInvitation('inv1');

      expect(mockPost).toHaveBeenCalledWith('/api/teams/invites/inv1/accept', {});
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Invite expired' } });

      await expect(TeamService.acceptInvitation('inv1')).rejects.toThrow('Invite expired');
    });
  });

  // ─── rejectInvitation ────────────────────────────────────────────
  describe('rejectInvitation', () => {
    it('posts to reject endpoint', async () => {
      mockPost.mockResolvedValue({ success: true });

      await TeamService.rejectInvitation('inv1');

      expect(mockPost).toHaveBeenCalledWith('/api/teams/invites/inv1/reject', {});
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Invite not found' } });

      await expect(TeamService.rejectInvitation('inv1')).rejects.toThrow('Invite not found');
    });
  });

  // ─── updateMemberRole ────────────────────────────────────────────
  describe('updateMemberRole', () => {
    it('puts role update to correct endpoint', async () => {
      mockPut.mockResolvedValue({ success: true });

      await TeamService.updateMemberRole('t1', 'm1', 'admin');

      expect(mockPut).toHaveBeenCalledWith('/api/teams/t1/members/m1', { role: 'admin' });
    });

    it('throws on failure', async () => {
      mockPut.mockResolvedValue({ success: false, error: { message: 'Role update failed' } });

      await expect(TeamService.updateMemberRole('t1', 'm1', 'admin')).rejects.toThrow('Role update failed');
    });
  });

  // ─── removeMember ────────────────────────────────────────────────
  describe('removeMember', () => {
    it('calls delete on correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await TeamService.removeMember('t1', 'm1');

      expect(mockDelete).toHaveBeenCalledWith('/api/teams/t1/members/m1');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Member not found' } });

      await expect(TeamService.removeMember('t1', 'm1')).rejects.toThrow('Member not found');
    });
  });

  // ─── getTeamRoles ────────────────────────────────────────────────
  describe('getTeamRoles', () => {
    it('returns roles from API on success', async () => {
      const mockRoles = [
        { id: 'r1', name: 'Lead', description: 'Team lead', permissions: {}, memberCount: 1, isDefault: false, createdAt: '2026-01-01' },
      ];

      mockGet.mockResolvedValue({ success: true, data: { roles: mockRoles } });

      const result = await TeamService.getTeamRoles('t1');

      expect(mockGet).toHaveBeenCalledWith('/api/teams/t1/roles');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Lead');
    });

    it('returns default roles when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await TeamService.getTeamRoles('t1');

      // API failure returns empty array
      expect(result).toEqual([]);
    });
  });

  // ─── resendInvitation ────────────────────────────────────────────
  describe('resendInvitation', () => {
    it('posts to resend endpoint and returns invitation', async () => {
      mockPost.mockResolvedValue({ success: true, data: { invitation: mockInvitation } });

      const result = await TeamService.resendInvitation('inv1');

      expect(mockPost).toHaveBeenCalledWith('/api/teams/invites/inv1/resend', {});
      expect(result.id).toBe('inv1');
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Cannot resend' } });

      await expect(TeamService.resendInvitation('inv1')).rejects.toThrow('Cannot resend');
    });
  });

  // ─── cancelInvitation ────────────────────────────────────────────
  describe('cancelInvitation', () => {
    it('calls delete on invite endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await TeamService.cancelInvitation('inv1');

      expect(mockDelete).toHaveBeenCalledWith('/api/teams/invites/inv1');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Invite not found' } });

      await expect(TeamService.cancelInvitation('inv1')).rejects.toThrow('Invite not found');
    });
  });

  // ─── saveTeamRole ────────────────────────────────────────────────
  describe('saveTeamRole', () => {
    it('posts to create a new role when no id', async () => {
      const newRole = { name: 'Writer', permissions: { canEdit: true, canInvite: false, canDelete: false, canManageRoles: false, canViewAnalytics: false, canManagePitches: true }, memberCount: 0, isDefault: false, createdAt: '2026-01-01', id: 'r2', description: 'Writer role' };
      mockPost.mockResolvedValue({ success: true, data: { role: newRole } });

      const result = await TeamService.saveTeamRole('t1', { name: 'Writer' });

      expect(mockPost).toHaveBeenCalledWith('/api/teams/t1/roles', { name: 'Writer' });
      expect(result.name).toBe('Writer');
    });

    it('puts to update an existing role when id provided', async () => {
      const updatedRole = { id: 'r1', name: 'Updated Lead', permissions: {}, memberCount: 1, isDefault: false, createdAt: '2026-01-01' };
      mockPut.mockResolvedValue({ success: true, data: { role: updatedRole } });

      const result = await TeamService.saveTeamRole('t1', { id: 'r1', name: 'Updated Lead' });

      expect(mockPut).toHaveBeenCalledWith('/api/teams/t1/roles/r1', { id: 'r1', name: 'Updated Lead' });
      expect(result.name).toBe('Updated Lead');
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Save failed' } });

      await expect(TeamService.saveTeamRole('t1', { name: 'Bad' })).rejects.toThrow('Save failed');
    });
  });

  // ─── deleteTeamRole ──────────────────────────────────────────────
  describe('deleteTeamRole', () => {
    it('calls delete on correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await TeamService.deleteTeamRole('t1', 'r1');

      expect(mockDelete).toHaveBeenCalledWith('/api/teams/t1/roles/r1');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Role in use' } });

      await expect(TeamService.deleteTeamRole('t1', 'r1')).rejects.toThrow('Role in use');
    });
  });
});
