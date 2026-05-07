/**
 * Investor Pitch Data Handlers
 * Persists notes and due diligence checklists per pitch for investor users.
 * Replaces localStorage usage in InvestorPitchView.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
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

function extractPitchId(request: Request): number {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/investor/pitches/:pitchId/notes -> pitchId is at index 4
  return parseInt(parts[4] || '0', 10);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * GET /api/investor/pitches/:pitchId/notes
 */
export async function getInvestorNotes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { notes: [] } }, origin);

  try {
    const notesResult = await safeQuery(() => sql`
      SELECT id, content, category, is_private, created_at, updated_at
      FROM investor_notes
      WHERE user_id = ${Number(userId)} AND pitch_id = ${pitchId}
      ORDER BY created_at ASC
    `, { fallback: [], context: 'investor-pitch-data.notes.list' });

    return jsonResponse({ success: true, data: { notes: notesResult.rows } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getInvestorNotes error:', e.message);
    return jsonResponse({ success: true, data: { notes: [] } }, origin);
  }
}

/**
 * POST /api/investor/pitches/:pitchId/notes
 */
export async function createInvestorNote(request: Request, env: Env): Promise<Response> {
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
    const category = typeof body.category === 'string' && ['strength', 'concern', 'question', 'general'].includes(body.category)
      ? body.category : 'general';
    const isPrivate = body.isPrivate !== false;

    if (!content) return errorResponse('Content is required', origin);

    const [note] = await sql`
      INSERT INTO investor_notes (user_id, pitch_id, content, category, is_private)
      VALUES (${Number(userId)}, ${pitchId}, ${content}, ${category}, ${isPrivate})
      RETURNING id, content, category, is_private, created_at, updated_at
    `;

    return jsonResponse({ success: true, data: { note } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createInvestorNote error:', e.message);
    return errorResponse('Failed to create note', origin, 500);
  }
}

/**
 * DELETE /api/investor/pitches/:pitchId/notes/:noteId
 */
export async function deleteInvestorNote(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/investor/pitches/:pitchId/notes/:noteId
  const noteId = parseInt(parts[6] || '0', 10);
  if (!noteId) return errorResponse('Invalid note ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    await sql`
      DELETE FROM investor_notes
      WHERE id = ${noteId} AND user_id = ${Number(userId)}
    `;

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('deleteInvestorNote error:', e.message);
    return errorResponse('Failed to delete note', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Diligence Checklist
// ---------------------------------------------------------------------------

/**
 * GET /api/investor/pitches/:pitchId/diligence
 */
export async function getInvestorDiligence(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { checklist: {} } }, origin);

  try {
    const rows = await safeQuery<{ checklist: Record<string, unknown> }>(() => sql`
      SELECT checklist
      FROM investor_diligence_checklists
      WHERE user_id = ${Number(userId)} AND pitch_id = ${pitchId}
    `, { fallback: [], context: 'investor-pitch-data.diligence.read' });

    const checklist = rows.rows[0]?.checklist || {};
    return jsonResponse({ success: true, data: { checklist } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getInvestorDiligence error:', e.message);
    return jsonResponse({ success: true, data: { checklist: {} } }, origin);
  }
}

/**
 * PUT /api/investor/pitches/:pitchId/diligence
 */
export async function updateInvestorDiligence(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const checklist = body.checklist || body;

    await sql`
      INSERT INTO investor_diligence_checklists (user_id, pitch_id, checklist)
      VALUES (${Number(userId)}, ${pitchId}, ${JSON.stringify(checklist)}::jsonb)
      ON CONFLICT (user_id, pitch_id)
      DO UPDATE SET checklist = ${JSON.stringify(checklist)}::jsonb, updated_at = NOW()
    `;

    return jsonResponse({ success: true, data: { checklist } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateInvestorDiligence error:', e.message);
    return errorResponse('Failed to update checklist', origin, 500);
  }
}
