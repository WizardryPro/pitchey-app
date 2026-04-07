/**
 * Slate Handlers
 * Curated collections of related pitches
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  data: unknown,
  origin: string | null,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

function authGuard(sql: any, userId: number | null, origin: string | null) {
  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. POST /api/slates — Create a slate
// ---------------------------------------------------------------------------

export async function createSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({})) as {
      title?: string;
      description?: string;
      cover_image?: string;
    };

    const title = body.title?.trim().slice(0, 150);
    if (!title) {
      return jsonResponse({ success: false, error: 'Title is required' }, origin, 400);
    }

    const description = body.description?.trim() || null;
    const coverImage = body.cover_image?.trim() || null;

    const result = await sql!`
      INSERT INTO slates (user_id, title, description, cover_image)
      VALUES (${userId}, ${title}, ${description}, ${coverImage})
      RETURNING id, title, description, cover_image, status, created_at
    `;

    return jsonResponse({ success: true, data: result[0] }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to create slate' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 2. GET /api/slates — List authenticated user's slates
// ---------------------------------------------------------------------------

export async function listSlatesHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // draft | published | null (all)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let slates;
    if (status) {
      slates = await sql!`
        SELECT s.id, s.title, s.description, s.cover_image, s.status,
               s.created_at, s.updated_at,
               COUNT(sp.id)::int AS pitch_count
        FROM slates s
        LEFT JOIN slate_pitches sp ON sp.slate_id = s.id
        WHERE s.user_id = ${userId} AND s.status = ${status}
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      slates = await sql!`
        SELECT s.id, s.title, s.description, s.cover_image, s.status,
               s.created_at, s.updated_at,
               COUNT(sp.id)::int AS pitch_count
        FROM slates s
        LEFT JOIN slate_pitches sp ON sp.slate_id = s.id
        WHERE s.user_id = ${userId}
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return jsonResponse({ success: true, data: { slates, page, limit } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('listSlatesHandler error:', e.message);
    return jsonResponse({ success: true, data: { slates: [], page: 1, limit: 20 } }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. GET /api/slates/:id — Get a single slate with pitches
// ---------------------------------------------------------------------------

export async function getSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    if (!slateId || isNaN(slateId)) {
      return jsonResponse({ success: false, error: 'Invalid slate ID' }, origin, 400);
    }

    const slateResult = await sql!`
      SELECT id, title, description, cover_image, status, created_at, updated_at
      FROM slates
      WHERE id = ${slateId} AND user_id = ${userId}
    `;

    if (slateResult.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    const pitches = await sql!`
      SELECT sp.id AS entry_id, sp.position, sp.added_at,
             p.id, p.title, p.logline, p.genre, p.format,
             p.title_image AS cover_image,
             COALESCE(p.view_count, 0)::int AS view_count,
             COALESCE(p.like_count, 0)::int AS like_count,
             p.status, p.created_at
      FROM slate_pitches sp
      JOIN pitches p ON p.id = sp.pitch_id
      WHERE sp.slate_id = ${slateId}
      ORDER BY sp.position ASC, sp.added_at ASC
    `;

    return jsonResponse({
      success: true,
      data: { ...slateResult[0], pitches },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load slate' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 4. PUT /api/slates/:id — Update a slate
// ---------------------------------------------------------------------------

export async function updateSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    if (!slateId || isNaN(slateId)) {
      return jsonResponse({ success: false, error: 'Invalid slate ID' }, origin, 400);
    }

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      description?: string;
      cover_image?: string | null;
      status?: string;
    };

    // Build SET clauses dynamically
    const sets: string[] = [];
    const vals: any[] = [];

    if (body.title !== undefined) {
      const title = body.title.trim().slice(0, 150);
      if (!title) return jsonResponse({ success: false, error: 'Title cannot be empty' }, origin, 400);
      sets.push('title');
      vals.push(title);
    }
    if (body.description !== undefined) {
      sets.push('description');
      vals.push(body.description?.trim() || null);
    }
    if (body.cover_image !== undefined) {
      sets.push('cover_image');
      vals.push(body.cover_image?.trim() || null);
    }
    if (body.status !== undefined) {
      if (!['draft', 'published'].includes(body.status)) {
        return jsonResponse({ success: false, error: 'Status must be draft or published' }, origin, 400);
      }
      sets.push('status');
      vals.push(body.status);
    }

    if (sets.length === 0) {
      return jsonResponse({ success: false, error: 'No fields to update' }, origin, 400);
    }

    // Use individual field updates since neon tagged templates don't support dynamic column sets easily
    // Update each field and always bump updated_at
    let result;
    if (sets.includes('title') && sets.includes('description') && sets.includes('cover_image') && sets.includes('status')) {
      result = await sql!`
        UPDATE slates SET title = ${vals[sets.indexOf('title')]}, description = ${vals[sets.indexOf('description')]},
        cover_image = ${vals[sets.indexOf('cover_image')]}, status = ${vals[sets.indexOf('status')]}, updated_at = NOW()
        WHERE id = ${slateId} AND user_id = ${userId}
        RETURNING id, title, description, cover_image, status, created_at, updated_at
      `;
    } else {
      // Simpler: fetch current, merge, write back
      const current = await sql!`
        SELECT title, description, cover_image, status
        FROM slates WHERE id = ${slateId} AND user_id = ${userId}
      `;
      if (current.length === 0) {
        return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
      }
      const merged = { ...current[0] };
      for (let i = 0; i < sets.length; i++) {
        (merged as any)[sets[i]] = vals[i];
      }
      result = await sql!`
        UPDATE slates
        SET title = ${merged.title}, description = ${merged.description},
            cover_image = ${merged.cover_image}, status = ${merged.status}, updated_at = NOW()
        WHERE id = ${slateId} AND user_id = ${userId}
        RETURNING id, title, description, cover_image, status, created_at, updated_at
      `;
    }

    if (result.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    return jsonResponse({ success: true, data: result[0] }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to update slate' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 5. DELETE /api/slates/:id — Delete a slate
// ---------------------------------------------------------------------------

export async function deleteSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    if (!slateId || isNaN(slateId)) {
      return jsonResponse({ success: false, error: 'Invalid slate ID' }, origin, 400);
    }

    const result = await sql!`
      DELETE FROM slates WHERE id = ${slateId} AND user_id = ${userId} RETURNING id
    `;

    if (result.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('deleteSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to delete slate' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 6. POST /api/slates/:id/pitches — Add a pitch to a slate
// ---------------------------------------------------------------------------

export async function addPitchToSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    if (!slateId || isNaN(slateId)) {
      return jsonResponse({ success: false, error: 'Invalid slate ID' }, origin, 400);
    }

    const body = await request.json().catch(() => ({})) as { pitch_id?: number };
    const pitchId = body.pitch_id;
    if (!pitchId || typeof pitchId !== 'number') {
      return jsonResponse({ success: false, error: 'pitch_id is required' }, origin, 400);
    }

    // Verify slate ownership
    const slateCheck = await sql!`
      SELECT id FROM slates WHERE id = ${slateId} AND user_id = ${userId}
    `;
    if (slateCheck.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    // Verify pitch exists
    const pitchCheck = await sql!`
      SELECT id FROM pitches WHERE id = ${pitchId}
    `;
    if (pitchCheck.length === 0) {
      return jsonResponse({ success: false, error: 'Pitch not found' }, origin, 404);
    }

    // Get next position
    const posResult = await sql!`
      SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM slate_pitches WHERE slate_id = ${slateId}
    `;
    const nextPos = posResult[0].next_pos;

    const result = await sql!`
      INSERT INTO slate_pitches (slate_id, pitch_id, position)
      VALUES (${slateId}, ${pitchId}, ${nextPos})
      ON CONFLICT (slate_id, pitch_id) DO NOTHING
      RETURNING id, slate_id, pitch_id, position, added_at
    `;

    if (result.length === 0) {
      return jsonResponse({ success: false, error: 'Pitch already in slate' }, origin, 409);
    }

    // Bump slate updated_at
    sql!`UPDATE slates SET updated_at = NOW() WHERE id = ${slateId}`.catch(() => {});

    return jsonResponse({ success: true, data: result[0] }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('addPitchToSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to add pitch to slate' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 7. DELETE /api/slates/:id/pitches/:pitchId — Remove a pitch from a slate
// ---------------------------------------------------------------------------

export async function removePitchFromSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    const pitchId = parseInt(params?.pitchId, 10);
    if (!slateId || isNaN(slateId) || !pitchId || isNaN(pitchId)) {
      return jsonResponse({ success: false, error: 'Invalid IDs' }, origin, 400);
    }

    // Verify slate ownership
    const slateCheck = await sql!`
      SELECT id FROM slates WHERE id = ${slateId} AND user_id = ${userId}
    `;
    if (slateCheck.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    const result = await sql!`
      DELETE FROM slate_pitches WHERE slate_id = ${slateId} AND pitch_id = ${pitchId} RETURNING id
    `;

    if (result.length === 0) {
      return jsonResponse({ success: false, error: 'Pitch not in slate' }, origin, 404);
    }

    // Bump slate updated_at
    sql!`UPDATE slates SET updated_at = NOW() WHERE id = ${slateId}`.catch(() => {});

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('removePitchFromSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to remove pitch from slate' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 8. PUT /api/slates/:id/pitches/reorder — Reorder pitches in a slate
// ---------------------------------------------------------------------------

export async function reorderSlatePitchesHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const denied = authGuard(sql, userId, origin);
  if (denied) return denied;

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    if (!slateId || isNaN(slateId)) {
      return jsonResponse({ success: false, error: 'Invalid slate ID' }, origin, 400);
    }

    const body = await request.json().catch(() => ({})) as { pitch_ids?: number[] };
    const pitchIds = body.pitch_ids;
    if (!Array.isArray(pitchIds) || pitchIds.length === 0) {
      return jsonResponse({ success: false, error: 'pitch_ids array is required' }, origin, 400);
    }

    // Verify slate ownership
    const slateCheck = await sql!`
      SELECT id FROM slates WHERE id = ${slateId} AND user_id = ${userId}
    `;
    if (slateCheck.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    // Update positions — each pitch gets its array index as position
    for (let i = 0; i < pitchIds.length; i++) {
      await sql!`
        UPDATE slate_pitches SET position = ${i}
        WHERE slate_id = ${slateId} AND pitch_id = ${pitchIds[i]}
      `;
    }

    // Bump slate updated_at
    sql!`UPDATE slates SET updated_at = NOW() WHERE id = ${slateId}`.catch(() => {});

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('reorderSlatePitchesHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to reorder pitches' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 9. GET /api/slates/:id/public — Public view of a published slate (NO AUTH)
// ---------------------------------------------------------------------------

export async function publicSlateHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: false, error: 'Service unavailable' }, origin, 503);
  }

  try {
    const params = (request as any).params;
    const slateId = parseInt(params?.id, 10);
    if (!slateId || isNaN(slateId)) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    const slateResult = await sql`
      SELECT s.id, s.title, s.description, s.cover_image, s.created_at,
             u.id AS creator_id, u.name AS creator_name, u.username AS creator_username,
             u.profile_image AS creator_avatar
      FROM slates s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${slateId} AND s.status = 'published'
    `;

    if (slateResult.length === 0) {
      return jsonResponse({ success: false, error: 'Slate not found' }, origin, 404);
    }

    const pitches = await sql`
      SELECT sp.position,
             p.id, p.title, p.logline, p.genre, p.format,
             p.title_image AS cover_image,
             COALESCE(p.view_count, 0)::int AS view_count,
             COALESCE(p.like_count, 0)::int AS like_count,
             p.created_at
      FROM slate_pitches sp
      JOIN pitches p ON p.id = sp.pitch_id
      WHERE sp.slate_id = ${slateId} AND p.status = 'published'
      ORDER BY sp.position ASC
    `;

    const slate = slateResult[0];
    return jsonResponse({
      success: true,
      data: {
        id: slate.id,
        title: slate.title,
        description: slate.description,
        cover_image: slate.cover_image,
        created_at: slate.created_at,
        creator: {
          id: slate.creator_id,
          name: slate.creator_name,
          username: slate.creator_username,
          avatar_url: slate.creator_avatar,
        },
        pitches,
      },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('publicSlateHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load slate' }, origin, 500);
  }
}
