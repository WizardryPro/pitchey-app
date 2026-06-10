/**
 * Open Calls (Opportunities board) — Phase 1 handlers.
 *
 * A demand-side sibling to the pitch catalog: production companies and investors
 * post "calls" (mandates) describing what they're seeking; creators browse them.
 * Submissions (creators attaching a pitch to a call) land in Phase 2.
 *
 * Live convention: (request, env) + getUserId() extracted inside; writes self-gate.
 * Public reads are reachable because `/api/calls` is in worker `publicEndpoints`.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_BUDGET_USD = 1_000_000_000;

/** Coerce a client value to a clean integer in [0, $1B], or null. */
function clampBudget(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), MAX_BUDGET_USD);
}

/** Normalise a comma/array list of labels to a trimmed comma-separated string. */
function normaliseList(raw: unknown): string | null {
  let parts: string[] = [];
  if (Array.isArray(raw)) parts = raw.map((x) => String(x));
  else if (typeof raw === 'string') parts = raw.split(',');
  else return null;
  const cleaned = parts.map((s) => s.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : null;
}

/** Pull the trailing numeric :id segment from /api/calls/:id. */
function callIdFromPath(request: Request): number | null {
  const segs = new URL(request.url).pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1];
  const id = parseInt(last, 10);
  return Number.isFinite(id) && String(id) === last ? id : null;
}

// Common SELECT projection — call row + poster display fields.
const CALL_SELECT = `
  c.id, c.poster_user_id, c.poster_type, c.title, c.mandate,
  c.seeking_genres, c.seeking_formats, c.budget_min_usd, c.budget_max_usd,
  c.region, c.status, c.slots, c.deadline, c.created_at, c.updated_at,
  COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS poster_name,
  u.username AS poster_username,
  u.verification_tier AS poster_verification_tier,
  u.user_type AS poster_user_type,
  (SELECT COUNT(*) FROM call_submissions s WHERE s.call_id = c.id) AS submission_count
`;

// Extract the call :id from /api/calls/:id/submissions (id is the 2nd-to-last seg).
function callIdFromSubmissionsPath(request: Request): number | null {
  const segs = new URL(request.url).pathname.split('/').filter(Boolean);
  const idSeg = segs[segs.length - 2];
  const id = parseInt(idSeg, 10);
  return Number.isFinite(id) && String(id) === idSeg ? id : null;
}

// ---------------------------------------------------------------------------
// GET /api/calls — public list of open calls
// ---------------------------------------------------------------------------

export async function listCallsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || 'all').toLowerCase();
  const genre = url.searchParams.get('genre');
  const q = url.searchParams.get('q');
  const status = (url.searchParams.get('status') || 'open').toLowerCase();
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  const sql = getDb(env);
  if (!sql) return jsonResponse({ calls: [] }, origin);

  try {
    // Build the WHERE dynamically with positional params — the Neon client does
    // not reliably compose multiple nested sql`` fragments, so use sql.query().
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (type === 'production' || type === 'investor') { params.push(type); conditions.push(`c.poster_type = $${params.length}`); }
    if (status === 'open' || status === 'closed') { params.push(status); conditions.push(`c.status = $${params.length}`); }
    if (genre && genre !== 'all') { params.push('%' + genre + '%'); conditions.push(`c.seeking_genres ILIKE $${params.length}`); }
    if (q) { params.push('%' + q + '%'); conditions.push(`(c.title ILIKE $${params.length} OR c.mandate ILIKE $${params.length})`); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const query = `
      SELECT ${CALL_SELECT}
      FROM open_calls c
      LEFT JOIN users u ON u.id = c.poster_user_id
      ${whereClause}
      ORDER BY (c.status = 'open') DESC, c.created_at DESC
      LIMIT $${params.length}
    `;
    const rows = await sql.query(query, params);
    return jsonResponse({ calls: rows }, origin);
  } catch (err) {
    console.error('listCallsHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ calls: [] }, origin);
  }
}

// ---------------------------------------------------------------------------
// GET /api/calls/:id — public detail
// ---------------------------------------------------------------------------

export async function getCallHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const id = callIdFromPath(request);
  if (id === null) return errorResponse('Invalid call id', origin, 400);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const [row] = await sql`
      SELECT ${sql.unsafe(CALL_SELECT)}
      FROM open_calls c
      LEFT JOIN users u ON u.id = c.poster_user_id
      WHERE c.id = ${id}
    `;
    if (!row) return errorResponse('Call not found', origin, 404);
    return jsonResponse({ call: row }, origin);
  } catch (err) {
    console.error('getCallHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to load call', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/calls/mine — calls posted by the current user
// ---------------------------------------------------------------------------

export async function myCallsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ calls: [] }, origin);

  try {
    const rows = await sql`
      SELECT ${sql.unsafe(CALL_SELECT)}
      FROM open_calls c
      LEFT JOIN users u ON u.id = c.poster_user_id
      WHERE c.poster_user_id = ${userId}
      ORDER BY c.created_at DESC
    `;
    return jsonResponse({ calls: rows }, origin);
  } catch (err) {
    console.error('myCallsHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ calls: [] }, origin);
  }
}

// ---------------------------------------------------------------------------
// POST /api/calls — create (production / investor only)
// ---------------------------------------------------------------------------

export async function createCallHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const [me] = await sql`SELECT user_type FROM users WHERE id = ${userId}`;
    const userType = me?.user_type as string | undefined;
    if (userType !== 'production' && userType !== 'investor') {
      return errorResponse('Only production companies and investors can post a call', origin, 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const title = String(body.title ?? '').trim();
    if (!title) return errorResponse('A title is required', origin, 400);

    const mandate = String(body.mandate ?? '').trim();
    const seekingGenres = normaliseList(body.seekingGenres ?? body.seeking_genres);
    const seekingFormats = normaliseList(body.seekingFormats ?? body.seeking_formats);
    const budgetMin = clampBudget(body.budgetMinUsd ?? body.budget_min_usd);
    const budgetMax = clampBudget(body.budgetMaxUsd ?? body.budget_max_usd);
    const region = body.region ? String(body.region).trim().slice(0, 120) : null;
    const slotsRaw = body.slots;
    const slots = slotsRaw === null || slotsRaw === undefined || slotsRaw === ''
      ? null : Math.max(0, Math.round(Number(slotsRaw) || 0));
    const deadline = body.deadline ? String(body.deadline).slice(0, 10) : null;

    const [row] = await sql`
      INSERT INTO open_calls (
        poster_user_id, poster_type, title, mandate,
        seeking_genres, seeking_formats, budget_min_usd, budget_max_usd,
        region, slots, deadline
      ) VALUES (
        ${userId}, ${userType}, ${title.slice(0, 160)}, ${mandate},
        ${seekingGenres}, ${seekingFormats}, ${budgetMin}, ${budgetMax},
        ${region}, ${slots}, ${deadline}
      ) RETURNING id
    `;
    return jsonResponse({ id: row?.id, created: true }, origin, 201);
  } catch (err) {
    console.error('createCallHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to create call', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/calls/:id — owner edit / close
// ---------------------------------------------------------------------------

export async function updateCallHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const id = callIdFromPath(request);
  if (id === null) return errorResponse('Invalid call id', origin, 400);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const [existing] = await sql`SELECT poster_user_id FROM open_calls WHERE id = ${id}`;
    if (!existing) return errorResponse('Call not found', origin, 404);
    if (String(existing.poster_user_id) !== String(userId)) {
      return errorResponse('You can only edit your own calls', origin, 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    // Presence-aware: only fields present in the body are touched (COALESCE keeps the rest).
    const title = 'title' in body ? String(body.title ?? '').trim().slice(0, 160) || null : null;
    const mandate = 'mandate' in body ? String(body.mandate ?? '').trim() : null;
    const seekingGenres = 'seekingGenres' in body || 'seeking_genres' in body
      ? normaliseList(body.seekingGenres ?? body.seeking_genres) : null;
    const seekingFormats = 'seekingFormats' in body || 'seeking_formats' in body
      ? normaliseList(body.seekingFormats ?? body.seeking_formats) : null;
    const budgetMin = 'budgetMinUsd' in body || 'budget_min_usd' in body
      ? clampBudget(body.budgetMinUsd ?? body.budget_min_usd) : null;
    const budgetMax = 'budgetMaxUsd' in body || 'budget_max_usd' in body
      ? clampBudget(body.budgetMaxUsd ?? body.budget_max_usd) : null;
    const region = 'region' in body ? (body.region ? String(body.region).trim().slice(0, 120) : null) : null;
    const status = 'status' in body && (body.status === 'open' || body.status === 'closed')
      ? String(body.status) : null;
    const slots = 'slots' in body
      ? (body.slots === null || body.slots === '' ? null : Math.max(0, Math.round(Number(body.slots) || 0)))
      : null;
    const deadline = 'deadline' in body ? (body.deadline ? String(body.deadline).slice(0, 10) : null) : null;

    await sql`
      UPDATE open_calls SET
        title          = COALESCE(${title}, title),
        mandate        = COALESCE(${mandate}, mandate),
        seeking_genres = CASE WHEN ${'seekingGenres' in body || 'seeking_genres' in body} THEN ${seekingGenres} ELSE seeking_genres END,
        seeking_formats= CASE WHEN ${'seekingFormats' in body || 'seeking_formats' in body} THEN ${seekingFormats} ELSE seeking_formats END,
        budget_min_usd = CASE WHEN ${'budgetMinUsd' in body || 'budget_min_usd' in body} THEN ${budgetMin} ELSE budget_min_usd END,
        budget_max_usd = CASE WHEN ${'budgetMaxUsd' in body || 'budget_max_usd' in body} THEN ${budgetMax} ELSE budget_max_usd END,
        region         = CASE WHEN ${'region' in body} THEN ${region} ELSE region END,
        status         = COALESCE(${status}, status),
        slots          = CASE WHEN ${'slots' in body} THEN ${slots} ELSE slots END,
        deadline       = CASE WHEN ${'deadline' in body} THEN ${deadline} ELSE deadline END,
        updated_at     = NOW()
      WHERE id = ${id}
    `;
    return jsonResponse({ updated: true }, origin);
  } catch (err) {
    console.error('updateCallHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to update call', origin, 500);
  }
}

// ===========================================================================
// Phase 2 — submissions
// ===========================================================================

const SUBMISSION_STATUSES = ['new', 'shortlisted', 'declined', 'accepted'];

// POST /api/calls/:id/submissions — a creator attaches one of their pitches.
export async function submitToCallHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const callId = callIdFromSubmissionsPath(request);
  if (callId === null) return errorResponse('Invalid call id', origin, 400);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pitchId = parseInt(String(body.pitchId ?? body.pitch_id ?? ''), 10);
    if (!Number.isFinite(pitchId)) return errorResponse('A pitch is required', origin, 400);
    const message = String(body.message ?? '').trim();

    const [call] = await sql`SELECT poster_user_id, status FROM open_calls WHERE id = ${callId}`;
    if (!call) return errorResponse('Call not found', origin, 404);
    if (call.status !== 'open') return errorResponse('This call is closed', origin, 400);
    if (String(call.poster_user_id) === String(userId)) {
      return errorResponse('You cannot submit to your own call', origin, 403);
    }

    const [pitch] = await sql`
      SELECT id FROM pitches WHERE id = ${pitchId} AND (user_id = ${userId} OR creator_id = ${userId})
    `;
    if (!pitch) return errorResponse('You can only submit a pitch you own', origin, 403);

    const [row] = await sql`
      INSERT INTO call_submissions (call_id, pitch_id, creator_user_id, message)
      VALUES (${callId}, ${pitchId}, ${userId}, ${message})
      ON CONFLICT (call_id, pitch_id) DO NOTHING
      RETURNING id
    `;
    if (!row) return errorResponse('You have already submitted that pitch to this call', origin, 409);
    return jsonResponse({ id: row.id, submitted: true }, origin, 201);
  } catch (err) {
    console.error('submitToCallHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to submit', origin, 500);
  }
}

// GET /api/calls/:id/submissions — the call owner views submissions.
export async function listCallSubmissionsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const callId = callIdFromSubmissionsPath(request);
  if (callId === null) return errorResponse('Invalid call id', origin, 400);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ submissions: [] }, origin);

  try {
    const [call] = await sql`SELECT poster_user_id FROM open_calls WHERE id = ${callId}`;
    if (!call) return errorResponse('Call not found', origin, 404);
    if (String(call.poster_user_id) !== String(userId)) {
      return errorResponse('Only the call owner can view submissions', origin, 403);
    }

    const rows = await sql`
      SELECT
        s.id, s.call_id, s.pitch_id, s.message, s.status, s.created_at,
        p.title AS pitch_title, p.logline AS pitch_logline, p.genre AS pitch_genre,
        p.title_image AS pitch_thumbnail,
        COALESCE(u.company_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) AS creator_name,
        u.id AS creator_id, u.verification_tier AS creator_verification_tier
      FROM call_submissions s
      LEFT JOIN pitches p ON p.id = s.pitch_id
      LEFT JOIN users u ON u.id = s.creator_user_id
      WHERE s.call_id = ${callId}
      ORDER BY
        CASE s.status WHEN 'accepted' THEN 0 WHEN 'shortlisted' THEN 1 WHEN 'new' THEN 2 ELSE 3 END,
        s.created_at DESC
    `;
    return jsonResponse({ submissions: rows }, origin);
  } catch (err) {
    console.error('listCallSubmissionsHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ submissions: [] }, origin);
  }
}

// GET /api/calls/submissions/mine — a creator's own submissions across calls.
export async function mySubmissionsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ submissions: [] }, origin);

  try {
    const rows = await sql`
      SELECT
        s.id, s.call_id, s.pitch_id, s.status, s.created_at,
        c.title AS call_title, c.poster_type AS call_poster_type,
        COALESCE(u.company_name, u.username) AS call_poster_name,
        p.title AS pitch_title
      FROM call_submissions s
      LEFT JOIN open_calls c ON c.id = s.call_id
      LEFT JOIN users u ON u.id = c.poster_user_id
      LEFT JOIN pitches p ON p.id = s.pitch_id
      WHERE s.creator_user_id = ${userId}
      ORDER BY s.created_at DESC
    `;
    return jsonResponse({ submissions: rows }, origin);
  } catch (err) {
    console.error('mySubmissionsHandler error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ submissions: [] }, origin);
  }
}

// PATCH /api/calls/submissions/:submissionId — owner sets status.
export async function updateSubmissionHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Authentication required', origin, 401);

  const id = callIdFromPath(request); // last segment = submission id
  if (id === null) return errorResponse('Invalid submission id', origin, 400);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const status = String(body.status ?? '');
    if (!SUBMISSION_STATUSES.includes(status)) return errorResponse('Invalid status', origin, 400);

    const [row] = await sql`
      SELECT oc.poster_user_id
      FROM call_submissions s
      JOIN open_calls oc ON oc.id = s.call_id
      WHERE s.id = ${id}
    `;
    if (!row) return errorResponse('Submission not found', origin, 404);
    if (String(row.poster_user_id) !== String(userId)) {
      return errorResponse('Only the call owner can update submissions', origin, 403);
    }

    await sql`UPDATE call_submissions SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
    return jsonResponse({ updated: true, status }, origin);
  } catch (err) {
    console.error('updateSubmissionHandler error:', err instanceof Error ? err.message : String(err));
    return errorResponse('Failed to update submission', origin, 500);
  }
}
