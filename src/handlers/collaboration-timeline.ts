/**
 * Collaboration Timeline Handler
 * GET /api/collaborations/:id/timeline
 *
 * Derives milestones from existing tables — no separate events table.
 * Returns an ordered array of milestones for the collaboration relationship.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

interface Milestone {
  key: string;
  label: string;
  timestamp: string | null;
  completed: boolean;
  order: number;
}

export async function collaborationTimelineHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  const params = (request as any).params;
  const collaborationId = parseInt(params?.id, 10);
  if (!collaborationId || isNaN(collaborationId)) {
    return jsonResponse({ success: false, error: 'Invalid collaboration ID' }, origin, 400);
  }

  try {
    // 1. Fetch the collaboration and verify the user is a participant
    const collabResult = await sql`
      SELECT id, requester_id, collaborator_id, pitch_id, status, created_at, closed_at
      FROM collaborations
      WHERE id = ${collaborationId}
        AND (requester_id = ${userId}::integer OR collaborator_id = ${userId}::integer)
      LIMIT 1
    `;

    if (collabResult.length === 0) {
      return jsonResponse({ success: false, error: 'Collaboration not found' }, origin, 404);
    }

    const collab = collabResult[0] as {
      id: number;
      requester_id: number;
      collaborator_id: number;
      pitch_id: number | null;
      status: string;
      created_at: string;
      closed_at: string | null;
    };

    const requesterId = collab.requester_id;
    const collaboratorId = collab.collaborator_id;
    const pitchId = collab.pitch_id;

    // 2. Derive milestones from existing data

    // Milestone: Collaboration requested
    const collaborationRequested: Milestone = {
      key: 'collaboration_requested',
      label: 'Collaboration Requested',
      timestamp: collab.created_at,
      completed: true,
      order: 1,
    };

    // Milestone: NDA requested (if a pitch is involved)
    let ndaRequested: Milestone = {
      key: 'nda_requested',
      label: 'NDA Requested',
      timestamp: null,
      completed: false,
      order: 2,
    };

    let ndaSigned: Milestone = {
      key: 'nda_signed',
      label: 'NDA Signed',
      timestamp: null,
      completed: false,
      order: 3,
    };

    if (pitchId) {
      const ndaResult = await sql`
        SELECT created_at, status, responded_at
        FROM nda_requests
        WHERE pitch_id = ${pitchId}
          AND (requester_id = ${requesterId} OR requester_id = ${collaboratorId})
        ORDER BY created_at ASC
        LIMIT 1
      `;

      if (ndaResult.length > 0) {
        const nda = ndaResult[0] as { created_at: string; status: string; responded_at: string | null };
        ndaRequested = { ...ndaRequested, timestamp: nda.created_at, completed: true };
        if (nda.status === 'approved' && nda.responded_at) {
          ndaSigned = { ...ndaSigned, timestamp: nda.responded_at, completed: true };
        }
      }
    }

    // Milestone: Pitch viewed (if a pitch is involved)
    let pitchViewed: Milestone = {
      key: 'pitch_viewed',
      label: 'Pitch Viewed',
      timestamp: null,
      completed: false,
      order: 4,
    };

    if (pitchId) {
      const viewResult = await sql`
        SELECT viewed_at
        FROM pitch_views
        WHERE pitch_id = ${pitchId}
          AND (viewer_id = ${requesterId} OR viewer_id = ${collaboratorId})
        ORDER BY viewed_at ASC
        LIMIT 1
      `;

      if (viewResult.length > 0) {
        const view = viewResult[0] as { viewed_at: string };
        pitchViewed = { ...pitchViewed, timestamp: view.viewed_at, completed: true };
      }
    }

    // Milestone: First message exchanged
    let firstMessage: Milestone = {
      key: 'first_message',
      label: 'First Message Sent',
      timestamp: null,
      completed: false,
      order: 5,
    };

    const msgResult = await sql`
      SELECT sent_at
      FROM messages
      WHERE (
        (sender_id = ${requesterId} AND receiver_id = ${collaboratorId})
        OR (sender_id = ${collaboratorId} AND receiver_id = ${requesterId})
      )
      ORDER BY sent_at ASC
      LIMIT 1
    `;

    if (msgResult.length > 0) {
      const msg = msgResult[0] as { sent_at: string };
      firstMessage = { ...firstMessage, timestamp: msg.sent_at, completed: true };
    }

    // Milestone: Collaboration accepted
    let collaborationAccepted: Milestone = {
      key: 'collaboration_accepted',
      label: 'Collaboration Active',
      timestamp: null,
      completed: false,
      order: 6,
    };

    if (['accepted', 'completed', 'closed'].includes(collab.status)) {
      // The updated_at when status changed to accepted isn't tracked separately,
      // so use created_at as a reasonable approximation for immediate accepts,
      // or the collaboration's updated_at
      const acceptedResult = await sql`
        SELECT updated_at FROM collaborations WHERE id = ${collaborationId} LIMIT 1
      `;
      if (acceptedResult.length > 0) {
        collaborationAccepted = {
          ...collaborationAccepted,
          timestamp: (acceptedResult[0] as { updated_at: string }).updated_at,
          completed: true,
        };
      }
    }

    // Milestone: Project closed
    let projectClosed: Milestone = {
      key: 'project_closed',
      label: 'Project Closed',
      timestamp: collab.closed_at,
      completed: !!collab.closed_at,
      order: 7,
    };

    // 3. Assemble and return milestones in order
    const milestones = [
      collaborationRequested,
      ndaRequested,
      ndaSigned,
      pitchViewed,
      firstMessage,
      collaborationAccepted,
      projectClosed,
    ].sort((a, b) => a.order - b.order);

    return jsonResponse({ success: true, data: { milestones } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('collaborationTimelineHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load timeline' }, origin, 500);
  }
}
