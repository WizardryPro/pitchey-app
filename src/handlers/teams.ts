/**
 * Team Management API Handlers
 * Complete implementation for team collaboration features
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import * as teamQueries from '../db/queries/teams';
import { verifyAuth } from '../utils/auth';
import { sendTeamInviteEmail } from '../services/email/index';

// GET /api/teams - Get user's teams
export async function getTeamsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const teams = await teamQueries.getUserTeams(sql, authResult.user.id.toString());

    return new Response(JSON.stringify({
      success: true,
      data: {
        teams
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Get teams error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch teams' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/teams/:id - Get team details
export async function getTeamByIdHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract team ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const teamId = pathParts[pathParts.indexOf('teams') + 1];

    if (!teamId || teamId === 'invites') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const team = await teamQueries.getTeamById(sql, teamId, authResult.user.id.toString());

    if (!team) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team not found or access denied' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        team
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Get team by ID error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch team' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST /api/teams - Create new team
export async function createTeamHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const { name, description, visibility } = body;

    if (!name) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team name is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const team = await teamQueries.createTeam(sql, {
      name,
      description,
      ownerId: authResult.user.id.toString(),
      visibility: visibility || 'private'
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        team
      }
    }), {
      status: 201,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Create team error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to create team' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// PUT /api/teams/:id - Update team
export async function updateTeamHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract team ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const teamId = pathParts[pathParts.indexOf('teams') + 1];

    if (!teamId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const sql = getDb(env);
    
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const team = await teamQueries.updateTeam(
      sql, 
      teamId, 
      authResult.user.id.toString(), 
      body
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        team
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Update team error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to update team' 
    }), {
      status: error.message?.includes('permission') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// DELETE /api/teams/:id - Delete team
export async function deleteTeamHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract team ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const teamId = pathParts[pathParts.indexOf('teams') + 1];

    if (!teamId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await teamQueries.deleteTeam(sql, teamId, authResult.user.id.toString());

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Team deleted successfully'
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Delete team error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to delete team' 
    }), {
      status: error.message?.includes('owner') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST /api/teams/:id/invite - Send team invitation
export async function inviteToTeamHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract team ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const teamId = pathParts[pathParts.indexOf('teams') + 1];

    if (!teamId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const { email, role, message } = body;

    if (!email) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const invitation = await teamQueries.inviteToTeam(
      sql,
      teamId,
      authResult.user.id.toString(),
      {
        email,
        role: role || 'viewer',
        message
      }
    );

    // Send invite email (fire-and-forget — don't block invitation creation)
    try {
      const team = await teamQueries.getTeamById(sql, teamId, authResult.user.id.toString());
      const teamName = team?.name || 'a team';
      const inviterName = authResult.user.name || authResult.user.email;
      const acceptUrl = `https://pitchey.com/teams/invites/${invitation.token || invitation.id}`;

      sendTeamInviteEmail(email as string, {
        inviterName,
        teamName,
        role: (role as string) || 'viewer',
        message: message as string | undefined,
        acceptUrl
      }, (env as any).RESEND_API_KEY).catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to send team invite email:', e.message);
      });
    } catch (emailErr: unknown) {
      const e = emailErr instanceof Error ? emailErr : new Error(String(emailErr));
      console.error('Failed to prepare team invite email:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        invitation
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Invite to team error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to send invitation' 
    }), {
      status: error.message?.includes('permission') ? 403 : 
              error.message?.includes('already') ? 400 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/teams/invites - Get user's pending invitations
export async function getInvitationsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const invites = await teamQueries.getUserInvitations(sql, authResult.user.email);

    return new Response(JSON.stringify({
      success: true,
      data: {
        invites
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=30',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch invitations' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST /api/teams/invites/:id/accept - Accept invitation
export async function acceptInvitationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract invitation ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const inviteId = pathParts[pathParts.indexOf('invites') + 1];

    if (!inviteId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invitation ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await teamQueries.acceptInvitation(
      sql, 
      inviteId, 
      authResult.user.id.toString(),
      authResult.user.email
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Invitation accepted successfully'
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to accept invitation' 
    }), {
      status: error.message?.includes('Invalid') ? 400 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST /api/teams/invites/:id/reject - Reject invitation
export async function rejectInvitationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract invitation ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const inviteId = pathParts[pathParts.indexOf('invites') + 1];

    if (!inviteId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invitation ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await teamQueries.rejectInvitation(sql, inviteId, authResult.user.email);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Invitation rejected successfully'
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Reject invitation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to reject invitation' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// PUT /api/teams/:teamId/members/:memberId - Update member role
export async function updateMemberRoleHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract IDs from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const teamId = pathParts[pathParts.indexOf('teams') + 1];
    const memberId = pathParts[pathParts.indexOf('members') + 1];

    if (!teamId || !memberId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team ID and member ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const { role } = body;

    if (!role) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Role is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await teamQueries.updateMemberRole(
      sql, 
      teamId, 
      memberId, 
      authResult.user.id.toString(), 
      role
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Member role updated successfully'
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Update member role error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to update member role' 
    }), {
      status: error.message?.includes('owner') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST /api/teams/invites/:id/resend - Resend invitation
export async function resendInvitationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const inviteId = pathParts[pathParts.indexOf('invites') + 1];

    if (!inviteId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invitation ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database unavailable'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const invitation = await teamQueries.resendInvitation(sql, inviteId, authResult.user.id.toString());

    return new Response(JSON.stringify({
      success: true,
      data: { invitation }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    console.error('Resend invitation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to resend invitation'
    }), {
      status: error.message?.includes('permission') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// DELETE /api/teams/invites/:id - Cancel invitation
export async function cancelInvitationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const inviteId = pathParts[pathParts.indexOf('invites') + 1];

    if (!inviteId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invitation ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database unavailable'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await teamQueries.cancelInvitation(sql, inviteId, authResult.user.id.toString());

    return new Response(JSON.stringify({
      success: true,
      data: { message: 'Invitation cancelled successfully' }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    console.error('Cancel invitation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to cancel invitation'
    }), {
      status: error.message?.includes('permission') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// DELETE /api/teams/:teamId/members/:memberId - Remove team member
export async function removeTeamMemberHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Extract IDs from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const teamId = pathParts[pathParts.indexOf('teams') + 1];
    const memberId = pathParts[pathParts.indexOf('members') + 1];

    if (!teamId || !memberId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Team ID and member ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database unavailable' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await teamQueries.removeTeamMember(
      sql, 
      teamId, 
      memberId, 
      authResult.user.id.toString()
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Member removed successfully'
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Remove team member error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to remove team member' 
    }), {
      status: error.message?.includes('owner') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}