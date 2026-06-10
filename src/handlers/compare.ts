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

export async function compareHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || 'creator').toLowerCase();
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  const unique = Array.from(new Set(ids)).slice(0, 4);

  if (type !== 'creator') return errorResponse('Only creator comparison is available', origin, 400);
  if (unique.length === 0) return jsonResponse({ type, subjects: [] }, origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ type, subjects: [] }, origin);

  try {
    const placeholders = unique.map((_, i) => `$${i + 1}`).join(',');
    // Aggregate each creator's published pitches. LEFT JOIN keeps creators with
    // no published pitches (they return zero/null metrics). u.id is the PK so the
    // other u.* columns are functionally dependent — GROUP BY u.id is sufficient.
    const query = `
      SELECT
        u.id AS subject_id,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS name,
        u.username,
        u.user_type,
        u.verification_tier,
        COALESCE(u.profile_image_url, u.profile_image, u.avatar_url, u.image) AS avatar,
        COUNT(p.id) AS pitch_count,
        ROUND(AVG(p.heat_score), 1) AS avg_heat,
        ROUND(AVG(NULLIF(p.pitchey_score_avg, 0)), 1) AS avg_pitchey,
        COALESCE(SUM(p.view_count), 0) AS total_views,
        COALESCE(SUM(p.like_count), 0) AS total_likes,
        MIN(p.estimated_budget_usd) FILTER (WHERE p.estimated_budget_usd > 0) AS budget_min,
        MAX(p.estimated_budget_usd) AS budget_max,
        MAX(p.created_at) AS newest_at,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.genre), NULL) AS genres
      FROM users u
      LEFT JOIN pitches p
        ON (p.user_id = u.id OR p.creator_id = u.id) AND p.status = 'published'
      WHERE u.id IN (${placeholders})
      GROUP BY u.id
    `;
    const rows = await sql.query(query, unique);
    // Return in the requested order so the UI columns line up with the picker.
    const byId = new Map((rows as Array<Record<string, unknown>>).map((r) => [Number(r.subject_id), r]));
    const subjects = unique.map((id) => byId.get(id)).filter(Boolean);
    return jsonResponse({ type, subjects }, origin);
  } catch (err) {
    console.error('compareHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to build comparison', origin, 500);
  }
}
