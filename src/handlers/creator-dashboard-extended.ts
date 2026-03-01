/**
 * Extended Creator Dashboard Handlers
 * Revenue, contracts, engagement, demographics, and investor communication
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { ApiResponseBuilder } from '../utils/api-response';
import { requireRole } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/** GET /api/creator/revenue/trends */
export async function creatorRevenueTrendsHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.success({ trends: [] });

  try {
    const userId = Number(roleCheck.user.id);
    const url = new URL(request.url);
    const months = Math.min(24, Math.max(1, Number(url.searchParams.get('months')) || 12));

    const trends = await sql`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM') AS month,
        SUM(amount)::numeric AS total,
        COUNT(*)::int AS transaction_count
      FROM creator_revenue
      WHERE creator_id = ${userId}
        AND transaction_date >= NOW() - (${months} || ' months')::interval
      GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
      ORDER BY month ASC
    `.catch(() => []);

    return ApiResponseBuilder.success({ trends });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorRevenueTrendsHandler error:', e.message);
    return ApiResponseBuilder.success({ trends: [] });
  }
}

/** GET /api/creator/revenue/breakdown */
export async function creatorRevenueBreakdownHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.success({ breakdown: [] });

  try {
    const userId = Number(roleCheck.user.id);

    const breakdown = await sql`
      SELECT
        revenue_type AS type,
        SUM(amount)::numeric AS total,
        COUNT(*)::int AS count
      FROM creator_revenue
      WHERE creator_id = ${userId}
      GROUP BY revenue_type
      ORDER BY total DESC
    `.catch(() => []);

    const totalResult = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS grand_total
      FROM creator_revenue
      WHERE creator_id = ${userId}
    `.catch(() => [{ grand_total: 0 }]);

    return ApiResponseBuilder.success({
      breakdown,
      total: Number(totalResult[0]?.grand_total) || 0,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorRevenueBreakdownHandler error:', e.message);
    return ApiResponseBuilder.success({ breakdown: [], total: 0 });
  }
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/** GET /api/creator/contracts/:id */
export async function creatorContractDetailsHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const url = new URL(request.url);
  const contractId = Number(url.pathname.split('/').pop());
  if (!contractId) return ApiResponseBuilder.error('VALIDATION_ERROR', 'Invalid contract ID');

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.error('SERVICE_UNAVAILABLE', 'Database unavailable');

  try {
    const userId = Number(roleCheck.user.id);

    const result = await sql`
      SELECT c.*,
             COALESCE(u.name, u.first_name || ' ' || u.last_name) AS counterparty_display_name
      FROM contracts c
      LEFT JOIN users u ON c.counterparty_id = u.id
      WHERE c.id = ${contractId} AND c.creator_id = ${userId}
    `.catch(() => []);

    if (result.length === 0) {
      return ApiResponseBuilder.error('NOT_FOUND', 'Contract not found');
    }

    return ApiResponseBuilder.success({ contract: result[0] });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorContractDetailsHandler error:', e.message);
    return ApiResponseBuilder.error('INTERNAL_ERROR', 'Failed to fetch contract');
  }
}

/** PUT /api/creator/contracts/:id */
export async function creatorContractUpdateHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const url = new URL(request.url);
  const contractId = Number(url.pathname.split('/').pop());
  if (!contractId) return ApiResponseBuilder.error('VALIDATION_ERROR', 'Invalid contract ID');

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.error('SERVICE_UNAVAILABLE', 'Database unavailable');

  try {
    const userId = Number(roleCheck.user.id);
    const body = await request.json() as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title : undefined;
    const status = typeof body.status === 'string' ? body.status : undefined;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;

    const result = await sql`
      UPDATE contracts
      SET
        title = COALESCE(${title ?? null}, title),
        status = COALESCE(${status ?? null}, status),
        notes = COALESCE(${notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${contractId} AND creator_id = ${userId}
      RETURNING *
    `.catch(() => []);

    if (result.length === 0) {
      return ApiResponseBuilder.error('NOT_FOUND', 'Contract not found');
    }

    return ApiResponseBuilder.success({ contract: result[0] });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorContractUpdateHandler error:', e.message);
    return ApiResponseBuilder.error('INTERNAL_ERROR', 'Failed to update contract');
  }
}

// ---------------------------------------------------------------------------
// Analytics — Engagement
// ---------------------------------------------------------------------------

/** GET /api/creator/engagement */
export async function creatorEngagementHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.success({ engagement: {} });

  try {
    const userId = Number(roleCheck.user.id);

    // Aggregate views and likes across all creator's pitches
    const viewStats = await sql`
      SELECT
        COUNT(*)::int AS total_views,
        COUNT(DISTINCT pv.viewer_id)::int AS unique_viewers,
        COALESCE(AVG(pv.view_duration), 0)::int AS avg_view_duration
      FROM pitch_views pv
      JOIN pitches p ON pv.pitch_id = p.id
      WHERE p.user_id = ${userId}
    `.catch(() => [{ total_views: 0, unique_viewers: 0, avg_view_duration: 0 }]);

    const likeStats = await sql`
      SELECT COUNT(*)::int AS total_likes
      FROM pitch_likes pl
      JOIN pitches p ON pl.pitch_id = p.id
      WHERE p.user_id = ${userId}
    `.catch(() => [{ total_likes: 0 }]);

    // Per-pitch breakdown
    const pitchEngagement = await sql`
      SELECT
        p.id, p.title,
        COUNT(DISTINCT pv.id)::int AS views,
        COALESCE((SELECT COUNT(*) FROM pitch_likes pl WHERE pl.pitch_id = p.id), 0)::int AS likes,
        COALESCE(AVG(pv.view_duration), 0)::int AS avg_duration
      FROM pitches p
      LEFT JOIN pitch_views pv ON pv.pitch_id = p.id
      WHERE p.user_id = ${userId}
      GROUP BY p.id, p.title
      ORDER BY views DESC
      LIMIT 20
    `.catch(() => []);

    const totalViews = Number(viewStats[0]?.total_views) || 0;
    const totalLikes = Number(likeStats[0]?.total_likes) || 0;

    return ApiResponseBuilder.success({
      engagement: {
        totalViews,
        uniqueViewers: Number(viewStats[0]?.unique_viewers) || 0,
        totalLikes,
        avgViewDuration: Number(viewStats[0]?.avg_view_duration) || 0,
        engagementRate: totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0,
        pitchBreakdown: pitchEngagement,
      },
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorEngagementHandler error:', e.message);
    return ApiResponseBuilder.success({ engagement: {} });
  }
}

// ---------------------------------------------------------------------------
// Analytics — Demographics
// ---------------------------------------------------------------------------

/** GET /api/creator/demographics */
export async function creatorDemographicsHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.success({ demographics: {} });

  try {
    const userId = Number(roleCheck.user.id);

    // Viewer types (creator, investor, production)
    const viewerTypes = await sql`
      SELECT
        COALESCE(u.user_type, 'anonymous') AS viewer_type,
        COUNT(*)::int AS count
      FROM pitch_views pv
      JOIN pitches p ON pv.pitch_id = p.id
      LEFT JOIN users u ON pv.viewer_id = u.id
      WHERE p.user_id = ${userId}
      GROUP BY COALESCE(u.user_type, 'anonymous')
      ORDER BY count DESC
    `.catch(() => []);

    // View types (direct, browse, search, etc.)
    const viewSources = await sql`
      SELECT
        COALESCE(pv.view_type, 'direct') AS source,
        COUNT(*)::int AS count
      FROM pitch_views pv
      JOIN pitches p ON pv.pitch_id = p.id
      WHERE p.user_id = ${userId}
      GROUP BY COALESCE(pv.view_type, 'direct')
      ORDER BY count DESC
    `.catch(() => []);

    return ApiResponseBuilder.success({
      demographics: {
        viewerTypes,
        viewSources,
      },
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorDemographicsHandler error:', e.message);
    return ApiResponseBuilder.success({ demographics: {} });
  }
}

// ---------------------------------------------------------------------------
// Communication
// ---------------------------------------------------------------------------

/** GET /api/creator/investors/:investorId/communications */
export async function creatorInvestorCommunicationHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const parts = new URL(request.url).pathname.split('/');
  // /api/creator/investors/:investorId/communications
  const investorId = Number(parts[4]);
  if (!investorId) return ApiResponseBuilder.error('VALIDATION_ERROR', 'Invalid investor ID');

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.success({ communications: [] });

  try {
    const userId = Number(roleCheck.user.id);

    // Find conversations where both users are participants
    const conversations = await sql`
      SELECT DISTINCT c.id, c.title, c.type, c.created_at, c.updated_at
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ${userId}
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ${investorId}
      ORDER BY c.updated_at DESC
      LIMIT 10
    `.catch(() => []);

    // Fetch recent messages from those conversations
    const conversationIds = conversations.map((c: Record<string, unknown>) => Number(c.id));
    let messages: unknown[] = [];

    if (conversationIds.length > 0) {
      messages = await sql`
        SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type,
               m.created_at, m.is_edited,
               COALESCE(u.name, u.first_name || ' ' || u.last_name) AS sender_name
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ANY(${conversationIds})
          AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT 50
      `.catch(() => []);
    }

    return ApiResponseBuilder.success({
      communications: conversations,
      messages,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorInvestorCommunicationHandler error:', e.message);
    return ApiResponseBuilder.success({ communications: [] });
  }
}

/** POST /api/creator/investors/:investorId/message */
export async function creatorMessageInvestorHandler(request: Request, env: Env): Promise<Response> {
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) return roleCheck.error;

  const parts = new URL(request.url).pathname.split('/');
  // /api/creator/investors/:investorId/message
  const investorId = Number(parts[4]);
  if (!investorId) return ApiResponseBuilder.error('VALIDATION_ERROR', 'Invalid investor ID');

  const sql = getDb(env);
  if (!sql) return ApiResponseBuilder.error('SERVICE_UNAVAILABLE', 'Database unavailable');

  try {
    const userId = Number(roleCheck.user.id);
    const body = await request.json() as Record<string, unknown>;
    const content = typeof body.message === 'string' ? body.message.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';

    if (!content) return ApiResponseBuilder.error('VALIDATION_ERROR', 'Message content is required');

    // Check if an existing conversation exists between the two users
    const existing = await sql`
      SELECT c.id
      FROM conversations c
      JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ${userId}
      JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ${investorId}
      WHERE c.type = 'direct'
      ORDER BY c.updated_at DESC
      LIMIT 1
    `.catch(() => []);

    let conversationId: number;

    if (existing.length > 0) {
      conversationId = Number(existing[0].id);
      // Update conversation timestamp
      await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${conversationId}`.catch(() => []);
    } else {
      // Create new conversation
      const conv = await sql`
        INSERT INTO conversations (title, type, created_by, created_at, updated_at)
        VALUES (${subject || 'Direct Message'}, 'direct', ${userId}, NOW(), NOW())
        RETURNING id
      `;
      conversationId = Number(conv[0].id);

      // Add both participants
      await sql`
        INSERT INTO conversation_participants (conversation_id, user_id, joined_at, is_admin)
        VALUES (${conversationId}, ${userId}, NOW(), true),
               (${conversationId}, ${investorId}, NOW(), false)
      `.catch(() => []);
    }

    // Insert the message
    const msg = await sql`
      INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
      VALUES (${conversationId}, ${userId}, ${content}, 'text', NOW())
      RETURNING id, conversation_id, sender_id, content, created_at
    `;

    // Notify the investor
    await sql`
      INSERT INTO notifications (user_id, type, title, message, related_user_id, created_at)
      VALUES (
        ${investorId}, 'new_message', 'New Message',
        ${'You have a new message from a creator'},
        ${userId}, NOW()
      )
    `.catch(() => []);

    return ApiResponseBuilder.success({
      messageSent: true,
      message: msg[0],
      conversationId,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('creatorMessageInvestorHandler error:', e.message);
    return ApiResponseBuilder.error('INTERNAL_ERROR', 'Failed to send message');
  }
}
