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

    const teams = await teamQueries.getUserTeams(sql as any, authResult.user.id.toString());

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

    const team = await teamQueries.getTeamById(sql as any, teamId, authResult.user.id.toString());

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

    const team = await teamQueries.createTeam(sql as any, {
      name: name as string,
      description: description as string | undefined,
      ownerId: authResult.user.id.toString(),
      visibility: (visibility as 'public' | 'private' | 'team' | undefined) || 'private'
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
      sql as any,
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

    await teamQueries.deleteTeam(sql as any, teamId, authResult.user.id.toString());

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
      sql as any,
      teamId,
      authResult.user.id.toString(),
      {
        email: email as string,
        role: ((role as string) || 'viewer') as 'viewer' | 'editor',
        message: message as string | undefined
      }
    );

    // Send invite email (fire-and-forget — don't block invitation creation)
    try {
      const team = await teamQueries.getTeamById(sql as any, teamId, authResult.user.id.toString());
      const teamName = team?.name || 'a team';
      const inviterName = (authResult.user as any).name || authResult.user.email;
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

    const invites = await teamQueries.getUserInvitations(sql as any, authResult.user.email);

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
      sql as any,
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

    await teamQueries.rejectInvitation(sql as any, inviteId, authResult.user.email);

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
      sql as any,
      teamId,
      memberId,
      authResult.user.id.toString(),
      role as string
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

    const invitation = await teamQueries.resendInvitation(sql as any, inviteId, authResult.user.id.toString());

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

    await teamQueries.cancelInvitation(sql as any, inviteId, authResult.user.id.toString());

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
      sql as any,
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

// ────────────────────────────────────────────────────────────────────────────
// B3: Company-team join codes (migration 097)
// A production company shares a reusable join code; a creator redeems it to
// become a seated 'member' of the company team, gaining Team/Notes access
// without a per-pitch NDA. See docs/sessions/2026-06-04-production-sprint-scope.md §3.
// ────────────────────────────────────────────────────────────────────────────

// Crockford-ish alphabet — no O/0/I/1/L/U to avoid confusion when shared verbally.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
function generateJoinCode(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  return out;
}

function teamIdFromUrl(request: Request): string | null {
  const parts = new URL(request.url).pathname.split('/');
  const i = parts.indexOf('teams');
  const id = i >= 0 ? parts[i + 1] : null;
  return id && id !== 'invites' && id !== 'join' ? id : null;
}

// POST /api/teams/:id/generate-code — owner (production) generates/rotates an 8-char code.
export async function generateTeamJoinCodeHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const teamId = teamIdFromUrl(request);
    if (!teamId) return json({ success: false, error: 'Team ID required' }, 400);
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: false, error: 'Database unavailable' }, 503);

    const [team] = await sql`SELECT id, owner_id, seat_limit FROM teams WHERE id = ${teamId}`;
    if (!team) return json({ success: false, error: 'Team not found' }, 404);
    if (String(team.owner_id) !== String(auth.user.id)) return json({ success: false, error: 'Only the team owner can manage the join code' }, 403);
    const [me] = await sql`SELECT user_type FROM users WHERE id = ${auth.user.id}`;
    if (me?.user_type !== 'production') return json({ success: false, error: 'Only production companies can share join codes' }, 403);

    // Generate a unique code (retry on the rare unique-index collision).
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateJoinCode();
      try {
        await sql`UPDATE teams SET join_code = ${code}, is_company_team = true WHERE id = ${teamId}`;
        break;
      } catch (e) {
        if (attempt === 4) throw e; // give up after 5 tries
        code = '';
      }
    }
    const [seats] = await sql`SELECT count(*)::int AS used FROM team_members WHERE team_id = ${teamId} AND role = 'member'`;
    return json({ success: true, data: { code, seatLimit: team.seat_limit, seatsUsed: seats?.used ?? 0 } });
  } catch (error) {
    console.error('generate join code error:', error);
    return json({ success: false, error: 'Failed to generate join code' }, 500);
  }
}

// GET /api/teams/:id/code — owner reads the current code + seat usage.
export async function getTeamJoinCodeHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const teamId = teamIdFromUrl(request);
    if (!teamId) return json({ success: false, error: 'Team ID required' }, 400);
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: false, error: 'Database unavailable' }, 503);

    const [team] = await sql`SELECT id, owner_id, join_code, seat_limit FROM teams WHERE id = ${teamId}`;
    if (!team) return json({ success: false, error: 'Team not found' }, 404);
    if (String(team.owner_id) !== String(auth.user.id)) return json({ success: false, error: 'Only the team owner can view the join code' }, 403);
    const [seats] = await sql`SELECT count(*)::int AS used FROM team_members WHERE team_id = ${teamId} AND role = 'member'`;
    return json({ success: true, data: { code: team.join_code ?? null, seatLimit: team.seat_limit, seatsUsed: seats?.used ?? 0 } });
  } catch (error) {
    console.error('get join code error:', error);
    return json({ success: false, error: 'Failed to read join code' }, 500);
  }
}

// DELETE /api/teams/:id/code — owner revokes (nullifies) the code without rotating.
export async function revokeTeamJoinCodeHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const teamId = teamIdFromUrl(request);
    if (!teamId) return json({ success: false, error: 'Team ID required' }, 400);
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: false, error: 'Database unavailable' }, 503);

    const [team] = await sql`SELECT id, owner_id FROM teams WHERE id = ${teamId}`;
    if (!team) return json({ success: false, error: 'Team not found' }, 404);
    if (String(team.owner_id) !== String(auth.user.id)) return json({ success: false, error: 'Only the team owner can revoke the join code' }, 403);
    await sql`UPDATE teams SET join_code = NULL WHERE id = ${teamId}`;
    return json({ success: true, data: { code: null } });
  } catch (error) {
    console.error('revoke join code error:', error);
    return json({ success: false, error: 'Failed to revoke join code' }, 500);
  }
}

// POST /api/teams/join — a creator redeems a code to become a seated member.
export async function joinTeamByCodeHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const body = await request.json().catch(() => ({})) as { code?: string };
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return json({ success: false, error: 'Join code required' }, 400);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: false, error: 'Database unavailable' }, 503);

    const [me] = await sql`SELECT user_type FROM users WHERE id = ${auth.user.id}`;
    if (me?.user_type !== 'creator') return json({ success: false, error: 'Only creators can join a production company' }, 403);

    const [team] = await sql`SELECT id, name, seat_limit FROM teams WHERE join_code = ${code} AND is_company_team = true`;
    if (!team) return json({ success: false, error: 'Invalid or expired join code' }, 404);

    const [existing] = await sql`SELECT id FROM team_members WHERE team_id = ${team.id} AND user_id = ${auth.user.id}`;
    if (existing) return json({ success: false, error: 'You are already a member of this company' }, 409);

    // Seat-guarded insert: the WHERE re-checks the live member count at execution
    // time. The UNIQUE(team_id,user_id) constraint backstops any concurrent dupe.
    let inserted;
    try {
      inserted = await sql`
        INSERT INTO team_members (team_id, user_id, role, invited_via_code, joined_at)
        SELECT ${team.id}, ${auth.user.id}, 'member', ${code}, now()
        WHERE (SELECT count(*) FROM team_members WHERE team_id = ${team.id} AND role = 'member') < ${team.seat_limit}
        RETURNING id`;
    } catch (e) {
      // unique violation → raced into an existing membership
      return json({ success: false, error: 'You are already a member of this company' }, 409);
    }
    if (!inserted || inserted.length === 0) return json({ success: false, error: 'This company has no seats available' }, 403);
    return json({ success: true, data: { teamId: team.id, teamName: team.name } });
  } catch (error) {
    console.error('join team by code error:', error);
    return json({ success: false, error: 'Failed to join company' }, 500);
  }
}