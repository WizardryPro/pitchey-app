/**
 * Structured Pitch Feedback Handlers
 * Submit, update, delete, and read structured feedback on pitches.
 * Uses the existing pitch_feedback table (migration 018).
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId, getAuthenticatedUser } from '../utils/auth-extract';
import { safeQuery } from '../db/safe-query';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

// Fire-and-forget in-app notification to a pitch's owner. Mirrors the live insert
// pattern used across handlers: OMIT `priority` (prod's notifications_priority_check
// rejects 'normal'; the column default applies) and never let a notify failure break
// the user's action. Skips self-notification (a creator acting on their own pitch).
async function notifyPitchOwner(
  sql: ReturnType<typeof getDb>,
  opts: { ownerId: number; actorId: number | null; pitchId: number; type: string; title: string; message: string },
): Promise<void> {
  if (!sql) return;
  if (opts.actorId != null && String(opts.actorId) === String(opts.ownerId)) return;
  try {
    await sql`
      INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id, action_url, is_read, created_at)
      VALUES (${opts.ownerId}, ${opts.type}, ${opts.title}, ${opts.message}, ${opts.pitchId}, ${opts.actorId ?? null}, ${`/pitch/${opts.pitchId}`}, false, NOW())
    `;
  } catch (err) {
    console.error('notifyPitchOwner error:', err instanceof Error ? err.message : String(err));
  }
}

function extractPitchId(request: Request): number {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/pitches/:id/feedback -> pitchId is at index 3
  return parseInt(parts[3] || '0', 10);
}

function mapUserType(userType: string): string {
  if (userType === 'investor') return 'investor';
  if (userType === 'production') return 'production';
  if (userType === 'creator') return 'creator';
  if (userType === 'watcher') return 'watcher';
  if (userType === 'viewer') return 'viewer';
  if (userType === 'admin') return 'admin';
  return 'peer';
}

/** Role weight for rating — aligned with heat_role_weights table */
function getRoleWeight(reviewerType: string): number {
  switch (reviewerType) {
    case 'production': return 4.0;
    case 'investor': return 3.0;
    case 'creator': return 1.0;
    case 'peer': return 1.0;
    case 'viewer': return 0.5;
    case 'watcher': return 0.5;
    case 'anonymous': return 0.25;
    case 'admin': return 0.0;
    default: return 1.0;
  }
}

/** Recalculate dual scores: pitchey_score_avg (industry) + viewer_score_avg (audience) + combined rating_average */
async function updateRatingStats(sql: ReturnType<typeof getDb>, pitchId: number): Promise<void> {
  if (!sql) return;
  // Admins (heat_role_weights.admin = 0) are excluded everywhere — they'd divide by zero
  // and their ratings shouldn't count in any aggregate.
  await safeQuery(
    () => sql`
      UPDATE pitches SET
        -- Combined weighted average (all sources except admin)
        rating_average = COALESCE(
          (SELECT (SUM(rating * reviewer_weight) / NULLIF(SUM(reviewer_weight), 0))::decimal(4,2)
           FROM (
             SELECT rating, reviewer_weight FROM pitch_feedback
             WHERE pitch_id = ${pitchId} AND rating IS NOT NULL AND reviewer_type != 'admin'
             UNION ALL
             SELECT rating, reviewer_weight FROM pitch_ratings_anonymous
             WHERE pitch_id = ${pitchId}
           ) combined
          ), 0
        ),
        rating_count = (
          (SELECT COUNT(*)::int FROM pitch_feedback WHERE pitch_id = ${pitchId} AND rating IS NOT NULL AND reviewer_type != 'admin') +
          (SELECT COUNT(*)::int FROM pitch_ratings_anonymous WHERE pitch_id = ${pitchId})
        ),
        -- Pitchey Score (industry): investor + production + creator + peer
        pitchey_score_avg = COALESCE(
          (SELECT (SUM(rating * reviewer_weight) / NULLIF(SUM(reviewer_weight), 0))::decimal(4,2)
           FROM pitch_feedback
           WHERE pitch_id = ${pitchId} AND rating IS NOT NULL
             AND reviewer_type IN ('investor', 'production', 'creator', 'peer')
          ), 0
        ),
        -- Viewer Score (audience): viewer + watcher + anonymous
        viewer_score_avg = COALESCE(
          (SELECT (SUM(rating * reviewer_weight) / NULLIF(SUM(reviewer_weight), 0))::decimal(4,2)
           FROM (
             SELECT rating, reviewer_weight FROM pitch_feedback
             WHERE pitch_id = ${pitchId} AND rating IS NOT NULL AND reviewer_type IN ('viewer', 'watcher')
             UNION ALL
             SELECT rating, reviewer_weight FROM pitch_ratings_anonymous
             WHERE pitch_id = ${pitchId}
           ) viewer_combined
          ), 0
        )
      WHERE id = ${pitchId}
    `,
    { fallback: [], context: 'pitch-feedback.update-rating-stats', tags: { pitchId } },
  );
}

interface FeedbackBody {
  rating?: number;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  overall_feedback?: string;
  is_interested?: boolean;
  is_anonymous?: boolean;
}

function validateFeedback(body: FeedbackBody): string | null {
  const { rating, strengths, weaknesses, suggestions, overall_feedback } = body;

  // At least one field must be non-empty
  const hasRating = rating !== undefined && rating !== null;
  const hasStrengths = Array.isArray(strengths) && strengths.length > 0;
  const hasWeaknesses = Array.isArray(weaknesses) && weaknesses.length > 0;
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;
  const hasOverall = typeof overall_feedback === 'string' && overall_feedback.trim().length > 0;

  if (!hasRating && !hasStrengths && !hasWeaknesses && !hasSuggestions && !hasOverall) {
    return 'At least one feedback field must be provided';
  }

  if (hasRating && (rating! < 1 || rating! > 10 || !Number.isInteger(rating))) {
    return 'Rating must be an integer between 1 and 10';
  }

  for (const [name, arr] of [['strengths', strengths], ['weaknesses', weaknesses], ['suggestions', suggestions]] as const) {
    if (Array.isArray(arr)) {
      if (arr.length > 10) return `${name} cannot exceed 10 items`;
      for (const item of arr) {
        if (typeof item !== 'string') return `Each ${name} item must be a string`;
        if (item.length > 500) return `Each ${name} item must be 500 characters or less`;
      }
    }
  }

  if (hasOverall && overall_feedback!.length > 2000) {
    return 'Overall feedback must be 2000 characters or less';
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /api/pitches/:id/feedback
// ---------------------------------------------------------------------------
export async function submitPitchFeedback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const authResult = await getAuthenticatedUser(request, env);
  if (!authResult.authenticated || !authResult.user) {
    return errorResponse('Unauthorized', origin, 401);
  }

  const { id: userId, userType } = authResult.user;

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body: FeedbackBody = await request.json();

    // Watchers can only submit a rating — no structured feedback
    const hasStructuredFields = (
      (Array.isArray(body.strengths) && body.strengths.some(s => s.trim())) ||
      (Array.isArray(body.weaknesses) && body.weaknesses.some(s => s.trim())) ||
      (Array.isArray(body.suggestions) && body.suggestions.some(s => s.trim())) ||
      (typeof body.overall_feedback === 'string' && body.overall_feedback.trim().length > 0)
    );
    if (userType === 'watcher' && hasStructuredFields) {
      return errorResponse('Watchers can only submit a rating, not structured feedback', origin, 403);
    }

    // Verify pitch exists, is published, and user is not the owner
    const [pitch] = await sql`
      SELECT id, user_id FROM pitches WHERE id = ${pitchId} AND status = 'published'
    `;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);
    if (String(pitch.user_id) === String(userId)) {
      return errorResponse('Cannot review your own pitch', origin, 403);
    }

    // Consumption gating — require minimum 30 seconds of view time.
    // Skipped for: watchers (rating-only audience tier, no deep access to gate)
    // and production users (evaluating at scale; the 30s floor is more friction
    // than signal for production decision-making).
    if (userType !== 'watcher' && userType !== 'production') {
      const CONSUMPTION_THRESHOLD = 30;
      const viewResult = await safeQuery<{ total_duration: number }>(
        () => sql`
          SELECT COALESCE(MAX(view_duration), 0)::int as total_duration
          FROM views WHERE pitch_id = ${pitchId} AND viewer_id = ${Number(userId)}
        `,
        { fallback: [{ total_duration: 0 }], context: 'pitch-feedback.consumption-gate', tags: { pitchId, userId: String(userId) } },
      );
      // Fail closed on query error — don't let a schema drift let submissions through silently.
      if (!viewResult.ok) {
        return errorResponse(
          'Unable to verify view duration — please refresh and try again',
          origin, 503
        );
      }
      const viewData = viewResult.rows[0];
      if ((viewData?.total_duration || 0) < CONSUMPTION_THRESHOLD) {
        return errorResponse(
          `Please spend at least ${CONSUMPTION_THRESHOLD} seconds reviewing this pitch before leaving feedback`,
          origin, 403
        );
      }
    }

    const validationError = validateFeedback(body);
    if (validationError) return errorResponse(validationError, origin);

    const reviewerType = mapUserType(userType);
    const reviewerWeight = getRoleWeight(reviewerType);
    const strengths = Array.isArray(body.strengths) ? body.strengths.filter(s => s.trim()) : [];
    const weaknesses = Array.isArray(body.weaknesses) ? body.weaknesses.filter(s => s.trim()) : [];
    const suggestions = Array.isArray(body.suggestions) ? body.suggestions.filter(s => s.trim()) : [];
    const overallFeedback = body.overall_feedback?.trim() || null;
    const rating = body.rating ?? null;
    const isInterested = body.is_interested ?? false;
    const isAnonymous = body.is_anonymous ?? false;

    // Upsert (was DO NOTHING): a row may already exist from a prior quick-rate on the
    // same pitch. DO NOTHING silently dropped the written feedback and returned 409, so
    // the user re-entered everything ("the feedback thing is bugging" — Karl). Merge the
    // structured fields into the existing row instead; preserve the existing rating when
    // the structured submit doesn't carry one.
    const result = await sql`
      INSERT INTO pitch_feedback (pitch_id, reviewer_id, reviewer_type, rating, strengths, weaknesses, suggestions, overall_feedback, is_interested, is_anonymous, reviewer_weight)
      VALUES (${pitchId}, ${Number(userId)}, ${reviewerType}, ${rating}, ${strengths}, ${weaknesses}, ${suggestions}, ${overallFeedback}, ${isInterested}, ${isAnonymous}, ${reviewerWeight})
      ON CONFLICT (pitch_id, reviewer_id) DO UPDATE SET
        reviewer_type = EXCLUDED.reviewer_type,
        rating = COALESCE(EXCLUDED.rating, pitch_feedback.rating),
        strengths = EXCLUDED.strengths,
        weaknesses = EXCLUDED.weaknesses,
        suggestions = EXCLUDED.suggestions,
        overall_feedback = EXCLUDED.overall_feedback,
        is_interested = EXCLUDED.is_interested,
        is_anonymous = EXCLUDED.is_anonymous,
        reviewer_weight = EXCLUDED.reviewer_weight
      RETURNING id, created_at
    `;

    await updateRatingStats(sql, pitchId);

    // Notify the pitch owner of new feedback (previously a silent gap). Respect
    // the anonymous flag — null the actor so related_user_id can't unmask the reviewer.
    await notifyPitchOwner(sql, {
      ownerId: Number(pitch.user_id),
      actorId: isAnonymous ? null : Number(userId),
      pitchId,
      type: 'pitch_feedback',
      title: 'New feedback on your pitch',
      message: rating ? `Your pitch received new feedback (${rating}★).` : 'Your pitch received new feedback.',
    });

    return jsonResponse({ success: true, data: result[0] }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('submitPitchFeedback error:', e.message);
    return errorResponse('Failed to submit feedback', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/pitches/:id/feedback
// ---------------------------------------------------------------------------
export async function updatePitchFeedback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body: FeedbackBody = await request.json();
    const validationError = validateFeedback(body);
    if (validationError) return errorResponse(validationError, origin);

    const strengths = Array.isArray(body.strengths) ? body.strengths.filter(s => s.trim()) : [];
    const weaknesses = Array.isArray(body.weaknesses) ? body.weaknesses.filter(s => s.trim()) : [];
    const suggestions = Array.isArray(body.suggestions) ? body.suggestions.filter(s => s.trim()) : [];
    const overallFeedback = body.overall_feedback?.trim() || null;
    const rating = body.rating ?? null;
    const isInterested = body.is_interested ?? false;
    const isAnonymous = body.is_anonymous ?? false;

    const result = await sql`
      UPDATE pitch_feedback SET
        rating = ${rating},
        strengths = ${strengths},
        weaknesses = ${weaknesses},
        suggestions = ${suggestions},
        overall_feedback = ${overallFeedback},
        is_interested = ${isInterested},
        is_anonymous = ${isAnonymous}
      WHERE pitch_id = ${pitchId} AND reviewer_id = ${Number(userId)}
      RETURNING id, created_at
    `;

    if (result.length === 0) {
      return errorResponse('No existing feedback to update', origin, 404);
    }

    await updateRatingStats(sql, pitchId);

    return jsonResponse({ success: true, data: result[0] }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updatePitchFeedback error:', e.message);
    return errorResponse('Failed to update feedback', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/pitches/:id/feedback
// ---------------------------------------------------------------------------
export async function deletePitchFeedback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      DELETE FROM pitch_feedback
      WHERE pitch_id = ${pitchId} AND reviewer_id = ${Number(userId)}
      RETURNING id
    `;

    if (result.length === 0) {
      return errorResponse('No feedback found to delete', origin, 404);
    }

    await updateRatingStats(sql, pitchId);

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('deletePitchFeedback error:', e.message);
    return errorResponse('Failed to delete feedback', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/pitches/:id/feedback
// ---------------------------------------------------------------------------
export async function getPitchFeedbackPublic(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { ratings: null, feedback: [] } }, origin);

  try {
    // Verify pitch exists and is published
    const [pitch] = await sql`SELECT id, user_id FROM pitches WHERE id = ${pitchId} AND status = 'published'`;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);

    // Reviewer identity follows the reviewer's OWN choice (P5 decision):
    // non-anonymous feedback shows the reviewer's name to every viewer;
    // anonymous feedback stays hidden. The previous owner/NDA viewer gate was
    // dropped — a reviewer who opts to be named is named for all. Likes remain
    // named separately and are unaffected.

    // Rating aggregation — dual scores + 10-bucket distribution
    const [ratings] = await sql`
      SELECT
        COALESCE(p.pitchey_score_avg, 0) as pitchey_score,
        COALESCE(p.viewer_score_avg, 0) as viewer_score,
        COALESCE(p.rating_average, 0) as avg_rating,
        COALESCE(p.rating_count, 0)::int as total_reviews
      FROM pitches p WHERE p.id = ${pitchId}
    `;
    // 10-bucket distribution from both tables
    const distRows = await sql`
      SELECT rating, COUNT(*)::int as count FROM (
        SELECT rating FROM pitch_feedback WHERE pitch_id = ${pitchId} AND rating IS NOT NULL
        UNION ALL
        SELECT rating FROM pitch_ratings_anonymous WHERE pitch_id = ${pitchId}
      ) all_ratings
      GROUP BY rating ORDER BY rating
    `;
    const distribution = Array.from({ length: 10 }, (_, i) => {
      const row = distRows.find((r: { rating: number }) => Number(r.rating) === i + 1);
      return row ? Number(row.count) : 0;
    });

    // Per-role breakdown — optional field; if the query errors we keep the rest of the
    // response intact. safeQuery reports to Sentry with context tag so schema drift here
    // doesn't go silent (see catch-swallow audit).
    const breakdownResult = await safeQuery<{
      reviewer_type: string;
      count: number;
      avg_rating: string | null;
      weighted_avg: string | null;
    }>(
      () => sql`
        SELECT
          reviewer_type,
          COUNT(*)::int AS count,
          ROUND(AVG(rating)::numeric, 2) AS avg_rating,
          ROUND((SUM(rating * reviewer_weight) / NULLIF(SUM(reviewer_weight), 0))::numeric, 2) AS weighted_avg
        FROM pitch_feedback
        WHERE pitch_id = ${pitchId} AND rating IS NOT NULL
        GROUP BY reviewer_type

        UNION ALL

        SELECT 'anonymous' AS reviewer_type,
               COUNT(*)::int,
               ROUND(AVG(rating)::numeric, 2),
               ROUND(AVG(rating)::numeric, 2)
        FROM pitch_ratings_anonymous
        WHERE pitch_id = ${pitchId}
      `,
      { fallback: [], context: 'pitch-feedback.role-breakdown', tags: { pitchId } },
    );

    const breakdown: Record<string, { count: number; avgRating: number; weightedAvg: number }> | undefined =
      breakdownResult.ok
        ? breakdownResult.rows.reduce((acc, row) => {
            if (row.count > 0) {
              acc[row.reviewer_type] = {
                count: Number(row.count),
                avgRating: Number(row.avg_rating ?? 0),
                weightedAvg: Number(row.weighted_avg ?? 0),
              };
            }
            return acc;
          }, {} as Record<string, { count: number; avgRating: number; weightedAvg: number }>)
        : undefined;

    // Individual feedback. Identity is gated by the reviewer's own choice only:
    // `pf.is_anonymous` → 'Anonymous' with no id/company; otherwise the name is
    // shown to every viewer (P5 — reviewer choice decides, no owner/NDA gate).
    const feedback = await sql`
      SELECT
        pf.id, pf.reviewer_type, pf.rating, pf.strengths, pf.weaknesses,
        pf.suggestions, pf.overall_feedback, pf.is_interested, pf.is_anonymous, pf.created_at,
        CASE WHEN pf.is_anonymous THEN NULL ELSE u.id END as reviewer_id,
        -- Canonical author rule (matches getPitchComments): chosen @username first,
        -- then real name, then the email local-part. Email-shaped usernames are
        -- skipped (no '@handle' that's really an address; no email leak). company_name
        -- is never the author identity — it leaked in as "Slycloth/Sky Cloth" before.
        CASE
          WHEN pf.is_anonymous THEN 'Anonymous'
          ELSE COALESCE(
            CASE WHEN u.username IS NOT NULL AND TRIM(u.username) <> '' AND u.username NOT LIKE '%@%'
                 THEN '@' || u.username END,
            NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
            split_part(u.email, '@', 1),
            'User'
          )
        END as reviewer_name,
        CASE WHEN pf.is_anonymous THEN NULL ELSE u.company_name END as reviewer_company
      FROM pitch_feedback pf
      LEFT JOIN users u ON u.id = pf.reviewer_id
      WHERE pf.pitch_id = ${pitchId}
      ORDER BY pf.created_at DESC
    `;

    return jsonResponse({
      success: true,
      data: {
        ratings: { ...ratings, distribution },
        ...(breakdown && Object.keys(breakdown).length > 0 ? { breakdown } : {}),
        feedback,
      },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getPitchFeedbackPublic error:', e.message);
    return jsonResponse({ success: true, data: { ratings: null, feedback: [] } }, origin);
  }
}

// ---------------------------------------------------------------------------
// GET /api/pitches/:id/feedback/mine
// ---------------------------------------------------------------------------
export async function getMyFeedback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: null }, origin);

  try {
    const [feedback] = await sql`
      SELECT id, rating, strengths, weaknesses, suggestions, overall_feedback,
             is_interested, is_anonymous, reviewer_type, created_at
      FROM pitch_feedback
      WHERE pitch_id = ${pitchId} AND reviewer_id = ${Number(userId)}
    `;

    return jsonResponse({ success: true, data: feedback || null }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getMyFeedback error:', e.message);
    return jsonResponse({ success: true, data: null }, origin);
  }
}

// ---------------------------------------------------------------------------
// GET /api/pitches/:id/consumption-status
// ---------------------------------------------------------------------------
export async function getConsumptionStatus(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const authResult = await getAuthenticatedUser(request, env);
  if (!authResult.authenticated || !authResult.user) {
    return errorResponse('Unauthorized', origin, 401);
  }
  const { id: userId, userType } = authResult.user;

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const THRESHOLD = 30;

  // Mirrors submitPitchFeedback's skip list — production and watcher users
  // aren't subject to the 30s floor, so report eligible upfront so the UI
  // doesn't render a progress bar that will never complete.
  if (userType === 'production' || userType === 'watcher') {
    return jsonResponse({
      success: true,
      data: { eligible: true, viewDuration: THRESHOLD, threshold: THRESHOLD, exempt: true },
    }, origin);
  }

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { eligible: false, viewDuration: 0, threshold: THRESHOLD } }, origin);

  try {
    const viewResult = await safeQuery<{ total_duration: number }>(
      () => sql`
        SELECT COALESCE(MAX(view_duration), 0)::int as total_duration
        FROM views WHERE pitch_id = ${pitchId} AND viewer_id = ${Number(userId)}
      `,
      { fallback: [{ total_duration: 0 }], context: 'pitch-feedback.consumption-status', tags: { pitchId, userId: String(userId) } },
    );

    const duration = viewResult.rows[0]?.total_duration || 0;
    return jsonResponse({
      success: true,
      data: { eligible: duration >= THRESHOLD, viewDuration: duration, threshold: THRESHOLD }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getConsumptionStatus error:', e.message);
    return jsonResponse({ success: true, data: { eligible: false, viewDuration: 0, threshold: THRESHOLD } }, origin);
  }
}

// ---------------------------------------------------------------------------
// POST /api/pitches/:id/rate  (public — anonymous rating)
// ---------------------------------------------------------------------------
export async function submitAnonymousRating(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as { rating?: number };
    const rating = body.rating;
    if (!rating || rating < 1 || rating > 10 || !Number.isInteger(rating)) {
      return errorResponse('Rating must be an integer between 1 and 10', origin);
    }

    // Verify pitch exists and is published
    const [pitch] = await sql`SELECT id, user_id FROM pitches WHERE id = ${pitchId} AND status = 'published'`;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);

    // Logged-in users: store the rating in pitch_feedback keyed by reviewer_id
    // so it carries their role weight (not the anonymous 0.25) and merges with
    // any structured feedback they leave. Only the rating column is touched on
    // conflict — strengths/weaknesses/suggestions from the full form are kept.
    const authResult = await getAuthenticatedUser(request, env);
    if (authResult.authenticated && authResult.user) {
      const { id: userId, userType } = authResult.user;
      if (String(pitch.user_id) === String(userId)) {
        return errorResponse('Cannot rate your own pitch', origin, 403);
      }
      const reviewerType = mapUserType(userType);
      const reviewerWeight = getRoleWeight(reviewerType);
      await sql`
        INSERT INTO pitch_feedback (pitch_id, reviewer_id, reviewer_type, rating, strengths, weaknesses, suggestions, overall_feedback, is_interested, is_anonymous, reviewer_weight)
        VALUES (${pitchId}, ${Number(userId)}, ${reviewerType}, ${rating}, ${[]}, ${[]}, ${[]}, ${null}, ${false}, ${false}, ${reviewerWeight})
        ON CONFLICT (pitch_id, reviewer_id) DO UPDATE SET rating = EXCLUDED.rating
      `;
      await updateRatingStats(sql, pitchId);
      return jsonResponse({ success: true, data: { rating } }, origin, 201);
    }

    // Anonymous — IP-based dedup into pitch_ratings_anonymous (weight 0.25)
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip}:${pitchId}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    await sql`
      INSERT INTO pitch_ratings_anonymous (pitch_id, rating, ip_hash, reviewer_weight)
      VALUES (${pitchId}, ${rating}, ${ipHash}, 0.25)
      ON CONFLICT (pitch_id, ip_hash) DO UPDATE SET rating = EXCLUDED.rating
    `;

    await updateRatingStats(sql, pitchId);

    return jsonResponse({ success: true, data: { rating } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('submitAnonymousRating error:', e.message);
    return errorResponse('Failed to submit rating', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/pitches/:id/rating-status  (returns user's current rating)
// ---------------------------------------------------------------------------
export async function getRatingStatus(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const userId = await getUserId(request, env);
  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { rating: null } }, origin);

  try {
    if (userId) {
      const [row] = await sql`
        SELECT rating FROM pitch_feedback WHERE pitch_id = ${pitchId} AND reviewer_id = ${Number(userId)}
      `;
      return jsonResponse({ success: true, data: { rating: row?.rating ?? null } }, origin);
    }

    // Anonymous — check by IP hash
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip}:${pitchId}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const [row] = await sql`
      SELECT rating FROM pitch_ratings_anonymous WHERE pitch_id = ${pitchId} AND ip_hash = ${ipHash}
    `;
    return jsonResponse({ success: true, data: { rating: row?.rating ?? null } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getRatingStatus error:', e.message);
    return jsonResponse({ success: true, data: { rating: null } }, origin);
  }
}

// ---------------------------------------------------------------------------
// POST /api/pitches/:id/comments
// ---------------------------------------------------------------------------
export async function submitPitchComment(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as { content?: string; isAnonymous?: boolean };
    const content = body.content?.trim();
    if (!content || content.length === 0) return errorResponse('Comment content is required', origin);
    if (content.length > 2000) return errorResponse('Comment must be 2000 characters or less', origin);
    const isAnonymous = body.isAnonymous === true;

    const [pitch] = await sql`SELECT id, user_id FROM pitches WHERE id = ${pitchId} AND status = 'published'`;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);

    // Check auth (optional — anonymous can comment too)
    const userId = await getUserId(request, env);
    let userType: string | null = null;

    if (userId) {
      const [user] = await sql`SELECT user_type FROM users WHERE id = ${Number(userId)}`;
      userType = user?.user_type || null;
    }

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip}:comment`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const result = await sql`
      INSERT INTO pitch_comments (pitch_id, user_id, user_type, content, ip_hash, is_anonymous)
      VALUES (${pitchId}, ${userId ? Number(userId) : null}, ${userType}, ${content}, ${ipHash}, ${isAnonymous})
      RETURNING id, created_at
    `;

    // Notify the pitch owner that someone commented (previously a silent gap —
    // the comment was stored but the creator got no signal). Anonymous commenter
    // → actorId null so we don't expose a non-existent/identifiable user.
    await notifyPitchOwner(sql, {
      ownerId: Number(pitch.user_id),
      actorId: userId ? Number(userId) : null,
      pitchId,
      type: 'pitch_comment',
      title: 'New comment on your pitch',
      message: 'Someone left a comment on your pitch.',
    });

    return jsonResponse({ success: true, data: result[0] }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('submitPitchComment error:', e.message);
    return errorResponse('Failed to submit comment', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/pitches/:id/comments
// ---------------------------------------------------------------------------
export async function getPitchComments(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: [] }, origin);

  try {
    const [pitch] = await sql`SELECT id, user_id FROM pitches WHERE id = ${pitchId} AND status = 'published'`;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);

    // Check if requester has NDA access (signed NDA or is the pitch owner)
    const userId = await getUserId(request, env);
    const isOwner = !!userId && String(pitch.user_id) === String(userId);
    let hasNda = false;
    if (userId) {
      if (isOwner) {
        hasNda = true;
      } else {
        const ndaResult = await safeQuery(
          () => sql`
            SELECT 1 FROM pitch_ndas
            WHERE pitch_id = ${pitchId} AND user_id = ${Number(userId)} AND status = 'signed'
            LIMIT 1
          `,
          { fallback: [], context: 'pitch-feedback.nda-access-check', tags: { pitchId, userId: String(userId) } },
        );
        hasNda = ndaResult.rows.length > 0;
      }
    }

    const comments = await sql`
      SELECT
        pc.id, pc.content, pc.created_at, pc.user_id,
        pc.user_type, pc.is_anonymous,
        -- Canonical author rule (matches getPitchFeedbackPublic): chosen @username
        -- first, then real name, then the email local-part. Email-shaped usernames are
        -- skipped (no email leak). Never company_name — that surfaced Karl as "Sky Cloth".
        COALESCE(
          CASE WHEN u.username IS NOT NULL AND TRIM(u.username) <> '' AND u.username NOT LIKE '%@%'
               THEN '@' || u.username END,
          NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
          split_part(u.email, '@', 1),
          'User'
        ) as author_name
      FROM pitch_comments pc
      LEFT JOIN users u ON u.id = pc.user_id
      WHERE pc.pitch_id = ${pitchId}
      ORDER BY pc.created_at DESC
      LIMIT 100
    `;

    const anonymized = comments.map((c: Record<string, unknown>) => {
      // Author chose to post anonymously: hide identity from everyone EXCEPT the
      // pitch owner, who can always see who wrote it (accountability + moderation).
      if (c.is_anonymous) {
        if (isOwner && c.user_id) {
          return {
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            display_name: c.author_name || 'User',
            user_type: c.user_type,
            is_anonymous: true,
          };
        }
        return {
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          display_name: 'Anonymous',
          user_type: 'anonymous',
          is_anonymous: true,
        };
      }

      // Named comment — display name follows the existing NDA gate: real name to
      // the owner + NDA-signed viewers, role-based pseudonym to everyone else.
      if (hasNda && c.user_id) {
        return {
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          display_name: c.author_name || 'User',
          user_type: c.user_type,
          is_anonymous: false,
        };
      }
      const role = c.user_type || 'viewer';
      const suffix = c.user_id ? c.user_id : c.id;
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        display_name: `${role}${suffix}`,
        user_type: c.user_type || 'anonymous',
        is_anonymous: false,
      };
    });

    return jsonResponse({ success: true, data: anonymized }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getPitchComments error:', e.message);
    return jsonResponse({ success: true, data: [] }, origin);
  }
}
