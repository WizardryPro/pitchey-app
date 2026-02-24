/**
 * Production Pitch Data Handlers
 * Persists notes, checklist, and team assignments per pitch for production users.
 * Replaces localStorage usage in ProductionPitchView.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

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
  // /api/production/pitches/:pitchId/notes -> pitchId is at index 4
  return parseInt(parts[4] || '0', 10);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * GET /api/production/pitches/:pitchId/notes
 */
export async function getProductionNotes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { notes: [] } }, origin);

  try {
    const notes = await sql`
      SELECT id, content, category, author, created_at, updated_at
      FROM production_notes
      WHERE user_id = ${Number(userId)} AND pitch_id = ${pitchId}
      ORDER BY created_at ASC
    `.catch(() => []);

    return jsonResponse({ success: true, data: { notes } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionNotes error:', e.message);
    return jsonResponse({ success: true, data: { notes: [] } }, origin);
  }
}

/**
 * POST /api/production/pitches/:pitchId/notes
 */
export async function createProductionNote(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const category = typeof body.category === 'string' ? body.category : 'general';
    const author = typeof body.author === 'string' ? body.author : 'Production Team';

    if (!content) return errorResponse('Content is required', origin);

    const validCategories = ['casting', 'location', 'budget', 'schedule', 'team', 'general'];
    if (!validCategories.includes(category)) {
      return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`, origin);
    }

    const result = await sql`
      INSERT INTO production_notes (user_id, pitch_id, content, category, author)
      VALUES (${Number(userId)}, ${pitchId}, ${content}, ${category}, ${author})
      RETURNING id, content, category, author, created_at, updated_at
    `;

    return jsonResponse({ success: true, data: { note: result[0] } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createProductionNote error:', e.message);
    return errorResponse('Failed to create note', origin, 500);
  }
}

/**
 * DELETE /api/production/pitches/:pitchId/notes/:noteId
 */
export async function deleteProductionNote(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/production/pitches/:pitchId/notes/:noteId
  const noteId = parseInt(parts[6] || '0', 10);
  if (!noteId) return errorResponse('Invalid note ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      DELETE FROM production_notes
      WHERE id = ${noteId} AND user_id = ${Number(userId)}
      RETURNING id
    `;

    if (result.length === 0) {
      return errorResponse('Note not found', origin, 404);
    }

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('deleteProductionNote error:', e.message);
    return errorResponse('Failed to delete note', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/**
 * GET /api/production/pitches/:pitchId/checklist
 */
export async function getProductionChecklist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { checklist: {} } }, origin);

  try {
    const result = await sql`
      SELECT checklist FROM production_checklists
      WHERE user_id = ${Number(userId)} AND pitch_id = ${pitchId}
    `.catch(() => []);

    const checklist = result.length > 0 ? result[0].checklist : {};
    return jsonResponse({ success: true, data: { checklist } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionChecklist error:', e.message);
    return jsonResponse({ success: true, data: { checklist: {} } }, origin);
  }
}

/**
 * PUT /api/production/pitches/:pitchId/checklist
 */
export async function updateProductionChecklist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const checklist = body.checklist;
    if (typeof checklist !== 'object' || checklist === null) {
      return errorResponse('Checklist object is required', origin);
    }

    const checklistJson = JSON.stringify(checklist);

    await sql`
      INSERT INTO production_checklists (user_id, pitch_id, checklist)
      VALUES (${Number(userId)}, ${pitchId}, ${checklistJson}::jsonb)
      ON CONFLICT (user_id, pitch_id)
      DO UPDATE SET checklist = ${checklistJson}::jsonb, updated_at = NOW()
    `;

    return jsonResponse({ success: true, data: { checklist } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateProductionChecklist error:', e.message);
    return errorResponse('Failed to update checklist', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Team Assignments
// ---------------------------------------------------------------------------

/**
 * GET /api/production/pitches/:pitchId/team
 */
export async function getProductionTeam(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { team: [] } }, origin);

  try {
    const result = await sql`
      SELECT team FROM production_team_assignments
      WHERE user_id = ${Number(userId)} AND pitch_id = ${pitchId}
    `.catch(() => []);

    const team = result.length > 0 ? result[0].team : [];
    return jsonResponse({ success: true, data: { team } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionTeam error:', e.message);
    return jsonResponse({ success: true, data: { team: [] } }, origin);
  }
}

/**
 * PUT /api/production/pitches/:pitchId/team
 */
export async function updateProductionTeam(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const team = body.team;
    if (!Array.isArray(team)) {
      return errorResponse('Team array is required', origin);
    }

    const teamJson = JSON.stringify(team);

    await sql`
      INSERT INTO production_team_assignments (user_id, pitch_id, team)
      VALUES (${Number(userId)}, ${pitchId}, ${teamJson}::jsonb)
      ON CONFLICT (user_id, pitch_id)
      DO UPDATE SET team = ${teamJson}::jsonb, updated_at = NOW()
    `;

    return jsonResponse({ success: true, data: { team } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateProductionTeam error:', e.message);
    return errorResponse('Failed to update team', origin, 500);
  }
}
