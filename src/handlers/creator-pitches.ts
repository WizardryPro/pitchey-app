/**
 * Creator Pitches Handler - Get creator's pitches for the portal
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { requireRole } from '../utils/auth-extract';

// GET /api/creator/pitches - Get creator's pitches
export async function creatorPitchesHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Allow creators, production companies, and watchers (viewer user_type).
  // Watchers can only draft — they see this list so they can manage their
  // drafts. Ownership is scoped by user_id in the SQL queries below, so a
  // watcher only ever sees their own pitches.
  const roleCheck = await requireRole(request, env, ['creator', 'production', 'viewer']);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const sql = getDb(env);

    if (!sql) {
      console.error('Database connection failed in creator pitches');
      return new Response(JSON.stringify({
        success: true,
        pitches: [],
        total: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get creator's pitches with full details
    // Use separate queries based on whether status filter is provided
    let pitches;
    let countResult;

    if (status && ['draft', 'published', 'under_review', 'archived'].includes(status)) {
      pitches = await sql`
        SELECT
          id,
          title,
          logline,
          short_synopsis,
          long_synopsis,
          genre,
          format,
          budget_bracket,
          estimated_budget,
          target_audience,
          themes,
          title_image,
          status,
          require_nda,
          visibility_settings,
          characters,
          production_timeline,
          view_count,
          like_count,
          nda_count,
          published_at,
          created_at,
          updated_at
        FROM pitches
        WHERE user_id = ${userId}
          AND status = ${status}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total
        FROM pitches
        WHERE user_id = ${userId}
          AND status = ${status}
      `;
    } else {
      pitches = await sql`
        SELECT
          id,
          title,
          logline,
          short_synopsis,
          long_synopsis,
          genre,
          format,
          budget_bracket,
          estimated_budget,
          target_audience,
          themes,
          title_image,
          status,
          require_nda,
          visibility_settings,
          characters,
          production_timeline,
          view_count,
          like_count,
          nda_count,
          published_at,
          created_at,
          updated_at
        FROM pitches
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total
        FROM pitches
        WHERE user_id = ${userId}
      `;
    }

    const total = parseInt(countResult[0]?.total || '0');

    // Transform pitches to match frontend expectations
    const transformedPitches = pitches.map((pitch: any) => ({
      id: pitch.id,
      title: pitch.title,
      logline: pitch.logline,
      shortSynopsis: pitch.short_synopsis,
      longSynopsis: pitch.long_synopsis,
      genre: pitch.genre,
      format: pitch.format,
      budgetBracket: pitch.budget_bracket,
      estimatedBudget: pitch.estimated_budget,
      targetAudience: pitch.target_audience,
      themes: pitch.themes,
      titleImage: pitch.title_image,
      status: pitch.status,
      requireNDA: pitch.require_nda,
      visibilitySettings: pitch.visibility_settings,
      characters: pitch.characters,
      productionTimeline: pitch.production_timeline,
      viewCount: pitch.view_count || 0,
      likeCount: pitch.like_count || 0,
      ndaCount: pitch.nda_count || 0,
      publishedAt: pitch.published_at,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at
    }));

    return new Response(JSON.stringify({
      success: true,
      pitches: transformedPitches,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
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
    console.error('Creator pitches error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load pitches',
      debug: errorMessage,
      pitches: [],
      total: 0
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/creator/activities - Get creator's activity feed
export async function creatorActivitiesHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, ['creator', 'production']);
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const type = url.searchParams.get('type'); // filter by activity type

  try {
    const sql = getDb(env);

    if (!sql) {
      console.error('Database connection failed in creator activities');
      return new Response(JSON.stringify({
        success: true,
        activities: [],
        total: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Build type filter clause
    const typeMap: Record<string, string[]> = {
      view: ['pitch_view'],
      like: ['pitch_like'],
      follow: ['follow'],
      nda: ['nda_request'],
      investment: ['investment'],
      comment: ['message_sent'],
      message: ['message_sent'],
      milestone: ['pitch_published', 'pitch_created'],
    };
    const allowedTypes = type && typeMap[type] ? typeMap[type] : null;

    // Union across all activity sources for this creator's pitches
    const activities = await sql`
      WITH creator_pitches AS (
        SELECT id, title FROM pitches WHERE user_id = ${userId}
      ),
      all_activities AS (
        -- Pitch published/created
        SELECT
          p.id as source_id,
          CASE WHEN p.status = 'published' AND p.published_at IS NOT NULL THEN 'pitch_published' ELSE 'pitch_created' END as type,
          CASE WHEN p.status = 'published' AND p.published_at IS NOT NULL
            THEN 'You published "' || p.title || '"'
            ELSE 'You created "' || p.title || '"'
          END as description,
          COALESCE(p.published_at, p.created_at) as created_at,
          NULL as actor_name,
          NULL as actor_role,
          jsonb_build_object('pitchId', p.id, 'pitchTitle', p.title, 'status', p.status) as metadata
        FROM pitches p
        WHERE p.user_id = ${userId}

        UNION ALL

        -- Views on creator's pitches (exclude self-views)
        SELECT
          v.id as source_id,
          'pitch_view' as type,
          COALESCE(u.username, 'Someone') || ' viewed "' || cp.title || '"' as description,
          v.viewed_at as created_at,
          COALESCE(u.username, 'Anonymous') as actor_name,
          COALESCE(u.user_type, 'visitor') as actor_role,
          jsonb_build_object('pitchId', cp.id, 'pitchTitle', cp.title) as metadata
        FROM views v
        JOIN creator_pitches cp ON cp.id = v.pitch_id
        LEFT JOIN users u ON u.id = v.viewer_id
        WHERE v.viewer_id IS DISTINCT FROM ${userId}

        UNION ALL

        -- Likes on creator's pitches
        SELECT
          l.id as source_id,
          'pitch_like' as type,
          u.username || ' liked "' || cp.title || '"' as description,
          l.created_at,
          u.username as actor_name,
          u.user_type as actor_role,
          jsonb_build_object('pitchId', cp.id, 'pitchTitle', cp.title) as metadata
        FROM likes l
        JOIN creator_pitches cp ON cp.id = l.pitch_id
        LEFT JOIN users u ON u.id = l.user_id

        UNION ALL

        -- Follows (someone followed this creator)
        SELECT
          f.id as source_id,
          'follow' as type,
          u.username || ' started following you' as description,
          f.created_at,
          u.username as actor_name,
          u.user_type as actor_role,
          jsonb_build_object('followerId', f.follower_id) as metadata
        FROM follows f
        LEFT JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ${userId}

        UNION ALL

        -- NDA requests on creator's pitches
        SELECT
          n.id as source_id,
          'nda_request' as type,
          u.username || ' requested NDA for "' || cp.title || '"' as description,
          n.created_at,
          u.username as actor_name,
          u.user_type as actor_role,
          jsonb_build_object('pitchId', cp.id, 'pitchTitle', cp.title, 'status', n.status) as metadata
        FROM nda_requests n
        JOIN creator_pitches cp ON cp.id = n.pitch_id
        LEFT JOIN users u ON u.id = n.requester_id

        UNION ALL

        -- Investments in creator's pitches
        SELECT
          i.id as source_id,
          'investment' as type,
          u.username || ' invested in "' || cp.title || '"' as description,
          i.created_at,
          u.username as actor_name,
          u.user_type as actor_role,
          jsonb_build_object('pitchId', cp.id, 'pitchTitle', cp.title, 'amount', i.amount) as metadata
        FROM investments i
        JOIN creator_pitches cp ON cp.id = i.pitch_id
        LEFT JOIN users u ON u.id = i.investor_id

        UNION ALL

        -- Messages received on creator's pitches
        SELECT
          m.id as source_id,
          'message_sent' as type,
          COALESCE(u.username, 'Someone') || ' messaged you about "' || COALESCE(cp.title, 'a pitch') || '"' as description,
          COALESCE(m.sent_at, m.created_at) as created_at,
          COALESCE(u.username, 'Anonymous') as actor_name,
          COALESCE(u.user_type, 'user') as actor_role,
          jsonb_build_object('pitchId', m.pitch_id, 'pitchTitle', cp.title, 'subject', m.subject) as metadata
        FROM messages m
        LEFT JOIN creator_pitches cp ON cp.id = m.pitch_id
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.receiver_id = ${userId} OR m.recipient_id = ${userId}
      )
      SELECT * FROM all_activities
      WHERE (${allowedTypes}::text[] IS NULL OR type = ANY(${allowedTypes}::text[]))
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count with same filter
    const countResult = await sql`
      WITH creator_pitches AS (
        SELECT id FROM pitches WHERE user_id = ${userId}
      ),
      all_activities AS (
        SELECT CASE WHEN status = 'published' AND published_at IS NOT NULL THEN 'pitch_published' ELSE 'pitch_created' END as type FROM pitches WHERE user_id = ${userId}
        UNION ALL SELECT 'pitch_view' FROM views WHERE pitch_id IN (SELECT id FROM creator_pitches) AND viewer_id IS DISTINCT FROM ${userId}
        UNION ALL SELECT 'pitch_like' FROM likes WHERE pitch_id IN (SELECT id FROM creator_pitches)
        UNION ALL SELECT 'follow' FROM follows WHERE following_id = ${userId}
        UNION ALL SELECT 'nda_request' FROM nda_requests WHERE pitch_id IN (SELECT id FROM creator_pitches)
        UNION ALL SELECT 'investment' FROM investments WHERE pitch_id IN (SELECT id FROM creator_pitches)
        UNION ALL SELECT 'message_sent' FROM messages WHERE (receiver_id = ${userId} OR recipient_id = ${userId})
      )
      SELECT COUNT(*) as total FROM all_activities
      WHERE (${allowedTypes}::text[] IS NULL OR type = ANY(${allowedTypes}::text[]))
    `;

    const total = parseInt(countResult[0]?.total || '0');

    // Transform activities
    const transformedActivities = activities.map((activity: any) => ({
      id: activity.source_id,
      type: activity.type,
      description: activity.description,
      createdAt: activity.created_at,
      metadata: activity.metadata,
      ...(activity.actor_name ? {
        user: {
          name: activity.actor_name,
          role: activity.actor_role || 'user'
        }
      } : {})
    }));

    return new Response(JSON.stringify({
      success: true,
      activities: transformedActivities,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
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
    console.error('Creator activities error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load activities',
      activities: [],
      total: 0
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
