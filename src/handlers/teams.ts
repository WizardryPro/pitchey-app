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
    let body: { code?: string } = {};
    try { body = (await request.json()) as { code?: string }; } catch { /* empty/invalid body → 'code required' below */ }
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
// ---------------------------------------------------------------------------
// B3 creator-side surfaces: reach the company workspaces you've joined +
// auto-list collaborators (so the "team" of people surfaces without manual entry).
// ---------------------------------------------------------------------------

/**
 * GET /api/creator/collaborations
 * For a creator who joined production companies via a code: the companies they're
 * a seated member of + each company's pitches (the projects they can collaborate
 * on). This is the entry point so a joined creator can actually reach the shared
 * workspace — without it the join code led to a dead end.
 */
export async function getCreatorCollaborationsHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: true, data: { companies: [] } });
    const me = auth.user.id;

    // Match what actually grants workspace access (resolveWorkspace): a seated
    // role on a team owned by a production company. Not gated on is_company_team
    // (inconsistent across legacy teams) nor role='member' only (editors too).
    const teams = await sql`
      SELECT DISTINCT t.id AS team_id, t.name AS team_name, t.owner_id,
             COALESCE(u.company_name, u.name, u.username, u.email) AS company
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      JOIN users u ON u.id = t.owner_id
      WHERE tm.user_id = ${me} AND tm.role IN ('member','editor') AND u.user_type = 'production'
      ORDER BY t.id DESC`;

    const companies = [];
    for (const t of teams) {
      const pitches = await sql`
        SELECT id, title, COALESCE(thumbnail_url, title_image) AS poster, genre, format, status
        FROM pitches WHERE user_id = ${t.owner_id}
        ORDER BY updated_at DESC NULLS LAST LIMIT 50`;
      // Has this creator signed the company's collaboration NDA? (table may not
      // exist pre-migration → treat as not signed.)
      let ndaSigned = false;
      try {
        const [sig] = await sql`
          SELECT 1 FROM company_nda_signatures
          WHERE team_id = ${t.team_id} AND signer_id = ${me} AND status = 'signed' LIMIT 1`;
        ndaSigned = !!sig;
      } catch { /* pre-migration */ }
      companies.push({
        teamId: t.team_id, name: t.team_name, company: t.company, ownerId: t.owner_id, ndaSigned,
        pitches: pitches.map((p: any) => ({ id: p.id, title: p.title, poster: p.poster, genre: p.genre, format: p.format, status: p.status })),
      });
    }
    return json({ success: true, data: { companies } });
  } catch {
    return json({ success: true, data: { companies: [] } }); // degrade quietly
  }
}

/**
 * GET /api/production/pitches/:pitchId/collaborators
 * The people with workspace access on this (production-owned) pitch = the owner +
 * seated company members. Auto-populated from team_members — the "team" of
 * collaborators surfaces without anyone typing it into the creative roster.
 */
export async function getPitchCollaboratorsHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: true, data: { collaborators: [] } });

    const parts = new URL(request.url).pathname.split('/');
    const pitchId = parseInt(parts[4] || '0', 10);
    if (!pitchId) return json({ success: false, error: 'Invalid pitch ID' }, 400);

    const [pitch] = await sql`SELECT user_id FROM pitches WHERE id = ${pitchId}`;
    if (!pitch) return json({ success: true, data: { collaborators: [] } });
    const ownerId = pitch.user_id;

    // Only collaborators of this company (owner or seated members) may see the roster.
    const me = auth.user.id;
    const isOwner = String(me) === String(ownerId);
    let isMember = false;
    if (!isOwner) {
      const m = await sql`
        SELECT 1 FROM team_members tm JOIN teams t ON t.id = tm.team_id
        WHERE t.owner_id = ${ownerId} AND tm.user_id = ${me} AND tm.role IN ('owner','editor','member') LIMIT 1`;
      isMember = m.length > 0;
    }
    if (!isOwner && !isMember) return json({ success: true, data: { collaborators: [] } });

    const owner = await sql`SELECT id, COALESCE(name, username, email) AS name, user_type FROM users WHERE id = ${ownerId}`;
    const members = await sql`
      SELECT u.id, COALESCE(u.name, u.username, u.email) AS name, u.user_type, tm.joined_at
      FROM team_members tm JOIN teams t ON t.id = tm.team_id JOIN users u ON u.id = tm.user_id
      WHERE t.owner_id = ${ownerId} AND tm.role IN ('member','editor') AND u.id <> ${ownerId}
      ORDER BY tm.joined_at ASC NULLS LAST`;

    const collaborators = [
      ...owner.map((o: any) => ({ id: o.id, name: o.name, userType: o.user_type, role: 'owner' })),
      ...members.map((m: any) => ({ id: m.id, name: m.name, userType: m.user_type, role: 'member' })),
    ];
    return json({ success: true, data: { collaborators } });
  } catch {
    return json({ success: true, data: { collaborators: [] } });
  }
}

// ---------------------------------------------------------------------------
// Collaboration NDA (B3): a creator signs the company's Platform Standard NDA.
// Company-scoped (one signature per team+signer), separate from the pitch-scoped
// `ndas` table. See docs/sessions/2026-06-05-collaboration-nda-scope.md.
// ---------------------------------------------------------------------------

const COLLAB_NDA_VERSION = 'pitchey-standard-v1';

/**
 * GET /api/teams/:id/collaboration-nda
 * Returns the acting user's collaboration-NDA status for this company team.
 * The NDA *text* is fetched separately from /api/ndas/standard (company autofill).
 */
export async function getCompanyNdaStatusHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: true, data: { signed: false } });

    const parts = new URL(request.url).pathname.split('/');
    const teamId = parseInt(parts[3] || '0', 10);
    if (!teamId) return json({ success: false, error: 'Invalid team ID' }, 400);

    const [team] = await sql`SELECT id, name, owner_id FROM teams WHERE id = ${teamId}`;
    if (!team) return json({ success: false, error: 'Team not found' }, 404);

    const [sig] = await sql`
      SELECT signed_at, nda_version, status FROM company_nda_signatures
      WHERE team_id = ${teamId} AND signer_id = ${auth.user.id} AND status = 'signed' LIMIT 1`;

    return json({ success: true, data: {
      teamId, company: team.name,
      signed: !!sig,
      signedAt: sig?.signed_at ?? null,
      ndaVersion: sig?.nda_version ?? COLLAB_NDA_VERSION,
    } });
  } catch {
    return json({ success: true, data: { signed: false } });
  }
}

/**
 * POST /api/teams/:id/collaboration-nda/sign
 * Body: { agreed: true, name, address? }. Records the creator's click-to-sign
 * signature (captures IP/UA). Idempotent on (team_id, signer_id). Caller must be
 * a seated member of the team.
 */
export async function signCompanyNdaHandler(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.success || !auth.user) return json({ success: false, error: 'Unauthorized' }, 401);
    const sql = getDb(env) as any;
    if (!sql) return json({ success: false, error: 'Database unavailable' }, 503);

    const parts = new URL(request.url).pathname.split('/');
    const teamId = parseInt(parts[3] || '0', 10);
    if (!teamId) return json({ success: false, error: 'Invalid team ID' }, 400);

    let body: { agreed?: boolean; name?: string; address?: string } = {};
    try { body = (await request.json()) as typeof body; } catch { /* validated below */ }
    if (body.agreed !== true) return json({ success: false, error: 'You must agree to the NDA terms' }, 400);
    const signedName = (body.name || '').trim();
    if (!signedName) return json({ success: false, error: 'Full legal name is required' }, 400);

    // Caller must be a seated member of this team.
    const [member] = await sql`
      SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${auth.user.id} AND role IN ('member','editor') LIMIT 1`;
    if (!member) return json({ success: false, error: 'You are not a member of this company' }, 403);

    const ip = request.headers.get('CF-Connecting-IP') || null;
    const ua = request.headers.get('User-Agent') || null;
    const sigData = JSON.stringify({ agreed: true });

    const [row] = await sql`
      INSERT INTO company_nda_signatures
        (team_id, signer_id, nda_version, signed_name, signed_address, ip_address, user_agent, signature_data)
      VALUES (${teamId}, ${auth.user.id}, ${COLLAB_NDA_VERSION}, ${signedName}, ${body.address || null}, ${ip}, ${ua}, ${sigData}::jsonb)
      ON CONFLICT (team_id, signer_id) DO UPDATE SET status = 'signed'
      RETURNING signed_at`;

    return json({ success: true, data: { signed: true, signedAt: row?.signed_at } });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    return json({ success: false, error: e.message }, 500);
  }
}
