/**
 * Portfolio Share Link Handlers
 * Create, list, revoke share links + public portfolio view by token
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { safeQuery } from '../db/safe-query';

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

// ---------------------------------------------------------------------------
// 1. POST /api/creator/share-links — Create a new share link
// ---------------------------------------------------------------------------

export async function createShareLinkHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    const body = await request.json().catch(() => ({})) as { label?: string };
    const label = body.label?.trim().slice(0, 100) || null;
    const token = crypto.randomUUID();

    const result = await sql`
      INSERT INTO portfolio_share_links (token, creator_id, label)
      VALUES (${token}, ${userId}, ${label})
      RETURNING id, token, label, view_count, created_at
    `;

    const link = result[0];
    return jsonResponse({
      success: true,
      data: {
        id: link.id,
        token: link.token,
        label: link.label,
        view_count: link.view_count,
        created_at: link.created_at,
      },
    }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createShareLinkHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to create share link' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 2. GET /api/creator/share-links — List all share links for authenticated creator
// ---------------------------------------------------------------------------

export async function listShareLinksHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    const links = await sql`
      SELECT id, token, label, view_count, revoked_at, created_at
      FROM portfolio_share_links
      WHERE creator_id = ${userId}
      ORDER BY created_at DESC
    `;

    return jsonResponse({ success: true, data: { links } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('listShareLinksHandler error:', e.message);
    return jsonResponse({ success: true, data: { links: [] } }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. DELETE /api/creator/share-links/:id — Revoke a share link
// ---------------------------------------------------------------------------

export async function revokeShareLinkHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    const params = (request as any).params;
    const linkId = parseInt(params?.id, 10);
    if (!linkId || isNaN(linkId)) {
      return jsonResponse({ success: false, error: 'Invalid link ID' }, origin, 400);
    }

    const result = await sql`
      UPDATE portfolio_share_links
      SET revoked_at = NOW(), updated_at = NOW()
      WHERE id = ${linkId} AND creator_id = ${userId} AND revoked_at IS NULL
      RETURNING id
    `;

    if (result.length === 0) {
      return jsonResponse({ success: false, error: 'Share link not found' }, origin, 404);
    }

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('revokeShareLinkHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to revoke share link' }, origin, 500);
  }
}

// ---------------------------------------------------------------------------
// 4. GET /api/portfolio/s/:token — Public portfolio view (NO AUTH)
// ---------------------------------------------------------------------------

export async function publicPortfolioByTokenHandler(
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
    const token = params?.token;
    if (!token) {
      return jsonResponse({ success: false, error: 'Portfolio not found' }, origin, 404);
    }

    // Look up the share link
    const linkResult = await sql`
      SELECT id, creator_id
      FROM portfolio_share_links
      WHERE token = ${token} AND revoked_at IS NULL
    `;

    if (linkResult.length === 0) {
      return jsonResponse({ success: false, error: 'Portfolio not found' }, origin, 404);
    }

    const link = linkResult[0];
    const creatorId = link.creator_id;

    // Increment view count (fire and forget — failures reported to Sentry but don't block the view).
    void safeQuery(
      () => sql`
        UPDATE portfolio_share_links
        SET view_count = view_count + 1, updated_at = NOW()
        WHERE id = ${link.id}
      `,
      { fallback: [], context: 'portfolio-share.view-counter', tags: { linkId: String(link.id) } },
    );

    // Fetch creator profile (NO email exposed)
    const creatorResult = await sql`
      SELECT id, name, username, bio, profile_image, is_verified, created_at
      FROM users
      WHERE id = ${creatorId}
    `;

    if (creatorResult.length === 0) {
      return jsonResponse({ success: false, error: 'Portfolio not found' }, origin, 404);
    }

    const creator = creatorResult[0];

    // Fetch published pitches
    const pitches = await sql`
      SELECT
        id, title, logline, genre, title_image AS cover_image,
        COALESCE(view_count, 0)::int AS view_count,
        COALESCE(like_count, 0)::int AS like_count,
        created_at
      FROM pitches
      WHERE user_id = ${creatorId} AND status = 'published'
      ORDER BY created_at DESC
    `;

    return jsonResponse({
      success: true,
      data: {
        creator: {
          id: creator.id,
          name: creator.name,
          username: creator.username,
          bio: creator.bio,
          avatar_url: creator.profile_image,
          is_verified: creator.is_verified,
          created_at: creator.created_at,
        },
        pitches,
      },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('publicPortfolioByTokenHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load portfolio' }, origin, 500);
  }
}
