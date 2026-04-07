/**
 * Real Database Handlers for Collaboration Endpoints
 * Replaces stub endpoints with actual Neon PostgreSQL queries
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

// =============================================================================
// GET /api/creator/collaborations — Real database collaborations
// =============================================================================

export async function getCollaborationsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  const emptyData = {
    success: true,
    data: { collaborations: [], invitations: [], active: 0, pending: 0, completed: 0, closed: 0 }
  };

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse(emptyData, 200, origin);
  }

  try {
    const collaborations = await sql`
      SELECT c.*,
        u_req.username as requester_username, u_req.name as requester_name, u_req.profile_image as requester_image,
        u_col.username as collaborator_username, u_col.name as collaborator_name, u_col.profile_image as collaborator_image,
        p.title as pitch_title
      FROM collaborations c
      JOIN users u_req ON c.requester_id = u_req.id
      JOIN users u_col ON c.collaborator_id = u_col.id
      LEFT JOIN pitches p ON c.pitch_id = p.id
      WHERE c.requester_id = ${userId} OR c.collaborator_id = ${userId}
      ORDER BY c.created_at DESC
    `;

    const countResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'accepted')::int as active,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'closed')::int as closed
      FROM collaborations
      WHERE requester_id = ${userId} OR collaborator_id = ${userId}
    `;

    const counts = countResult[0] || { active: 0, pending: 0, completed: 0, closed: 0 };

    // Invitations are pending collaborations where the current user is the collaborator
    const invitations = (collaborations || []).filter(
      (c: any) => c.status === 'pending' && String(c.collaborator_id) === String(userId)
    );

    return jsonResponse({
      success: true,
      data: {
        collaborations: collaborations || [],
        invitations,
        active: counts.active ?? 0,
        pending: counts.pending ?? 0,
        completed: counts.completed ?? 0,
        closed: counts.closed ?? 0
      }
    }, 200, origin);
  } catch (error) {
    console.error('getCollaborationsHandler query error:', error);
    return jsonResponse(emptyData, 200, origin);
  }
}

// =============================================================================
// POST /api/creator/collaborations — Create a new collaboration
// =============================================================================

export async function createCollaborationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: false, error: 'Database unavailable' }, 503, origin);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
  }

  const { collaboratorId, pitchId, role, message } = body;

  if (!collaboratorId) {
    return jsonResponse({ success: false, error: 'collaboratorId is required' }, 400, origin);
  }

  if (String(collaboratorId) === String(userId)) {
    return jsonResponse({ success: false, error: 'Cannot collaborate with yourself' }, 400, origin);
  }

  try {
    // Validate collaborator exists
    const collaboratorCheck = await sql`
      SELECT id FROM users WHERE id = ${collaboratorId} LIMIT 1
    `;

    if (!collaboratorCheck || collaboratorCheck.length === 0) {
      return jsonResponse({ success: false, error: 'Collaborator not found' }, 404, origin);
    }

    // Insert with ON CONFLICT DO NOTHING to avoid duplicate errors
    const result = await sql`
      INSERT INTO collaborations (requester_id, collaborator_id, pitch_id, role, message)
      VALUES (${userId}, ${collaboratorId}, ${pitchId || null}, ${role || null}, ${message || null})
      ON CONFLICT (requester_id, collaborator_id, pitch_id) DO NOTHING
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return jsonResponse({
        success: false,
        error: 'Collaboration request already exists for this user and pitch'
      }, 409, origin);
    }

    return jsonResponse({
      success: true,
      data: result[0],
      message: 'Collaboration request created successfully'
    }, 201, origin);
  } catch (error) {
    console.error('createCollaborationHandler query error:', error);
    return jsonResponse({ success: false, error: 'Failed to create collaboration' }, 500, origin);
  }
}

// =============================================================================
// PUT /api/creator/collaborations/:id — Update a collaboration status
// =============================================================================

export async function updateCollaborationHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: false, error: 'Database unavailable' }, 503, origin);
  }

  // Extract collaboration ID from URL path
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const collaborationId = pathParts[pathParts.length - 1];

  if (!collaborationId || isNaN(Number(collaborationId))) {
    return jsonResponse({ success: false, error: 'Invalid collaboration ID' }, 400, origin);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
  }

  const { status } = body;
  const allowedStatuses = ['accepted', 'rejected', 'completed', 'cancelled', 'closed'];

  if (!status || !allowedStatuses.includes(status)) {
    return jsonResponse({
      success: false,
      error: `status is required and must be one of: ${allowedStatuses.join(', ')}`
    }, 400, origin);
  }

  try {
    // Fetch the existing collaboration to validate permissions
    const existing = await sql`
      SELECT * FROM collaborations WHERE id = ${collaborationId} LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return jsonResponse({ success: false, error: 'Collaboration not found' }, 404, origin);
    }

    const collaboration = existing[0];

    // Permission checks:
    // - Only the collaborator can accept or reject
    // - Only the requester can cancel
    // - Either party can mark as completed
    const isCollaborator = String(collaboration.collaborator_id) === String(userId);
    const isRequester = String(collaboration.requester_id) === String(userId);

    if ((status === 'accepted' || status === 'rejected') && !isCollaborator) {
      return jsonResponse({
        success: false,
        error: 'Only the collaborator can accept or reject a collaboration request'
      }, 403, origin);
    }

    if (status === 'cancelled' && !isRequester) {
      return jsonResponse({
        success: false,
        error: 'Only the requester can cancel a collaboration request'
      }, 403, origin);
    }

    if (status === 'completed' && !isCollaborator && !isRequester) {
      return jsonResponse({
        success: false,
        error: 'Only participants can mark a collaboration as completed'
      }, 403, origin);
    }

    if (status === 'closed' && !isRequester) {
      return jsonResponse({
        success: false,
        error: 'Only the requester (production company) can close a collaboration'
      }, 403, origin);
    }

    // Perform the update
    const updated = status === 'closed'
      ? await sql`
          UPDATE collaborations
          SET status = 'closed', closed_at = NOW(), closed_by = ${userId}::integer, updated_at = NOW()
          WHERE id = ${collaborationId}
          RETURNING *
        `
      : await sql`
          UPDATE collaborations
          SET status = ${status}, updated_at = NOW()
          WHERE id = ${collaborationId}
          RETURNING *
        `;

    if (!updated || updated.length === 0) {
      return jsonResponse({ success: false, error: 'Failed to update collaboration' }, 500, origin);
    }

    return jsonResponse({
      success: true,
      data: updated[0],
      message: `Collaboration ${status} successfully`
    }, 200, origin);
  } catch (error) {
    console.error('updateCollaborationHandler query error:', error);
    return jsonResponse({ success: false, error: 'Failed to update collaboration' }, 500, origin);
  }
}

// =============================================================================
// GET /api/production/collaborations — Production portal collaborations
// =============================================================================

export async function getProductionCollaborationsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  const emptyData = {
    success: true,
    data: { collaborations: [], invitations: [], active: 0, pending: 0, completed: 0, closed: 0 }
  };

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse(emptyData, 200, origin);
  }

  try {
    const collaborations = await sql`
      SELECT c.*,
        u_req.username as requester_username, u_req.name as requester_name, u_req.profile_image as requester_image,
        u_col.username as collaborator_username, u_col.name as collaborator_name, u_col.profile_image as collaborator_image,
        p.title as pitch_title
      FROM collaborations c
      JOIN users u_req ON c.requester_id = u_req.id
      JOIN users u_col ON c.collaborator_id = u_col.id
      LEFT JOIN pitches p ON c.pitch_id = p.id
      WHERE c.requester_id = ${userId} OR c.collaborator_id = ${userId}
      ORDER BY c.created_at DESC
    `;

    const countResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'accepted')::int as active,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'closed')::int as closed
      FROM collaborations
      WHERE requester_id = ${userId} OR collaborator_id = ${userId}
    `;

    const counts = countResult[0] || { active: 0, pending: 0, completed: 0, closed: 0 };

    const invitations = (collaborations || []).filter(
      (c: any) => c.status === 'pending' && String(c.collaborator_id) === String(userId)
    );

    return jsonResponse({
      success: true,
      data: {
        collaborations: collaborations || [],
        invitations,
        active: counts.active ?? 0,
        pending: counts.pending ?? 0,
        completed: counts.completed ?? 0,
        closed: counts.closed ?? 0
      }
    }, 200, origin);
  } catch (error) {
    console.error('getProductionCollaborationsHandler query error:', error);
    return jsonResponse(emptyData, 200, origin);
  }
}
