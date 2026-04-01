/**
 * Team Management Database Queries
 * Handles all team-related database operations
 */

import type { SqlQuery } from './base';

export interface Team {
  id: number;
  name: string;
  description?: string;
  ownerId: number;
  visibility: 'private' | 'team' | 'public';
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  name?: string;
  email?: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  lastActive?: string;
  avatar?: string;
}

export interface TeamInvitation {
  id: number;
  teamId: number;
  teamName?: string;
  invitedEmail: string;
  invitedBy: number;
  invitedByName?: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  message?: string;
  token?: string;
  createdAt: string;
  expiresAt: string;
}

// Get all teams for a user
export async function getUserTeams(sql: SqlQuery, userId: string) {
  try {
    const teams = await sql`
      SELECT DISTINCT
        t.id,
        t.name,
        t.description,
        t.owner_id as "ownerId",
        t.visibility,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', tm.id,
              'userId', tm.user_id,
              'name', u.username,
              'email', u.email,
              'role', tm.role,
              'joinedAt', tm.joined_at,
              'lastActive', tm.last_active,
              'avatar', u.profile_image
            ) ORDER BY 
              CASE tm.role 
                WHEN 'owner' THEN 1 
                WHEN 'editor' THEN 2 
                WHEN 'viewer' THEN 3 
              END,
              tm.joined_at
          )
          FROM team_members tm
          JOIN users u ON tm.user_id = u.id
          WHERE tm.team_id = t.id
        ) as members
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.owner_id = ${userId}::int OR tm.user_id = ${userId}::int
      ORDER BY t.created_at DESC
    `;

    return teams.map((team: any) => ({
      ...team,
      members: team.members || []
    }));
  } catch (error) {
    console.error('Error fetching user teams:', error);
    return [];
  }
}

// Get single team details
export async function getTeamById(sql: SqlQuery, teamId: string, userId: string) {
  try {
    const result = await sql`
      SELECT 
        t.id,
        t.name,
        t.description,
        t.owner_id as "ownerId",
        t.visibility,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', tm.id,
              'userId', tm.user_id,
              'name', u.username,
              'email', u.email,
              'role', tm.role,
              'joinedAt', tm.joined_at,
              'lastActive', tm.last_active,
              'avatar', u.profile_image
            )
          )
          FROM team_members tm
          JOIN users u ON tm.user_id = u.id
          WHERE tm.team_id = t.id
        ) as members,
        is_team_member(${userId}::int, t.id) as "isMember",
        is_team_owner(${userId}::int, t.id) as "isOwner"
      FROM teams t
      WHERE t.id = ${teamId}::int
    `;

    if (!result || result.length === 0) {
      return null;
    }

    const team = result[0];
    
    // Check access permissions
    if (team.visibility === 'private' && !team.isMember) {
      return null; // Private team, user is not a member
    }

    return {
      ...team,
      members: team.members || []
    };
  } catch (error) {
    console.error('Error fetching team:', error);
    return null;
  }
}

// Create a new team
export async function createTeam(sql: SqlQuery, data: {
  name: string;
  description?: string;
  ownerId: string;
  visibility?: 'private' | 'team' | 'public';
}) {
  try {
    const result = await sql`
      WITH new_team AS (
        INSERT INTO teams (name, description, owner_id, visibility)
        VALUES (
          ${data.name},
          ${data.description || null},
          ${data.ownerId}::int,
          ${data.visibility || 'private'}
        )
        RETURNING *
      ),
      owner_member AS (
        INSERT INTO team_members (team_id, user_id, role)
        SELECT id, owner_id, 'owner'
        FROM new_team
        RETURNING *
      )
      SELECT 
        t.id,
        t.name,
        t.description,
        t.owner_id as "ownerId",
        t.visibility,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt"
      FROM new_team t
    `;

    if (!result || result.length === 0) {
      throw new Error('Failed to create team');
    }

    // Log activity
    await logTeamActivity(sql, result[0].id, data.ownerId, 'team_created', 'team', result[0].id);

    // Fetch complete team with members
    return await getTeamById(sql, result[0].id.toString(), data.ownerId);
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
}

// Update team details
export async function updateTeam(sql: SqlQuery, teamId: string, userId: string, data: {
  name?: string;
  description?: string;
  visibility?: 'private' | 'team' | 'public';
}) {
  try {
    // Check if user is owner
    const isOwner = await sql`
      SELECT is_team_owner(${userId}::int, ${teamId}::int) as "isOwner"
    `;

    if (!isOwner[0]?.isOwner) {
      throw new Error('Only team owners can update team details');
    }

    const result = await sql`
      UPDATE teams
      SET
        name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        visibility = COALESCE(${data.visibility}, visibility),
        updated_at = NOW()
      WHERE id = ${teamId}::int
      RETURNING 
        id,
        name,
        description,
        owner_id as "ownerId",
        visibility,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (!result || result.length === 0) {
      throw new Error('Team not found');
    }

    // Log activity
    await logTeamActivity(sql, teamId, userId, 'team_updated', 'team', teamId, data);

    return await getTeamById(sql, teamId, userId);
  } catch (error) {
    console.error('Error updating team:', error);
    throw error;
  }
}

// Delete a team
export async function deleteTeam(sql: SqlQuery, teamId: string, userId: string) {
  try {
    // Check if user is owner
    const isOwner = await sql`
      SELECT owner_id FROM teams WHERE id = ${teamId}::int AND owner_id = ${userId}::int
    `;

    if (!isOwner || isOwner.length === 0) {
      throw new Error('Only team owners can delete teams');
    }

    await sql`DELETE FROM teams WHERE id = ${teamId}::int`;

    return true;
  } catch (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
}

// Send team invitation
export async function inviteToTeam(sql: SqlQuery, teamId: string, inviterId: string, data: {
  email: string;
  role: 'editor' | 'viewer';
  message?: string;
}) {
  try {
    // Check if inviter has permission (owner or editor)
    const hasPermission = await sql`
      SELECT 1 FROM team_members 
      WHERE team_id = ${teamId}::int 
        AND user_id = ${inviterId}::int 
        AND role IN ('owner', 'editor')
    `;

    if (!hasPermission || hasPermission.length === 0) {
      throw new Error('You do not have permission to invite members');
    }

    // Check if user is already a member
    const existingMember = await sql`
      SELECT 1 FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ${teamId}::int AND u.email = ${data.email}
    `;

    if (existingMember && existingMember.length > 0) {
      throw new Error('User is already a team member');
    }

    // Check for existing pending invitation
    const existingInvite = await sql`
      SELECT 1 FROM team_invitations
      WHERE team_id = ${teamId}::int 
        AND invited_email = ${data.email}
        AND status = 'pending'
        AND expires_at > NOW()
    `;

    if (existingInvite && existingInvite.length > 0) {
      throw new Error('An invitation is already pending for this email');
    }

    // Create invitation
    const result = await sql`
      INSERT INTO team_invitations (
        team_id, invited_email, invited_by, role, message
      ) VALUES (
        ${teamId}::int,
        ${data.email},
        ${inviterId}::int,
        ${data.role},
        ${data.message || null}
      )
      RETURNING 
        id,
        team_id as "teamId",
        invited_email as "invitedEmail",
        invited_by as "invitedBy",
        role,
        status,
        message,
        token,
        created_at as "createdAt",
        expires_at as "expiresAt"
    `;

    if (!result || result.length === 0) {
      throw new Error('Failed to create invitation');
    }

    // Log activity
    await logTeamActivity(sql, teamId, inviterId, 'member_invited', 'invitation', result[0].id, {
      email: data.email,
      role: data.role
    });

    // TODO: Send invitation email with token

    return result[0];
  } catch (error) {
    console.error('Error inviting to team:', error);
    throw error;
  }
}

// Get user's pending invitations
export async function getUserInvitations(sql: SqlQuery, email: string) {
  try {
    const invitations = await sql`
      SELECT 
        ti.id,
        ti.team_id as "teamId",
        t.name as "teamName",
        ti.invited_email as "invitedEmail",
        ti.invited_by as "invitedBy",
        u.username as "invitedByName",
        ti.role,
        ti.status,
        ti.message,
        ti.created_at as "createdAt",
        ti.expires_at as "expiresAt"
      FROM team_invitations ti
      JOIN teams t ON ti.team_id = t.id
      JOIN users u ON ti.invited_by = u.id
      WHERE ti.invited_email = ${email}
        AND ti.status = 'pending'
        AND ti.expires_at > NOW()
      ORDER BY ti.created_at DESC
    `;

    return invitations;
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }
}

// Accept team invitation
export async function acceptInvitation(sql: SqlQuery, invitationId: string, userId: string, userEmail: string) {
  try {
    // Get invitation details
    const invitation = await sql`
      SELECT * FROM team_invitations
      WHERE id = ${invitationId}::int
        AND invited_email = ${userEmail}
        AND status = 'pending'
        AND expires_at > NOW()
    `;

    if (!invitation || invitation.length === 0) {
      throw new Error('Invalid or expired invitation');
    }

    const invite = invitation[0];

    // Start transaction
    await (sql as any).begin(async (sql: any) => {
      // Update invitation status
      await sql`
        UPDATE team_invitations
        SET status = 'accepted', responded_at = NOW()
        WHERE id = ${invitationId}::int
      `;

      // Add user to team
      await sql`
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (${invite.team_id}::int, ${userId}::int, ${invite.role})
        ON CONFLICT (team_id, user_id) DO NOTHING
      `;

      // Log activity
      await logTeamActivity(sql, invite.team_id, userId, 'invitation_accepted', 'invitation', invitationId);
    });

    return true;
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw error;
  }
}

// Reject team invitation
export async function rejectInvitation(sql: SqlQuery, invitationId: string, userEmail: string) {
  try {
    const result = await sql`
      UPDATE team_invitations
      SET status = 'rejected', responded_at = NOW()
      WHERE id = ${invitationId}::int
        AND invited_email = ${userEmail}
        AND status = 'pending'
      RETURNING team_id
    `;

    if (result && result.length > 0) {
      // Log activity
      await logTeamActivity(sql, result[0].team_id, null, 'invitation_rejected', 'invitation', invitationId);
    }

    return true;
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    throw error;
  }
}

// Update team member role
export async function updateMemberRole(sql: SqlQuery, teamId: string, memberId: string, updaterId: string, newRole: string) {
  try {
    // Check if updater is owner
    const isOwner = await sql`
      SELECT is_team_owner(${updaterId}::int, ${teamId}::int) as "isOwner"
    `;

    if (!isOwner[0]?.isOwner) {
      throw new Error('Only team owners can update member roles');
    }

    // Don't allow changing original owner's role
    const team = await sql`
      SELECT owner_id FROM teams WHERE id = ${teamId}::int
    `;

    if (team[0]?.owner_id === parseInt(memberId)) {
      throw new Error('Cannot change the role of the team owner');
    }

    const result = await sql`
      UPDATE team_members
      SET role = ${newRole}
      WHERE team_id = ${teamId}::int AND user_id = ${memberId}::int
      RETURNING id
    `;

    if (!result || result.length === 0) {
      throw new Error('Member not found');
    }

    // Log activity
    await logTeamActivity(sql, teamId, updaterId, 'member_role_updated', 'member', memberId, {
      newRole
    });

    return true;
  } catch (error) {
    console.error('Error updating member role:', error);
    throw error;
  }
}

// Remove team member
export async function removeTeamMember(sql: SqlQuery, teamId: string, memberId: string, removerId: string) {
  try {
    // Check if remover is owner
    const isOwner = await sql`
      SELECT is_team_owner(${removerId}::int, ${teamId}::int) as "isOwner"
    `;

    if (!isOwner[0]?.isOwner) {
      throw new Error('Only team owners can remove members');
    }

    // Don't allow removing the original owner
    const team = await sql`
      SELECT owner_id FROM teams WHERE id = ${teamId}::int
    `;

    if (team[0]?.owner_id === parseInt(memberId)) {
      throw new Error('Cannot remove the team owner');
    }

    const result = await sql`
      DELETE FROM team_members
      WHERE team_id = ${teamId}::int AND user_id = ${memberId}::int
      RETURNING id
    `;

    if (!result || result.length === 0) {
      throw new Error('Member not found');
    }

    // Log activity
    await logTeamActivity(sql, teamId, removerId, 'member_removed', 'member', memberId);

    return true;
  } catch (error) {
    console.error('Error removing team member:', error);
    throw error;
  }
}

// Associate pitch with team
export async function addPitchToTeam(sql: SqlQuery, teamId: string, pitchId: string, userId: string) {
  try {
    // Check if user is team member with edit permissions
    const hasPermission = await sql`
      SELECT 1 FROM team_members
      WHERE team_id = ${teamId}::int
        AND user_id = ${userId}::int
        AND role IN ('owner', 'editor')
    `;

    if (!hasPermission || hasPermission.length === 0) {
      throw new Error('You do not have permission to add pitches to this team');
    }

    const result = await sql`
      INSERT INTO team_pitches (team_id, pitch_id, added_by)
      VALUES (${teamId}::int, ${pitchId}::int, ${userId}::int)
      ON CONFLICT (team_id, pitch_id) DO NOTHING
      RETURNING id
    `;

    if (result && result.length > 0) {
      // Log activity
      await logTeamActivity(sql, teamId, userId, 'pitch_added', 'pitch', pitchId);
    }

    return true;
  } catch (error) {
    console.error('Error adding pitch to team:', error);
    throw error;
  }
}

// Remove pitch from team
export async function removePitchFromTeam(sql: SqlQuery, teamId: string, pitchId: string, userId: string) {
  try {
    // Check if user has permission
    const hasPermission = await sql`
      SELECT 1 FROM team_members
      WHERE team_id = ${teamId}::int
        AND user_id = ${userId}::int
        AND role IN ('owner', 'editor')
    `;

    if (!hasPermission || hasPermission.length === 0) {
      throw new Error('You do not have permission to remove pitches from this team');
    }

    const result = await sql`
      DELETE FROM team_pitches
      WHERE team_id = ${teamId}::int AND pitch_id = ${pitchId}::int
      RETURNING id
    `;

    if (result && result.length > 0) {
      // Log activity
      await logTeamActivity(sql, teamId, userId, 'pitch_removed', 'pitch', pitchId);
    }

    return true;
  } catch (error) {
    console.error('Error removing pitch from team:', error);
    throw error;
  }
}

// Get team activity log
export async function getTeamActivity(sql: SqlQuery, teamId: string, limit: number = 50) {
  try {
    const activities = await sql`
      SELECT 
        ta.id,
        ta.action,
        ta.entity_type as "entityType",
        ta.entity_id as "entityId",
        ta.metadata,
        ta.created_at as "createdAt",
        u.username as "userName",
        u.profile_image as "userAvatar"
      FROM team_activity ta
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE ta.team_id = ${teamId}::int
      ORDER BY ta.created_at DESC
      LIMIT ${limit}
    `;

    return activities;
  } catch (error) {
    console.error('Error fetching team activity:', error);
    return [];
  }
}

// Helper function to log team activity
async function logTeamActivity(
  sql: SqlQuery, 
  teamId: string | number, 
  userId: string | number | null, 
  action: string, 
  entityType?: string, 
  entityId?: string | number,
  metadata?: any
) {
  try {
    await sql`
      INSERT INTO team_activity (
        team_id, user_id, action, entity_type, entity_id, metadata
      ) VALUES (
        ${teamId}::int,
        ${userId ? userId + '::int' : null},
        ${action},
        ${entityType || null},
        ${entityId ? entityId + '::int' : null},
        ${metadata ? JSON.stringify(metadata) : '{}'}::jsonb
      )
    `;
  } catch (error) {
    console.error('Error logging team activity:', error);
    // Don't throw, logging failures shouldn't break operations
  }
}

// Resend team invitation (reset status and extend expiry)
export async function resendInvitation(sql: SqlQuery, invitationId: string, userId: string) {
  try {
    // Verify the user is an owner/editor of the team this invitation belongs to
    const invite = await sql`
      SELECT ti.id, ti.team_id
      FROM team_invitations ti
      JOIN team_members tm ON ti.team_id = tm.team_id
      WHERE ti.id = ${invitationId}::int
        AND tm.user_id = ${userId}::int
        AND tm.role IN ('owner', 'editor')
    `;

    if (!invite || invite.length === 0) {
      throw new Error('Invitation not found or you do not have permission');
    }

    const result = await sql`
      UPDATE team_invitations
      SET status = 'pending',
          expires_at = NOW() + INTERVAL '7 days',
          created_at = NOW()
      WHERE id = ${invitationId}::int
      RETURNING
        id,
        team_id as "teamId",
        invited_email as "invitedEmail",
        invited_by as "invitedBy",
        role,
        status,
        message,
        token,
        created_at as "createdAt",
        expires_at as "expiresAt"
    `;

    if (!result || result.length === 0) {
      throw new Error('Failed to resend invitation');
    }

    await logTeamActivity(sql, invite[0].team_id, userId, 'invitation_resent', 'invitation', invitationId);

    return result[0];
  } catch (error) {
    console.error('Error resending invitation:', error);
    throw error;
  }
}

// Cancel (delete) a team invitation
export async function cancelInvitation(sql: SqlQuery, invitationId: string, userId: string) {
  try {
    // Verify the user is an owner/editor of the team this invitation belongs to
    const invite = await sql`
      SELECT ti.id, ti.team_id
      FROM team_invitations ti
      JOIN team_members tm ON ti.team_id = tm.team_id
      WHERE ti.id = ${invitationId}::int
        AND tm.user_id = ${userId}::int
        AND tm.role IN ('owner', 'editor')
    `;

    if (!invite || invite.length === 0) {
      throw new Error('Invitation not found or you do not have permission');
    }

    await sql`
      DELETE FROM team_invitations
      WHERE id = ${invitationId}::int
    `;

    await logTeamActivity(sql, invite[0].team_id, userId, 'invitation_cancelled', 'invitation', invitationId);

    return true;
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    throw error;
  }
}

// Check if user can access team
export async function canAccessTeam(sql: SqlQuery, userId: string, teamId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 
        t.visibility,
        is_team_member(${userId}::int, ${teamId}::int) as "isMember"
      FROM teams t
      WHERE t.id = ${teamId}::int
    `;

    if (!result || result.length === 0) {
      return false;
    }

    const team = result[0];
    return team.visibility === 'public' || team.isMember;
  } catch (error) {
    console.error('Error checking team access:', error);
    return false;
  }
}