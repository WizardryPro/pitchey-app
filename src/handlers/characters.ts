/**
 * Pitch Characters CRUD Handlers
 * Manages characters associated with pitches (create, read, update, delete)
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import * as Sentry from '@sentry/cloudflare';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

/**
 * GET /api/pitches/:pitchId/characters
 * Public endpoint — no auth required
 */
export async function getCharactersHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: true, data: { characters: [] } }, 200, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const pitchId = parts[parts.indexOf('characters') - 1];

    const rows = await sql`
      SELECT id, pitch_id, name, role, description, age, gender, ethnicity, traits, arc, created_at, updated_at
      FROM pitch_characters
      WHERE pitch_id = ${pitchId}
      ORDER BY created_at ASC
    `;

    return jsonResponse({ success: true, data: { characters: rows } }, 200, origin);
  } catch (error) {
    // Honest 503 on failure (was silent empty success). #66
    const e = error instanceof Error ? error : new Error(String(error));
    console.error('Get characters error:', e.message);
    try {
      Sentry.withScope((scope) => {
        scope.setTag('handler.context', 'characters.getCharactersHandler');
        Sentry.captureException(e);
      });
    } catch { /* Sentry hub not initialized */ }
    return jsonResponse(
      { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Characters temporarily unavailable' } },
      503,
      origin,
    );
  }
}

/**
 * POST /api/pitches/:pitchId/characters
 * Auth required — must own the pitch
 */
export async function createCharacterHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } }, 503, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const pitchId = parts[parts.indexOf('characters') - 1];

    // Verify pitch ownership
    const [pitch] = await sql`
      SELECT id FROM pitches WHERE id = ${pitchId} AND user_id = ${userId}
    `;
    if (!pitch) {
      return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this pitch' } }, 403, origin);
    }

    const body = await request.json() as Record<string, any>;
    const { name, role, description, age, gender, ethnicity, traits, arc } = body;

    if (!name) {
      return jsonResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }, 400, origin);
    }

    const [result] = await sql`
      INSERT INTO pitch_characters (pitch_id, name, role, description, age, gender, ethnicity, traits, arc)
      VALUES (${pitchId}, ${name}, ${role || null}, ${description || null}, ${age || null}, ${gender || null}, ${ethnicity || null}, ${traits || null}, ${arc || null})
      RETURNING *
    `;

    return jsonResponse({ success: true, data: { character: result } }, 201, origin);
  } catch (error) {
    console.error('Create character error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create character' } }, 500, origin);
  }
}

/**
 * PUT /api/pitches/:pitchId/characters/:id
 * Auth required — must own the pitch
 */
export async function updateCharacterHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } }, 503, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const pitchId = parts[parts.indexOf('characters') - 1];
    const characterId = parts[parts.indexOf('characters') + 1];

    // Verify pitch ownership
    const [pitch] = await sql`
      SELECT id FROM pitches WHERE id = ${pitchId} AND user_id = ${userId}
    `;
    if (!pitch) {
      return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this pitch' } }, 403, origin);
    }

    const body = await request.json() as Record<string, any>;
    const { name, role, description, age, gender, ethnicity, traits, arc } = body;

    const [result] = await sql`
      UPDATE pitch_characters
      SET name = ${name}, role = ${role || null}, description = ${description || null},
          age = ${age || null}, gender = ${gender || null}, ethnicity = ${ethnicity || null},
          traits = ${traits || null}, arc = ${arc || null}, updated_at = NOW()
      WHERE id = ${characterId} AND pitch_id = ${pitchId}
      RETURNING *
    `;

    if (!result) {
      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Character not found' } }, 404, origin);
    }

    return jsonResponse({ success: true, data: { character: result } }, 200, origin);
  } catch (error) {
    console.error('Update character error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update character' } }, 500, origin);
  }
}

/**
 * DELETE /api/pitches/:pitchId/characters/:id
 * Auth required — must own the pitch
 */
export async function deleteCharacterHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } }, 503, origin);
  }

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const pitchId = parts[parts.indexOf('characters') - 1];
    const characterId = parts[parts.indexOf('characters') + 1];

    // Verify pitch ownership
    const [pitch] = await sql`
      SELECT id FROM pitches WHERE id = ${pitchId} AND user_id = ${userId}
    `;
    if (!pitch) {
      return jsonResponse({ success: false, error: { code: 'FORBIDDEN', message: 'You do not own this pitch' } }, 403, origin);
    }

    await sql`
      DELETE FROM pitch_characters WHERE id = ${characterId} AND pitch_id = ${pitchId}
    `;

    return jsonResponse({ success: true, data: { deleted: true } }, 200, origin);
  } catch (error) {
    console.error('Delete character error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete character' } }, 500, origin);
  }
}
