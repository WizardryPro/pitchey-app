/**
 * Comparison handler — side-by-side metric matrix for 2–4 subjects.
 *
 * Phase 1: `type=creator` only — aggregate a creator's PUBLISHED pitches into a
 * comparable bundle. Read-only, no new tables. Authenticated only (not listed in
 * worker `publicEndpoints`, so the global auth gate applies; we also self-check).
 *
 * The endpoint is shaped to extend to `type=slate` / `type=pitch` later without
 * changing the response contract ({ type, subjects: [...] }).
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

// GET /api/compare/creators?q= — typeahead for the comparison picker.
export async function searchCreatorsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 1) return jsonResponse({ creators: [] }, origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ creators: [] }, origin);

  try {
    const rows = await sql`
      SELECT
        u.id,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS name,
        u.username,
        u.user_type,
        COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) AS avatar
      FROM users u
      WHERE u.user_type IN ('creator', 'production')
        AND (u.username ILIKE ${'%' + q + '%'} OR u.company_name ILIKE ${'%' + q + '%'}
             OR u.first_name ILIKE ${'%' + q + '%'} OR u.last_name ILIKE ${'%' + q + '%'})
      ORDER BY u.username
      LIMIT 10
    `;
    return jsonResponse({ creators: rows }, origin);
  } catch (err) {
    console.error('searchCreatorsHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ creators: [] }, origin);
  }
}

// GET /api/compare/slates?q= — typeahead for the slate comparison picker.
// Returns published slates + the current user's own slates.
export async function searchSlatesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 1) return jsonResponse({ slates: [] }, origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ slates: [] }, origin);

  try {
    const rows = await sql`
      SELECT
        s.id,
        s.title AS name,
        s.cover_image AS thumbnail,
        s.status,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS owner,
        (SELECT COUNT(*) FROM slate_pitches sp WHERE sp.slate_id = s.id) AS pitch_count
      FROM slates s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE (s.status = 'published' OR s.user_id = ${userId})
        AND s.title ILIKE ${'%' + q + '%'}
      ORDER BY s.title
      LIMIT 10
    `;
    return jsonResponse({ slates: rows }, origin);
  } catch (err) {
    console.error('searchSlatesHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ slates: [] }, origin);
  }
}

// Aggregate the metric bundle per subject. Shared by the live compare endpoint
// and the public shared-token view so the matrix always reflects current data.
async function computeSubjects(sql: ReturnType<typeof getDb>, type: string, unique: number[]): Promise<unknown[]> {
  if (!sql || unique.length === 0) return [];
  const placeholders = unique.map((_, i) => `$${i + 1}`).join(',');
  let query: string;

  if (type === 'pitch') {
    query = `
      SELECT
        p.id AS subject_id, p.title AS name,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS subtitle,
        p.title_image AS thumbnail, u.verification_tier, NULL::int AS pitch_count,
        ROUND(COALESCE(p.heat_score, 0), 1) AS avg_heat,
        ROUND(NULLIF(p.pitchey_score_avg, 0), 1) AS avg_pitchey,
        COALESCE(p.view_count, 0) AS total_views, COALESCE(p.like_count, 0) AS total_likes,
        NULLIF(p.estimated_budget_usd, 0) AS budget_min, NULLIF(p.estimated_budget_usd, 0) AS budget_max,
        p.created_at AS newest_at, p.genre, p.format,
        ARRAY_REMOVE(ARRAY[p.genre], NULL) AS genres
      FROM pitches p
      LEFT JOIN users u ON (u.id = p.user_id OR u.id = p.creator_id)
      WHERE p.id IN (${placeholders})
    `;
  } else if (type === 'slate') {
    query = `
      SELECT
        s.id AS subject_id, s.title AS name,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS subtitle,
        s.cover_image AS thumbnail, u.verification_tier,
        COUNT(p.id) AS pitch_count,
        ROUND(AVG(p.heat_score), 1) AS avg_heat,
        ROUND(AVG(NULLIF(p.pitchey_score_avg, 0)), 1) AS avg_pitchey,
        COALESCE(SUM(p.view_count), 0) AS total_views, COALESCE(SUM(p.like_count), 0) AS total_likes,
        MIN(p.estimated_budget_usd) FILTER (WHERE p.estimated_budget_usd > 0) AS budget_min,
        MAX(p.estimated_budget_usd) AS budget_max, MAX(p.created_at) AS newest_at,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.genre), NULL) AS genres
      FROM slates s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN slate_pitches sp ON sp.slate_id = s.id
      LEFT JOIN pitches p ON p.id = sp.pitch_id AND p.status = 'published'
      WHERE s.id IN (${placeholders})
      GROUP BY s.id, u.id
    `;
  } else {
    query = `
      SELECT
        u.id AS subject_id,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS name,
        u.username, u.user_type, u.verification_tier,
        COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) AS avatar,
        COUNT(p.id) AS pitch_count,
        ROUND(AVG(p.heat_score), 1) AS avg_heat,
        ROUND(AVG(NULLIF(p.pitchey_score_avg, 0)), 1) AS avg_pitchey,
        COALESCE(SUM(p.view_count), 0) AS total_views, COALESCE(SUM(p.like_count), 0) AS total_likes,
        MIN(p.estimated_budget_usd) FILTER (WHERE p.estimated_budget_usd > 0) AS budget_min,
        MAX(p.estimated_budget_usd) AS budget_max, MAX(p.created_at) AS newest_at,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.genre), NULL) AS genres
      FROM users u
      LEFT JOIN pitches p ON (p.user_id = u.id OR p.creator_id = u.id) AND p.status = 'published'
      WHERE u.id IN (${placeholders})
      GROUP BY u.id
    `;
  }

  const rows = await sql.query(query, unique);
  // Preserve the requested order so UI columns line up.
  const byId = new Map((rows as Array<Record<string, unknown>>).map((r) => [Number(r.subject_id), r]));
  return unique.map((id) => byId.get(id)).filter(Boolean);
}

function parseIds(raw: string): number[] {
  const ids = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  return Array.from(new Set(ids)).slice(0, 4);
}

function lastSegment(request: Request): string {
  const segs = new URL(request.url).pathname.split('/').filter(Boolean);
  return segs[segs.length - 1] || '';
}

export async function compareHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || 'creator').toLowerCase();
  if (type !== 'creator' && type !== 'pitch' && type !== 'slate') return errorResponse('Unsupported comparison type', origin, 400);
  const unique = parseIds(url.searchParams.get('ids') || '');
  if (unique.length === 0) return jsonResponse({ type, subjects: [] }, origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ type, subjects: [] }, origin);

  try {
    const subjects = await computeSubjects(sql, type, unique);
    return jsonResponse({ type, subjects }, origin);
  } catch (err) {
    console.error('compareHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to build comparison', origin, 500);
  }
}

// ===========================================================================
// Saved & shareable comparisons (Phase 3)
// ===========================================================================

// POST /api/compare/saved — save the current comparison, returns a share token.
export async function saveComparisonHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = String(body.type ?? 'creator').toLowerCase();
    if (type !== 'creator' && type !== 'pitch' && type !== 'slate') return errorResponse('Unsupported comparison type', origin, 400);
    const unique = parseIds(Array.isArray(body.ids) ? body.ids.join(',') : String(body.ids ?? ''));
    if (unique.length < 2) return errorResponse('Add at least 2 to save a comparison', origin, 400);
    const title = (String(body.title ?? '').trim() || 'Comparison').slice(0, 160);
    const token = crypto.randomUUID().replace(/-/g, '');

    const [row] = await sql`
      INSERT INTO saved_comparisons (user_id, title, subject_type, subject_ids, share_token)
      VALUES (${userId}, ${title}, ${type}, ${unique.join(',')}, ${token})
      RETURNING id, share_token
    `;
    return jsonResponse({ id: row?.id, share_token: row?.share_token }, origin, 201);
  } catch (err) {
    console.error('saveComparisonHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to save comparison', origin, 500);
  }
}

// GET /api/compare/saved — the user's saved comparisons.
export async function listSavedComparisonsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ comparisons: [] }, origin);

  try {
    const rows = await sql`
      SELECT id, title, subject_type, subject_ids, share_token, created_at
      FROM saved_comparisons WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 50
    `;
    return jsonResponse({ comparisons: rows }, origin);
  } catch (err) {
    console.error('listSavedComparisonsHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ comparisons: [] }, origin);
  }
}

// DELETE /api/compare/saved/:id — delete one of the user's saved comparisons.
export async function deleteSavedComparisonHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const id = parseInt(lastSegment(request), 10);
  if (!Number.isFinite(id)) return errorResponse('Invalid id', origin, 400);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    await sql`DELETE FROM saved_comparisons WHERE id = ${id} AND user_id = ${userId}`;
    return jsonResponse({ deleted: true }, origin);
  } catch (err) {
    console.error('deleteSavedComparisonHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to delete', origin, 500);
  }
}

// GET /api/compare/shared/:token — PUBLIC read-only view (recomputed live).
export async function sharedComparisonHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const token = lastSegment(request);
  if (!token) return errorResponse('Invalid link', origin, 400);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const [saved] = await sql`SELECT title, subject_type, subject_ids FROM saved_comparisons WHERE share_token = ${token}`;
    if (!saved) return errorResponse('Comparison not found', origin, 404);
    const unique = parseIds(String(saved.subject_ids));
    const subjects = await computeSubjects(sql, String(saved.subject_type), unique);
    return jsonResponse({ title: saved.title, type: saved.subject_type, subjects }, origin);
  } catch (err) {
    console.error('sharedComparisonHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to load comparison', origin, 500);
  }
}
