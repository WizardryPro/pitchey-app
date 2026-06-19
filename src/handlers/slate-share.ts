/**
 * Tokenized, tracked slate share links (moat #5).
 *
 * Replaces the raw, untracked `/slates/s/{id}` link with per-share tokens that
 * carry view tracking + revocation — the same model as portfolio_share_links —
 * so a creator's slate becomes a real outbound distribution surface with feedback.
 *
 *   POST   /api/slates/:id/share-links       create a tracked link (owner)
 *   GET    /api/slates/:id/share-links        list a slate's links + view counts (owner)
 *   DELETE /api/slates/share-links/:linkId    revoke a link (owner)
 *   GET    /api/slates/s/:token               public tracked view (no auth)
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

function paramId(request: Request, key: string, idx: number): string | undefined {
  const fromRouter = (request as any).params?.[key];
  if (fromRouter) return String(fromRouter);
  const parts = new URL(request.url).pathname.split('/');
  return parts[parts.length - idx];
}

/** POST /api/slates/:id/share-links */
export async function createSlateShareLinkHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);
  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const slateId = parseInt(paramId(request, 'id', 2) || '', 10); // /api/slates/:id/share-links
    if (!slateId || Number.isNaN(slateId)) return errorResponse('Invalid slate id', origin);

    const [owned] = await sql`SELECT id FROM slates WHERE id = ${slateId} AND user_id::text = ${String(userId)}`;
    if (!owned) return errorResponse('Slate not found', origin, 404);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const label = typeof body.label === 'string' ? body.label.slice(0, 100) : null;
    const token = crypto.randomUUID();

    const [link] = await sql`
      INSERT INTO slate_share_links (token, slate_id, creator_id, label)
      VALUES (${token}, ${slateId}, ${Number(userId)}, ${label})
      RETURNING id, token, label, view_count, created_at
    `;
    return jsonResponse({ success: true, data: { link } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createSlateShareLinkHandler error:', e.message);
    return errorResponse('Failed to create share link', origin, 500);
  }
}

/** GET /api/slates/:id/share-links */
export async function listSlateShareLinksHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);
  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { links: [] } }, origin);

  try {
    const slateId = parseInt(paramId(request, 'id', 2) || '', 10);
    if (!slateId || Number.isNaN(slateId)) return errorResponse('Invalid slate id', origin);

    const links = await sql`
      SELECT id, token, label, view_count, last_viewed_at, revoked_at, created_at
      FROM slate_share_links
      WHERE slate_id = ${slateId} AND creator_id::text = ${String(userId)}
      ORDER BY created_at DESC
    `;
    return jsonResponse({ success: true, data: { links } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('listSlateShareLinksHandler error:', e.message);
    return jsonResponse({ success: true, data: { links: [] } }, origin);
  }
}

/** DELETE /api/slates/share-links/:linkId */
export async function revokeSlateShareLinkHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);
  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const linkId = parseInt(paramId(request, 'linkId', 1) || '', 10); // /api/slates/share-links/:linkId
    if (!linkId || Number.isNaN(linkId)) return errorResponse('Invalid link id', origin);

    const [revoked] = await sql`
      UPDATE slate_share_links SET revoked_at = NOW()
      WHERE id = ${linkId} AND creator_id::text = ${String(userId)} AND revoked_at IS NULL
      RETURNING id
    `;
    if (!revoked) return errorResponse('Link not found', origin, 404);
    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('revokeSlateShareLinkHandler error:', e.message);
    return errorResponse('Failed to revoke link', origin, 500);
  }
}

/** GET /api/slates/s/:token — public tracked view (no auth). */
export async function publicSlateByTokenHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  if (!sql) return errorResponse('Service unavailable', origin, 503);

  try {
    const token = paramId(request, 'token', 1);
    if (!token) return errorResponse('Slate not found', origin, 404);

    const [link] = await sql`
      SELECT id, slate_id FROM slate_share_links WHERE token = ${token} AND revoked_at IS NULL
    `;
    if (!link) return errorResponse('Slate not found', origin, 404);

    const slateId = Number(link.slate_id);

    const slateResult = await sql`
      SELECT s.id, s.title, s.description, s.cover_image, s.created_at, s.updated_at,
             u.id AS creator_id, u.name AS creator_name, u.username AS creator_username,
             u.profile_image AS creator_avatar
      FROM slates s JOIN users u ON u.id = s.user_id
      WHERE s.id = ${slateId} AND s.status = 'published'
    `;
    if (slateResult.length === 0) return errorResponse('Slate not found', origin, 404);

    const pitches = await sql`
      SELECT sp.position, p.id, p.title, p.logline, p.genre, p.format,
             p.title_image AS cover_image,
             COALESCE(p.view_count, 0)::int AS view_count,
             COALESCE(p.like_count, 0)::int AS like_count,
             p.created_at, p.updated_at
      FROM slate_pitches sp JOIN pitches p ON p.id = sp.pitch_id
      WHERE sp.slate_id = ${slateId} AND p.status = 'published'
      ORDER BY sp.position ASC
    `;

    // Track the view (indexed single-row update; cheap to await).
    await sql`
      UPDATE slate_share_links SET view_count = view_count + 1, last_viewed_at = NOW()
      WHERE id = ${link.id}
    `;

    const slate = slateResult[0] as Record<string, any>;
    return jsonResponse({
      success: true,
      data: {
        id: slate.id,
        title: slate.title,
        description: slate.description,
        cover_image: slate.cover_image,
        created_at: slate.created_at,
        shareToken: token,
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
    console.error('publicSlateByTokenHandler error:', e.message);
    return errorResponse('Failed to load slate', origin, 500);
  }
}
