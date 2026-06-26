/**
 * Thesis matching (moat #7, phase 2) — turns the structured investor_thesis
 * (migration 116) into a two-way demand↔supply signal:
 *
 *  - GET /api/investor/thesis/matches        → published pitches matching MY thesis
 *  - GET /api/pitches/:id/matching-investors → public investor theses matching a pitch
 *
 * Matching is anchored on GENRE (`pitches.genre` ∈ `investor_thesis.genres`), the one
 * clean, reliable dimension — pitch budget columns drift (budget / budget_range /
 * estimated_budget) so budget is intentionally NOT used. Format/stage add to a match
 * score but never gate. All reads are defensive: a missing `investor_thesis` table
 * (migration not applied) or any schema drift degrades to an empty result, never a 500.
 */
import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getUserId, requireRole } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
  return new Response(JSON.stringify(data), { status, headers });
}

function isMissingThesisTable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /relation .*investor_thesis.* does not exist/i.test(msg)
    || (/does not exist/i.test(msg) && /investor_thesis/i.test(msg));
}

// ---------------------------------------------------------------------------
// GET /api/investor/thesis/matches
// Published pitches that match the authenticated investor's thesis.
// ---------------------------------------------------------------------------
export async function getThesisMatchesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  const roleCheck = await requireRole(request, env, ['investor']);
  if ('error' in roleCheck) return roleCheck.error;
  const userId = roleCheck.user.id;

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, matches: [] }, origin);

  try {
    // Genre gates the match (or thesis has no genres → all published pitches);
    // format + stage boost the score. p.user_id is the creator (with creator_id drift).
    const rows = await sql`
      SELECT p.id,
             p.title,
             p.genre,
             p.format,
             p.logline,
             p.user_id AS creator_id,
             p.created_at,
             ( (CASE WHEN p.genre  = ANY(t.genres)  THEN 1 ELSE 0 END)
             + (CASE WHEN p.format = ANY(t.formats) THEN 1 ELSE 0 END)
             + (CASE WHEN p.stage  = ANY(t.stages)  THEN 1 ELSE 0 END) ) AS match_score
      FROM pitches p
      CROSS JOIN investor_thesis t
      WHERE t.investor_id = ${userId}
        AND p.status = 'published'
        AND ( cardinality(t.genres) = 0 OR p.genre = ANY(t.genres) )
      ORDER BY match_score DESC, p.created_at DESC
      LIMIT 50
    `;
    return jsonResponse({ success: true, matches: rows }, origin);
  } catch (error) {
    if (!isMissingThesisTable(error)) {
      const e = error instanceof Error ? error : new Error(String(error));
      console.error('[getThesisMatchesHandler] Query error:', e.message);
    }
    // No thesis table / schema drift / no thesis row → no matches (never 500).
    return jsonResponse({ success: true, matches: [] }, origin);
  }
}

// ---------------------------------------------------------------------------
// GET /api/pitches/:id/matching-investors
// Public investor theses whose genres include this pitch's genre (the creator-facing
// demand signal). Any authenticated user may read; only is_public theses are returned.
// ---------------------------------------------------------------------------
export async function getMatchingInvestorsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  const userId = await getUserId(request, env);
  if (userId == null) return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);

  // /api/pitches/:id/matching-investors
  const parts = new URL(request.url).pathname.split('/');
  const pitchId = Number(parts[3]);
  if (!Number.isFinite(pitchId)) {
    return jsonResponse({ success: false, error: 'Invalid pitch id' }, origin, 400);
  }

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, investors: [] }, origin);

  try {
    const investors = await sql`
      SELECT it.investor_id,
             u.username,
             u.company_name,
             it.genres,
             it.formats,
             it.positioning,
             it.check_size_min_usd,
             it.check_size_max_usd,
             it.updated_at
      FROM investor_thesis it
      JOIN users u ON u.id = it.investor_id
      WHERE it.is_public = TRUE
        AND ( SELECT genre FROM pitches WHERE id = ${pitchId} ) = ANY(it.genres)
      ORDER BY it.updated_at DESC
      LIMIT 50
    `;
    return jsonResponse({ success: true, investors }, origin);
  } catch (error) {
    if (!isMissingThesisTable(error)) {
      const e = error instanceof Error ? error : new Error(String(error));
      console.error('[getMatchingInvestorsHandler] Query error:', e.message);
    }
    return jsonResponse({ success: true, investors: [] }, origin);
  }
}
