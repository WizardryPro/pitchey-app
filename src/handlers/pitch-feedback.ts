/**
 * Structured Pitch Feedback Handlers
 * Submit, update, delete, and read structured feedback on pitches.
 * Uses the existing pitch_feedback table (migration 018).
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId, getAuthenticatedUser } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
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
  return 'peer';
}

/** Recalculate rating_average and rating_count on pitches from pitch_feedback */
async function updateRatingStats(sql: ReturnType<typeof getDb>, pitchId: number): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE pitches SET
      rating_average = COALESCE(
        (SELECT AVG(rating)::decimal(3,2) FROM pitch_feedback WHERE pitch_id = ${pitchId} AND rating IS NOT NULL), 0
      ),
      rating_count = (SELECT COUNT(*)::int FROM pitch_feedback WHERE pitch_id = ${pitchId} AND rating IS NOT NULL)
    WHERE id = ${pitchId}
  `.catch(() => {});
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

  if (hasRating && (rating! < 1 || rating! > 5 || !Number.isInteger(rating))) {
    return 'Rating must be an integer between 1 and 5';
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
  if (userType === 'watcher') {
    return errorResponse('Watchers cannot leave feedback', origin, 403);
  }

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    // Verify pitch exists, is published, and user is not the owner
    const [pitch] = await sql`
      SELECT id, user_id FROM pitches WHERE id = ${pitchId} AND status = 'published'
    `;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);
    if (String(pitch.user_id) === String(userId)) {
      return errorResponse('Cannot review your own pitch', origin, 403);
    }

    // Consumption gating — require minimum 30 seconds of view time
    const CONSUMPTION_THRESHOLD = 30;
    const [viewData] = await sql`
      SELECT COALESCE(SUM(view_duration), 0)::int as total_duration
      FROM pitch_views WHERE pitch_id = ${pitchId} AND user_id = ${Number(userId)}
    `.catch(() => [{ total_duration: 0 }]);
    if ((viewData?.total_duration || 0) < CONSUMPTION_THRESHOLD) {
      return errorResponse(
        `Please spend at least ${CONSUMPTION_THRESHOLD} seconds reviewing this pitch before leaving feedback`,
        origin, 403
      );
    }

    const body: FeedbackBody = await request.json();
    const validationError = validateFeedback(body);
    if (validationError) return errorResponse(validationError, origin);

    const reviewerType = mapUserType(userType);
    const strengths = Array.isArray(body.strengths) ? body.strengths.filter(s => s.trim()) : [];
    const weaknesses = Array.isArray(body.weaknesses) ? body.weaknesses.filter(s => s.trim()) : [];
    const suggestions = Array.isArray(body.suggestions) ? body.suggestions.filter(s => s.trim()) : [];
    const overallFeedback = body.overall_feedback?.trim() || null;
    const rating = body.rating ?? null;
    const isInterested = body.is_interested ?? false;
    const isAnonymous = body.is_anonymous ?? false;

    const result = await sql`
      INSERT INTO pitch_feedback (pitch_id, reviewer_id, reviewer_type, rating, strengths, weaknesses, suggestions, overall_feedback, is_interested, is_anonymous)
      VALUES (${pitchId}, ${Number(userId)}, ${reviewerType}, ${rating}, ${strengths}, ${weaknesses}, ${suggestions}, ${overallFeedback}, ${isInterested}, ${isAnonymous})
      ON CONFLICT (pitch_id, reviewer_id) DO NOTHING
      RETURNING id, created_at
    `;

    if (result.length === 0) {
      return errorResponse('You have already submitted feedback for this pitch. Use PUT to update.', origin, 409);
    }

    await updateRatingStats(sql, pitchId);

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
    const [pitch] = await sql`SELECT id FROM pitches WHERE id = ${pitchId} AND status = 'published'`;
    if (!pitch) return errorResponse('Pitch not found or not published', origin, 404);

    // Rating aggregation
    const [ratings] = await sql`
      SELECT
        COALESCE(AVG(rating)::decimal(3,2), 0) as avg_rating,
        COUNT(*)::int as total_reviews,
        COUNT(CASE WHEN rating = 5 THEN 1 END)::int as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END)::int as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END)::int as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END)::int as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END)::int as one_star
      FROM pitch_feedback
      WHERE pitch_id = ${pitchId} AND rating IS NOT NULL
    `;

    // Individual feedback with anonymization
    const feedback = await sql`
      SELECT
        pf.id, pf.reviewer_type, pf.rating, pf.strengths, pf.weaknesses,
        pf.suggestions, pf.overall_feedback, pf.is_interested, pf.is_anonymous, pf.created_at,
        CASE WHEN pf.is_anonymous THEN NULL ELSE u.id END as reviewer_id,
        CASE WHEN pf.is_anonymous THEN 'Anonymous' ELSE COALESCE(u.name, u.username, 'User') END as reviewer_name,
        CASE WHEN pf.is_anonymous THEN NULL ELSE u.company_name END as reviewer_company
      FROM pitch_feedback pf
      LEFT JOIN users u ON u.id = pf.reviewer_id
      WHERE pf.pitch_id = ${pitchId}
      ORDER BY pf.created_at DESC
    `;

    return jsonResponse({ success: true, data: { ratings, feedback } }, origin);
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
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { eligible: false, viewDuration: 0, threshold: 30 } }, origin);

  try {
    const THRESHOLD = 30;
    const [viewData] = await sql`
      SELECT COALESCE(SUM(view_duration), 0)::int as total_duration
      FROM pitch_views WHERE pitch_id = ${pitchId} AND user_id = ${Number(userId)}
    `.catch(() => [{ total_duration: 0 }]);

    const duration = viewData?.total_duration || 0;
    return jsonResponse({
      success: true,
      data: { eligible: duration >= THRESHOLD, viewDuration: duration, threshold: THRESHOLD }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getConsumptionStatus error:', e.message);
    return jsonResponse({ success: true, data: { eligible: false, viewDuration: 0, threshold: 30 } }, origin);
  }
}
