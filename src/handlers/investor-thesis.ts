/**
 * Investor Thesis Handlers
 *
 * Structured investment thesis, 1:1 with users (PK = investor_id), backed by
 * the `investor_thesis` table (migration 116). Replaces the old free-text
 * `users.bio`-as-thesis.
 *
 * Wire format is camelCase; DB is snake_case — mapped in both directions here.
 * Table absence (migration not yet applied) is handled gracefully: GET returns
 * empty defaults, PUT returns a clear 503.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { requireRole } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface ThesisObject {
  genres: string[];
  formats: string[];
  stages: string[];
  dealTypes: string[];
  territories: string[];
  themes: string[];
  budgetMinUsd: number | null;
  budgetMaxUsd: number | null;
  checkSizeMinUsd: number | null;
  checkSizeMaxUsd: number | null;
  positioning: string;
  isPublic: boolean;
}

function emptyThesis(): ThesisObject {
  return {
    genres: [],
    formats: [],
    stages: [],
    dealTypes: [],
    territories: [],
    themes: [],
    budgetMinUsd: null,
    budgetMaxUsd: null,
    checkSizeMinUsd: null,
    checkSizeMaxUsd: null,
    positioning: '',
    isPublic: true,
  };
}

/** Map a DB row (snake_case) into the camelCase wire shape. */
function rowToThesis(row: Record<string, unknown>): ThesisObject {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  return {
    genres: arr(row.genres),
    formats: arr(row.formats),
    stages: arr(row.stages),
    dealTypes: arr(row.deal_types),
    territories: arr(row.territories),
    themes: arr(row.themes),
    budgetMinUsd: num(row.budget_min_usd),
    budgetMaxUsd: num(row.budget_max_usd),
    checkSizeMinUsd: num(row.check_size_min_usd),
    checkSizeMaxUsd: num(row.check_size_max_usd),
    positioning: typeof row.positioning === 'string' ? row.positioning : '',
    isPublic: row.is_public === undefined || row.is_public === null ? true : Boolean(row.is_public),
  };
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

const MAX_NUMERIC = 1_000_000_000_000; // 1e12

/** Sanitize a string array: coerce, trim, drop empties, dedupe, cap at 50. */
function sanitizeArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (out.length >= 50) break;
    const s = String(item ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Coerce to a non-negative integer clamped to 0..1e12, else null. */
function sanitizeNumeric(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0) return null;
  return Math.min(i, MAX_NUMERIC);
}

/** "Table doesn't exist yet" detector — covers missing relation across drift. */
function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Postgres: 42P01 undefined_table → "relation \"investor_thesis\" does not exist"
  return /relation .*investor_thesis.* does not exist/i.test(msg)
    || /does not exist/i.test(msg) && /investor_thesis/i.test(msg);
}

// ---------------------------------------------------------------------------
// GET /api/investor/thesis
// ---------------------------------------------------------------------------
export async function getInvestorThesisHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  const roleCheck = await requireRole(request, env, ['investor']);
  if ('error' in roleCheck) return roleCheck.error;
  const userId = roleCheck.user.id;

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, thesis: emptyThesis() }, origin);
  }

  try {
    const rows = await sql`
      SELECT genres, formats, stages, deal_types, territories, themes,
             budget_min_usd, budget_max_usd, check_size_min_usd, check_size_max_usd,
             positioning, is_public
      FROM investor_thesis
      WHERE investor_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    return jsonResponse(
      { success: true, thesis: row ? rowToThesis(row) : emptyThesis() },
      origin,
    );
  } catch (error) {
    // Missing table (migration 116 not applied) or any read error → empty defaults.
    // Never 500 on a missing store.
    if (!isMissingTable(error)) {
      const e = error instanceof Error ? error : new Error(String(error));
      console.error('[getInvestorThesisHandler] Query error:', e.message);
    }
    return jsonResponse({ success: true, thesis: emptyThesis() }, origin);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/investor/thesis
// ---------------------------------------------------------------------------
export async function updateInvestorThesisHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  const roleCheck = await requireRole(request, env, ['investor']);
  if ('error' in roleCheck) return roleCheck.error;
  const userId = roleCheck.user.id;

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: false, error: 'thesis store unavailable' }, origin, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Sanitize (do NOT hard-reject — the frontend constrains choices).
  const genres = sanitizeArray(body.genres);
  const formats = sanitizeArray(body.formats);
  const stages = sanitizeArray(body.stages);
  const dealTypes = sanitizeArray(body.dealTypes);
  const territories = sanitizeArray(body.territories);
  const themes = sanitizeArray(body.themes);
  const budgetMinUsd = sanitizeNumeric(body.budgetMinUsd);
  const budgetMaxUsd = sanitizeNumeric(body.budgetMaxUsd);
  const checkSizeMinUsd = sanitizeNumeric(body.checkSizeMinUsd);
  const checkSizeMaxUsd = sanitizeNumeric(body.checkSizeMaxUsd);
  const positioning = (typeof body.positioning === 'string' ? body.positioning : '').slice(0, 4000);
  const isPublic = body.isPublic === undefined ? true : Boolean(body.isPublic);

  try {
    // Capture the prior genres BEFORE the upsert, to detect newly-added interest for
    // the reverse notify below (so re-saving an unchanged thesis never re-notifies).
    let prevGenres: string[] = [];
    try {
      const prev = await sql`SELECT genres FROM investor_thesis WHERE investor_id = ${userId} LIMIT 1`;
      const g = (prev[0] as { genres?: unknown } | undefined)?.genres;
      if (Array.isArray(g)) prevGenres = g as string[];
    } catch { /* table may be absent — treat as no prior genres */ }

    const rows = await sql`
      INSERT INTO investor_thesis (
        investor_id, genres, formats, stages, deal_types, territories, themes,
        budget_min_usd, budget_max_usd, check_size_min_usd, check_size_max_usd,
        positioning, is_public, created_at, updated_at
      ) VALUES (
        ${userId},
        ${genres}::text[], ${formats}::text[], ${stages}::text[],
        ${dealTypes}::text[], ${territories}::text[], ${themes}::text[],
        ${budgetMinUsd}, ${budgetMaxUsd}, ${checkSizeMinUsd}, ${checkSizeMaxUsd},
        ${positioning}, ${isPublic}, now(), now()
      )
      ON CONFLICT (investor_id) DO UPDATE SET
        genres = EXCLUDED.genres,
        formats = EXCLUDED.formats,
        stages = EXCLUDED.stages,
        deal_types = EXCLUDED.deal_types,
        territories = EXCLUDED.territories,
        themes = EXCLUDED.themes,
        budget_min_usd = EXCLUDED.budget_min_usd,
        budget_max_usd = EXCLUDED.budget_max_usd,
        check_size_min_usd = EXCLUDED.check_size_min_usd,
        check_size_max_usd = EXCLUDED.check_size_max_usd,
        positioning = EXCLUDED.positioning,
        is_public = EXCLUDED.is_public,
        updated_at = now()
      RETURNING genres, formats, stages, deal_types, territories, themes,
                budget_min_usd, budget_max_usd, check_size_min_usd, check_size_max_usd,
                positioning, is_public
    `;
    const row = rows[0];

    // Reverse notify (moat #7): when the investor ADDS a genre to their thesis, alert
    // creators with published pitches in that genre that a new mandate matches their work.
    // Diff-on-save (only newly-added genres) + capped + fire-and-forget — never blocks the
    // save, and an absent notifications/pitches column degrades silently.
    const addedGenres = genres.filter((g) => !prevGenres.includes(g));
    if (addedGenres.length > 0) {
      const title = 'An investor is looking for your genre';
      const message = `An investor's thesis now matches your published work — they're interested in ${addedGenres.join(', ')}.`;
      try {
        await sql`
          INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id, action_url, is_read, created_at)
          SELECT DISTINCT p.user_id, 'pitch_update', ${title}, ${message}, NULL::int, ${userId}, '/opportunities', false, NOW()
          FROM pitches p
          WHERE p.status = 'published'
            AND p.genre = ANY(${addedGenres}::text[])
            AND p.user_id IS NOT NULL
            AND p.user_id <> ${userId}
          LIMIT 50
        `;
      } catch (e) {
        console.debug('reverse thesis-match notify failed (non-blocking):', e instanceof Error ? e.message : String(e));
      }
    }

    return jsonResponse({ success: true, thesis: row ? rowToThesis(row) : emptyThesis() }, origin);
  } catch (error) {
    if (isMissingTable(error)) {
      return jsonResponse({ success: false, error: 'thesis store unavailable' }, origin, 503);
    }
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('[updateInvestorThesisHandler] Query error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to save thesis' }, origin, 500);
  }
}
