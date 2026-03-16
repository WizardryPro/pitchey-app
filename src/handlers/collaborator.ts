/**
 * Project Collaborator Handlers
 * Invitation management, acceptance, and scoped project access for collaborators.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getAuthenticatedUser, getUserId } from '../utils/auth-extract';
import { sendCollaboratorInviteEmail, sendCollaboratorAcceptedEmail } from '../services/email/index';

const VALID_ROLES = ['director', 'line_producer', 'dp', 'production_designer', 'editor', 'sound_designer', 'custom'] as const;
const VALID_NOTE_CATEGORIES = ['casting', 'location', 'budget', 'schedule', 'team', 'general'] as const;

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function extractPathParam(request: Request, index: number): string {
  const url = new URL(request.url);
  return url.pathname.split('/')[index] || '';
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function verifyProjectOwnership(
  sql: ReturnType<typeof getDb>,
  projectId: number,
  userId: number
): Promise<boolean> {
  if (!sql) return false;
  const result = await sql`
    SELECT 1 FROM production_pipeline
    WHERE id = ${projectId} AND production_company_id = ${userId}
  `;
  return result.length > 0;
}

async function isActiveCollaborator(
  sql: ReturnType<typeof getDb>,
  projectId: number,
  userId: number
): Promise<{ active: boolean; role: string | null }> {
  if (!sql) return { active: false, role: null };
  const result = await sql`
    SELECT role FROM project_collaborators
    WHERE project_id = ${projectId} AND user_id = ${userId} AND status = 'active'
  `;
  if (result.length > 0) return { active: true, role: result[0].role };
  return { active: false, role: null };
}

async function logActivity(
  sql: ReturnType<typeof getDb>,
  projectId: number,
  userId: number,
  action: string,
  entityId?: number
) {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO collaborator_activity_log (project_id, user_id, action, entity_id)
      VALUES (${projectId}, ${userId}, ${action}, ${entityId ?? null})
    `;
  } catch {
    // Fire and forget
  }
}

// ---------------------------------------------------------------------------
// Invitation Endpoints (Production Company Side)
// ---------------------------------------------------------------------------

/**
 * POST /api/projects/:projectId/collaborators/invite
 */
export async function inviteCollaborator(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 3), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const isOwner = await verifyProjectOwnership(sql, projectId, Number(userId));
    if (!isOwner) return errorResponse('Forbidden: not project owner', origin, 403);

    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role : '';
    const customRoleName = typeof body.custom_role_name === 'string' ? body.custom_role_name.trim() : null;

    if (!email || !email.includes('@')) return errorResponse('Valid email is required', origin);
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return errorResponse(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, origin);
    }
    if (role === 'custom' && !customRoleName) {
      return errorResponse('custom_role_name is required when role is custom', origin);
    }
    if (role !== 'custom' && customRoleName) {
      return errorResponse('custom_role_name must be null when role is not custom', origin);
    }

    // Check for existing active/pending collaborator
    const existing = await sql`
      SELECT id, status FROM project_collaborators
      WHERE project_id = ${projectId} AND invited_email = ${email} AND status IN ('pending', 'active')
    `;
    if (existing.length > 0) {
      return errorResponse(`Collaborator with this email already ${existing[0].status} on this project`, origin, 409);
    }

    // Rate limit: max 20 invites per project per day
    const todayCount = await sql`
      SELECT COUNT(*)::int as cnt FROM project_collaborators
      WHERE project_id = ${projectId} AND invited_at > NOW() - INTERVAL '24 hours'
    `;
    if (todayCount[0]?.cnt >= 20) {
      return errorResponse('Maximum 20 invitations per project per day', origin, 429);
    }

    const token = generateToken();

    // Check if invitee already has an account
    const existingUser = await sql`
      SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1
    `;
    const inviteeUserId = existingUser.length > 0 ? existingUser[0].id : null;

    const result = await sql`
      INSERT INTO project_collaborators (project_id, user_id, invited_email, role, custom_role_name, invited_by, invite_token)
      VALUES (${projectId}, ${inviteeUserId}, ${email}, ${role}, ${customRoleName}, ${Number(userId)}, ${token})
      RETURNING id, project_id, user_id, invited_email, role, custom_role_name, status, invited_at, invite_token
    `;

    await logActivity(sql, projectId, Number(userId), 'collaborator_invited', result[0].id);

    // Send invite email (fire-and-forget)
    const projectInfo = await sql`SELECT title FROM production_pipeline WHERE id = ${projectId}`;
    const inviterInfo = await sql`SELECT name, company_name FROM users WHERE id = ${Number(userId)}`;
    const roleLabel = role === 'custom' ? (customRoleName || 'Collaborator') : role.replace(/_/g, ' ');
    sendCollaboratorInviteEmail(email, {
      inviterName: inviterInfo[0]?.name || inviterInfo[0]?.company_name || 'A production company',
      companyName: inviterInfo[0]?.company_name || inviterInfo[0]?.name || 'Pitchey',
      role: roleLabel,
      projectTitle: projectInfo[0]?.title || 'Untitled Project',
      acceptUrl: `https://pitchey.com/collaborate/accept?token=${token}`,
    }, (env as Record<string, unknown>).RESEND_API_KEY as string).catch((err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to send collaborator invite email:', e.message);
    });

    return jsonResponse({ success: true, data: { collaborator: result[0] } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('inviteCollaborator error:', e.message);
    return errorResponse('Failed to send invitation', origin, 500);
  }
}

/**
 * GET /api/projects/:projectId/collaborators
 */
export async function listCollaborators(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 3), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { collaborators: [] } }, origin);

  try {
    const isOwner = await verifyProjectOwnership(sql, projectId, Number(userId));
    const collab = await isActiveCollaborator(sql, projectId, Number(userId));
    if (!isOwner && !collab.active) return errorResponse('Forbidden', origin, 403);

    const collaborators = await sql`
      SELECT pc.id, pc.user_id, pc.invited_email, pc.role, pc.custom_role_name,
             pc.status, pc.invited_at, pc.accepted_at,
             u.first_name, u.last_name, u.name as display_name, u.avatar_url, u.profile_image_url
      FROM project_collaborators pc
      LEFT JOIN users u ON pc.user_id = u.id
      WHERE pc.project_id = ${projectId} AND pc.status != 'removed'
      ORDER BY pc.invited_at DESC
    `;

    const mapped = collaborators.map(c => ({
      id: c.id,
      user_id: c.user_id,
      invited_email: c.invited_email,
      role: c.role,
      custom_role_name: c.custom_role_name,
      status: c.status,
      user: c.user_id ? {
        name: c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.invited_email.split('@')[0],
        avatar_url: c.avatar_url || c.profile_image_url || null,
      } : null,
      invited_at: c.invited_at,
      accepted_at: c.accepted_at,
    }));

    return jsonResponse({ success: true, data: { collaborators: mapped } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('listCollaborators error:', e.message);
    return jsonResponse({ success: true, data: { collaborators: [] } }, origin);
  }
}

/**
 * DELETE /api/projects/:projectId/collaborators/:collaboratorId
 */
export async function removeCollaborator(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 3), 10);
  const collaboratorId = parseInt(extractPathParam(request, 5), 10);
  if (!projectId || !collaboratorId) return errorResponse('Invalid IDs', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const isOwner = await verifyProjectOwnership(sql, projectId, Number(userId));
    if (!isOwner) return errorResponse('Forbidden: not project owner', origin, 403);

    const result = await sql`
      UPDATE project_collaborators
      SET status = 'removed', removed_at = NOW()
      WHERE id = ${collaboratorId} AND project_id = ${projectId} AND status != 'removed'
      RETURNING id
    `;

    if (result.length === 0) return errorResponse('Collaborator not found', origin, 404);

    await logActivity(sql, projectId, Number(userId), 'collaborator_removed', collaboratorId);
    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('removeCollaborator error:', e.message);
    return errorResponse('Failed to remove collaborator', origin, 500);
  }
}

/**
 * PATCH /api/projects/:projectId/collaborators/:collaboratorId
 */
export async function updateCollaboratorRole(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 3), 10);
  const collaboratorId = parseInt(extractPathParam(request, 5), 10);
  if (!projectId || !collaboratorId) return errorResponse('Invalid IDs', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const isOwner = await verifyProjectOwnership(sql, projectId, Number(userId));
    if (!isOwner) return errorResponse('Forbidden: not project owner', origin, 403);

    const body = await request.json() as Record<string, unknown>;
    const role = typeof body.role === 'string' ? body.role : '';
    const customRoleName = typeof body.custom_role_name === 'string' ? body.custom_role_name.trim() : null;

    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      return errorResponse(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, origin);
    }
    if (role === 'custom' && !customRoleName) {
      return errorResponse('custom_role_name required for custom role', origin);
    }

    const result = await sql`
      UPDATE project_collaborators
      SET role = ${role}, custom_role_name = ${role === 'custom' ? customRoleName : null}
      WHERE id = ${collaboratorId} AND project_id = ${projectId} AND status != 'removed'
      RETURNING id, role, custom_role_name
    `;

    if (result.length === 0) return errorResponse('Collaborator not found', origin, 404);

    return jsonResponse({ success: true, data: { collaborator: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateCollaboratorRole error:', e.message);
    return errorResponse('Failed to update role', origin, 500);
  }
}

/**
 * POST /api/projects/:projectId/collaborators/:collaboratorId/resend
 */
export async function resendInvite(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 3), 10);
  const collaboratorId = parseInt(extractPathParam(request, 5), 10);
  if (!projectId || !collaboratorId) return errorResponse('Invalid IDs', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const isOwner = await verifyProjectOwnership(sql, projectId, Number(userId));
    if (!isOwner) return errorResponse('Forbidden: not project owner', origin, 403);

    // Check if pending and rate limit (1 per 5 min)
    const collab = await sql`
      SELECT id, invited_at FROM project_collaborators
      WHERE id = ${collaboratorId} AND project_id = ${projectId} AND status = 'pending'
    `;
    if (collab.length === 0) return errorResponse('Pending invitation not found', origin, 404);

    const lastInvited = new Date(collab[0].invited_at);
    if (Date.now() - lastInvited.getTime() < 5 * 60 * 1000) {
      return errorResponse('Please wait 5 minutes before resending', origin, 429);
    }

    const newToken = generateToken();
    await sql`
      UPDATE project_collaborators
      SET invite_token = ${newToken}, invited_at = NOW()
      WHERE id = ${collaboratorId}
    `;

    return jsonResponse({ success: true, data: { invite_token: newToken } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('resendInvite error:', e.message);
    return errorResponse('Failed to resend invitation', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Invite Acceptance
// ---------------------------------------------------------------------------

/**
 * POST /api/collaborate/accept
 */
export async function acceptInvite(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const authResult = await getAuthenticatedUser(request, env);
  if (!authResult.authenticated || !authResult.user) {
    return errorResponse('Unauthorized', origin, 401);
  }

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) return errorResponse('Token is required', origin);

    const collab = await sql`
      SELECT pc.id, pc.project_id, pc.invited_email, pc.invited_at, pc.status,
             pp.title as project_title, pp.stage as project_stage
      FROM project_collaborators pc
      JOIN production_pipeline pp ON pc.project_id = pp.id
      WHERE pc.invite_token = ${token}
    `;

    if (collab.length === 0) return errorResponse('Invalid invitation token', origin, 404);

    const invite = collab[0];
    if (invite.status === 'active') return errorResponse('Invitation already accepted', origin, 409);
    if (invite.status === 'removed') return errorResponse('Invitation has been revoked', origin, 410);

    // Check expiry (7 days)
    const invitedAt = new Date(invite.invited_at);
    if (Date.now() - invitedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      return errorResponse('Invitation has expired', origin, 410);
    }

    // Verify email matches
    if (authResult.user.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
      return errorResponse('Email mismatch: this invitation was sent to a different email address', origin, 403);
    }

    await sql`
      UPDATE project_collaborators
      SET user_id = ${Number(authResult.user.id)}, status = 'active', accepted_at = NOW()
      WHERE id = ${invite.id}
    `;

    await logActivity(sql, invite.project_id, Number(authResult.user.id), 'invitation_accepted');

    // Notify project owner (fire-and-forget)
    const ownerInfo = await sql`
      SELECT u.email, u.name FROM production_pipeline pp
      JOIN users u ON pp.production_company_id = u.id
      WHERE pp.id = ${invite.project_id}
    `;
    if (ownerInfo.length > 0) {
      const collabRole = await sql`SELECT role, custom_role_name FROM project_collaborators WHERE id = ${invite.id}`;
      const roleName = collabRole[0]?.role === 'custom'
        ? (collabRole[0]?.custom_role_name || 'Collaborator')
        : (collabRole[0]?.role?.replace(/_/g, ' ') || 'Collaborator');
      sendCollaboratorAcceptedEmail(ownerInfo[0].email, {
        collaboratorName: authResult.user.name || authResult.user.email,
        role: roleName,
        projectTitle: invite.project_title,
        projectUrl: `https://pitchey.com/production/projects`,
      }, (env as Record<string, unknown>).RESEND_API_KEY as string).catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to send collaborator accepted email:', e.message);
      });
    }

    return jsonResponse({
      success: true,
      data: {
        project_id: invite.project_id,
        title: invite.project_title,
        stage: invite.project_stage,
      }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('acceptInvite error:', e.message);
    return errorResponse('Failed to accept invitation', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Collaborator Read Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/my/collaborations
 */
export async function getMyCollaborations(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { collaborations: [] } }, origin);

  try {
    const collaborations = await sql`
      SELECT pc.project_id, pc.role, pc.custom_role_name, pc.accepted_at,
             pp.title as project_title, pp.stage as project_stage,
             pp.completion_percentage, pp.next_milestone,
             u.name as owner_name, u.company_name as owner_company,
             u.avatar_url as owner_avatar, u.profile_image_url as owner_profile_image
      FROM project_collaborators pc
      JOIN production_pipeline pp ON pc.project_id = pp.id
      JOIN users u ON pp.production_company_id = u.id
      WHERE pc.user_id = ${Number(userId)} AND pc.status = 'active'
      ORDER BY pc.accepted_at DESC
    `;

    const mapped = collaborations.map(c => ({
      project_id: c.project_id,
      project_title: c.project_title,
      project_stage: c.project_stage,
      my_role: c.role,
      custom_role_name: c.custom_role_name,
      owner: {
        name: c.owner_company || c.owner_name || 'Unknown',
        avatar_url: c.owner_avatar || c.owner_profile_image || null,
      },
      completion_percentage: c.completion_percentage || 0,
      next_milestone: c.next_milestone,
      accepted_at: c.accepted_at,
    }));

    return jsonResponse({ success: true, data: { collaborations: mapped } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getMyCollaborations error:', e.message);
    return jsonResponse({ success: true, data: { collaborations: [] } }, origin);
  }
}

/**
 * GET /api/my/collaborations/:projectId
 */
export async function getCollaborationProject(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 4), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const collab = await isActiveCollaborator(sql, projectId, Number(userId));
    if (!collab.active) return errorResponse('Forbidden', origin, 403);

    const result = await sql`
      SELECT pp.*, u.name as owner_name, u.company_name as owner_company,
             u.avatar_url as owner_avatar, u.profile_image_url as owner_profile_image
      FROM production_pipeline pp
      JOIN users u ON pp.production_company_id = u.id
      WHERE pp.id = ${projectId}
    `;

    if (result.length === 0) return errorResponse('Project not found', origin, 404);

    const project = result[0];
    const data: Record<string, unknown> = {
      id: project.id,
      title: project.title,
      stage: project.stage,
      status: project.status,
      priority: project.priority,
      completion_percentage: project.completion_percentage,
      next_milestone: project.next_milestone,
      milestone_date: project.milestone_date,
      start_date: project.start_date,
      target_completion_date: project.target_completion_date,
      notes: project.notes,
      my_role: collab.role,
      owner: {
        name: project.owner_company || project.owner_name || 'Unknown',
        avatar_url: project.owner_avatar || project.owner_profile_image || null,
      },
    };

    // Only include budget if visibility enabled
    if (project.collaborator_budget_visible) {
      data.budget_allocated = project.budget_allocated;
      data.budget_spent = project.budget_spent;
      data.budget_remaining = project.budget_remaining;
      data.budget_visible = true;
    } else {
      data.budget_visible = false;
    }

    return jsonResponse({ success: true, data: { project: data } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getCollaborationProject error:', e.message);
    return errorResponse('Failed to load project', origin, 500);
  }
}

/**
 * GET /api/my/collaborations/:projectId/checklist
 */
export async function getCollaborationChecklist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 4), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { checklist: {} } }, origin);

  try {
    const collab = await isActiveCollaborator(sql, projectId, Number(userId));
    if (!collab.active) return errorResponse('Forbidden', origin, 403);

    // Get checklist from production_checklists (keyed by project owner)
    const pipeline = await sql`
      SELECT production_company_id FROM production_pipeline WHERE id = ${projectId}
    `;
    if (pipeline.length === 0) return errorResponse('Project not found', origin, 404);

    const result = await sql`
      SELECT checklist FROM production_checklists
      WHERE user_id = ${pipeline[0].production_company_id} AND pitch_id = ${projectId}
    `.catch(() => []);

    const checklist = result.length > 0 ? result[0].checklist : {};

    return jsonResponse({ success: true, data: { checklist, my_role: collab.role } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getCollaborationChecklist error:', e.message);
    return jsonResponse({ success: true, data: { checklist: {} } }, origin);
  }
}

/**
 * PATCH /api/my/collaborations/:projectId/checklist/:itemId
 */
export async function toggleCollaborationChecklist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 4), 10);
  const itemId = extractPathParam(request, 6);
  if (!projectId || !itemId) return errorResponse('Invalid IDs', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const collab = await isActiveCollaborator(sql, projectId, Number(userId));
    if (!collab.active) return errorResponse('Forbidden', origin, 403);

    const body = await request.json() as Record<string, unknown>;
    const completed = typeof body.completed === 'boolean' ? body.completed : false;

    // Get the project owner to find the checklist
    const pipeline = await sql`
      SELECT production_company_id FROM production_pipeline WHERE id = ${projectId}
    `;
    if (pipeline.length === 0) return errorResponse('Project not found', origin, 404);

    const ownerId = pipeline[0].production_company_id;
    const result = await sql`
      SELECT checklist FROM production_checklists
      WHERE user_id = ${ownerId} AND pitch_id = ${projectId}
    `;
    if (result.length === 0) return errorResponse('Checklist not found', origin, 404);

    const checklist = result[0].checklist as Record<string, unknown>;

    // Find and update the item — checklist is a keyed object of items
    if (!(itemId in checklist)) {
      return errorResponse('Checklist item not found', origin, 404);
    }

    const item = checklist[itemId] as Record<string, unknown>;
    item.completed = completed;
    checklist[itemId] = item;

    const checklistJson = JSON.stringify(checklist);
    await sql`
      UPDATE production_checklists
      SET checklist = ${checklistJson}::jsonb, updated_at = NOW()
      WHERE user_id = ${ownerId} AND pitch_id = ${projectId}
    `;

    await logActivity(sql, projectId, Number(userId), 'checklist_toggled', parseInt(itemId, 10) || undefined);

    return jsonResponse({ success: true, data: { item_id: itemId, completed } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('toggleCollaborationChecklist error:', e.message);
    return errorResponse('Failed to update checklist', origin, 500);
  }
}

/**
 * GET /api/my/collaborations/:projectId/notes
 */
export async function getCollaborationNotes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 4), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { notes: [] } }, origin);

  try {
    const collab = await isActiveCollaborator(sql, projectId, Number(userId));
    if (!collab.active) return errorResponse('Forbidden', origin, 403);

    // Get project owner's pitch_id for production_notes lookup
    const pipeline = await sql`
      SELECT production_company_id, pitch_id FROM production_pipeline WHERE id = ${projectId}
    `;
    if (pipeline.length === 0) return errorResponse('Project not found', origin, 404);

    // Get notes from production_notes (owner's notes) + collaborator-created notes
    const pitchId = pipeline[0].pitch_id || projectId;
    const notes = await sql`
      SELECT id, content, category, author, created_at, updated_at
      FROM production_notes
      WHERE pitch_id = ${pitchId}
      ORDER BY created_at ASC
    `.catch(() => []);

    return jsonResponse({ success: true, data: { notes } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getCollaborationNotes error:', e.message);
    return jsonResponse({ success: true, data: { notes: [] } }, origin);
  }
}

/**
 * POST /api/my/collaborations/:projectId/notes
 */
export async function addCollaborationNote(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const authResult = await getAuthenticatedUser(request, env);
  if (!authResult.authenticated || !authResult.user) {
    return errorResponse('Unauthorized', origin, 401);
  }

  const projectId = parseInt(extractPathParam(request, 4), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const collab = await isActiveCollaborator(sql, projectId, Number(authResult.user.id));
    if (!collab.active) return errorResponse('Forbidden', origin, 403);

    const body = await request.json() as Record<string, unknown>;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const category = typeof body.category === 'string' ? body.category : 'general';

    if (!content) return errorResponse('Content is required', origin);
    if (!VALID_NOTE_CATEGORIES.includes(category as typeof VALID_NOTE_CATEGORIES[number])) {
      return errorResponse(`Invalid category. Must be one of: ${VALID_NOTE_CATEGORIES.join(', ')}`, origin);
    }

    const pipeline = await sql`
      SELECT pitch_id FROM production_pipeline WHERE id = ${projectId}
    `;
    if (pipeline.length === 0) return errorResponse('Project not found', origin, 404);

    const pitchId = pipeline[0].pitch_id || projectId;
    const roleName = collab.role === 'custom' ? '' : collab.role?.replace('_', ' ');
    const author = `${authResult.user.name} (${roleName})`;

    const result = await sql`
      INSERT INTO production_notes (user_id, pitch_id, content, category, author)
      VALUES (${Number(authResult.user.id)}, ${pitchId}, ${content}, ${category}, ${author})
      RETURNING id, content, category, author, created_at, updated_at
    `;

    await logActivity(sql, projectId, Number(authResult.user.id), 'note_added', result[0].id);

    return jsonResponse({ success: true, data: { note: result[0] } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('addCollaborationNote error:', e.message);
    return errorResponse('Failed to add note', origin, 500);
  }
}

/**
 * GET /api/my/collaborations/:projectId/activity
 */
export async function getCollaborationActivity(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = parseInt(extractPathParam(request, 4), 10);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { activity: [] } }, origin);

  try {
    // Allow project owner or active collaborator
    const isOwner = await verifyProjectOwnership(sql, projectId, Number(userId));
    const collab = await isActiveCollaborator(sql, projectId, Number(userId));
    if (!isOwner && !collab.active) return errorResponse('Forbidden', origin, 403);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const activity = await sql`
      SELECT cal.id, cal.action, cal.entity_id, cal.created_at,
             u.name as user_name, u.first_name, u.last_name, u.avatar_url,
             pc.role as user_role
      FROM collaborator_activity_log cal
      JOIN users u ON cal.user_id = u.id
      LEFT JOIN project_collaborators pc ON pc.user_id = cal.user_id AND pc.project_id = cal.project_id AND pc.status = 'active'
      WHERE cal.project_id = ${projectId}
      ORDER BY cal.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const mapped = activity.map(a => ({
      id: a.id,
      action: a.action,
      entity_id: a.entity_id,
      created_at: a.created_at,
      user: {
        name: a.user_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Unknown',
        avatar_url: a.avatar_url,
        role: a.user_role,
      },
    }));

    return jsonResponse({ success: true, data: { activity: mapped } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getCollaborationActivity error:', e.message);
    return jsonResponse({ success: true, data: { activity: [] } }, origin);
  }
}
