/**
 * Real Database Handlers for Direct Messaging
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
// GET /api/messages — List conversations with last message preview
// =============================================================================

export async function getConversationsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({
      success: true,
      data: { conversations: [], unreadCount: 0 }
    }, 200, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({
      success: true,
      data: { conversations: [], unreadCount: 0 }
    }, 200, origin);
  }

  try {
    const [conversations, unreadResult] = await Promise.all([
      sql`
        SELECT DISTINCT ON (conversation_partner)
          m.id, m.content, m.created_at, m.read_at, m.sender_id, m.recipient_id,
          CASE WHEN m.sender_id = ${userId} THEN m.recipient_id ELSE m.sender_id END as conversation_partner,
          u.username, u.name, u.profile_image
        FROM messages m
        JOIN users u ON u.id = CASE WHEN m.sender_id = ${userId} THEN m.recipient_id ELSE m.sender_id END
        WHERE m.sender_id = ${userId} OR m.recipient_id = ${userId}
        ORDER BY conversation_partner, m.created_at DESC
      `,
      sql`
        SELECT COUNT(*)::int as count
        FROM messages
        WHERE recipient_id = ${userId} AND read_at IS NULL
      `
    ]);

    const unreadCount = unreadResult[0]?.count ?? 0;

    return jsonResponse({
      success: true,
      data: { conversations: conversations || [], unreadCount }
    }, 200, origin);
  } catch (error) {
    console.error('getConversationsHandler query error:', error);
    return jsonResponse({
      success: true,
      data: { conversations: [], unreadCount: 0 }
    }, 200, origin);
  }
}

// =============================================================================
// GET /api/messages/:userId — Get message thread with a specific user
// =============================================================================

export async function getThreadHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({
      success: true,
      data: { messages: [] }
    }, 200, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({
      success: true,
      data: { messages: [] }
    }, 200, origin);
  }

  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const partnerId = pathSegments[pathSegments.length - 1];

  if (!partnerId || isNaN(Number(partnerId))) {
    return jsonResponse({
      success: false,
      error: 'Invalid partner user ID'
    }, 400, origin);
  }

  const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(rawLimit, 1), 100);

  try {
    const rows = await sql`
      SELECT m.id, m.sender_id, m.recipient_id, m.content, m.read_at, m.created_at
      FROM messages m
      WHERE (m.sender_id = ${userId} AND m.recipient_id = ${partnerId})
         OR (m.sender_id = ${partnerId} AND m.recipient_id = ${userId})
      ORDER BY m.created_at ASC
      LIMIT ${limit}
    `;

    return jsonResponse({
      success: true,
      data: { messages: rows || [] }
    }, 200, origin);
  } catch (error) {
    console.error('getThreadHandler query error:', error);
    return jsonResponse({
      success: true,
      data: { messages: [] }
    }, 200, origin);
  }
}

// =============================================================================
// POST /api/messages/send — Send a direct message
// =============================================================================

export async function sendMessageHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({
      success: false,
      error: 'Authentication required'
    }, 401, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({
      success: false,
      error: 'Database unavailable'
    }, 503, origin);
  }

  let body: { recipientId?: number; content?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({
      success: false,
      error: 'Invalid JSON body'
    }, 400, origin);
  }

  const { recipientId, content } = body;

  if (!recipientId) {
    return jsonResponse({
      success: false,
      error: 'recipientId is required'
    }, 400, origin);
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return jsonResponse({
      success: false,
      error: 'content is required and must not be empty'
    }, 400, origin);
  }

  try {
    // Check for signed NDA between sender and recipient
    const ndaCheck = await sql`
      SELECT 1 FROM ndas n
      JOIN pitches p ON p.id = n.pitch_id
      WHERE n.signed_at IS NOT NULL AND n.revoked_at IS NULL
        AND (
          (COALESCE(n.signer_id, n.user_id) = ${userId} AND p.user_id = ${recipientId})
          OR
          (COALESCE(n.signer_id, n.user_id) = ${recipientId} AND p.user_id = ${userId})
        )
      LIMIT 1
    `;

    // Grandfather existing conversations so we don't break ongoing threads
    const existingThread = await sql`
      SELECT 1 FROM messages
      WHERE (sender_id = ${userId} AND recipient_id = ${recipientId})
         OR (sender_id = ${recipientId} AND recipient_id = ${userId})
      LIMIT 1
    `;

    if (ndaCheck.length === 0 && existingThread.length === 0) {
      return jsonResponse({
        success: false,
        error: 'A signed NDA is required to message this user'
      }, 403, origin);
    }

    const result = await sql`
      INSERT INTO messages (sender_id, recipient_id, content)
      VALUES (${userId}, ${recipientId}, ${content.trim()})
      RETURNING *
    `;

    return jsonResponse({
      success: true,
      data: { message: result[0] }
    }, 201, origin);
  } catch (error) {
    console.error('sendMessageHandler query error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to send message'
    }, 500, origin);
  }
}

// =============================================================================
// POST /api/messages/:messageId/read — Mark a message as read
// =============================================================================

export async function markMessageReadHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({
      success: false,
      error: 'Authentication required'
    }, 401, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({
      success: false,
      error: 'Database unavailable'
    }, 503, origin);
  }

  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  // URL pattern: /api/messages/:messageId/read — messageId is second to last
  const messageId = pathSegments[pathSegments.length - 2];

  if (!messageId || isNaN(Number(messageId))) {
    return jsonResponse({
      success: false,
      error: 'Invalid message ID'
    }, 400, origin);
  }

  try {
    const result = await sql`
      UPDATE messages
      SET read_at = NOW()
      WHERE id = ${messageId} AND recipient_id = ${userId} AND read_at IS NULL
      RETURNING id, read_at
    `;

    return jsonResponse({
      success: true,
      data: { read: true }
    }, 200, origin);
  } catch (error) {
    console.error('markMessageReadHandler query error:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to mark message as read'
    }, 500, origin);
  }
}

// =============================================================================
// GET /api/messages/unread-count — Get unread message count
// =============================================================================

export async function getUnreadCountHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({
      success: true,
      data: { unreadCount: 0 }
    }, 200, origin);
  }

  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({
      success: true,
      data: { unreadCount: 0 }
    }, 200, origin);
  }

  try {
    const result = await sql`
      SELECT COUNT(*)::int as count
      FROM messages
      WHERE recipient_id = ${userId} AND read_at IS NULL
    `;

    const unreadCount = result[0]?.count ?? 0;

    return jsonResponse({
      success: true,
      data: { unreadCount }
    }, 200, origin);
  } catch (error) {
    console.error('getUnreadCountHandler query error:', error);
    return jsonResponse({
      success: true,
      data: { unreadCount: 0 }
    }, 200, origin);
  }
}
