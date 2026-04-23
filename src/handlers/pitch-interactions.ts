/**
 * Pitch Interaction Handlers (Like, Unlike, Save, Unsave, Publish, Archive)
 * Replaces stub handlers with real database operations
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { sendNewPitchFromFollowedEmail } from '../services/email/index';
import { safeQuery } from '../db/safe-query';
import * as Sentry from '@sentry/cloudflare';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

function extractPitchId(request: Request): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/creator/pitches/:id/like -> id is at index with 'like' after it
  // /api/pitches/:id/save -> id is at index with 'save' after it
  // /api/pitches/:id/like-status -> id is at index with 'like-status' after it
  for (let i = 0; i < parts.length; i++) {
    if ((parts[i] === 'like' || parts[i] === 'like-status' || parts[i] === 'save' || parts[i] === 'publish' || parts[i] === 'archive') && i > 0) {
      return parts[i - 1];
    }
  }
  // fallback: second-to-last segment
  return parts[parts.length - 2];
}

/**
 * GET /api/pitches/:id/like-status
 */
export async function pitchLikeStatusHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: true, data: { liked: false } }, 200, origin);
  }
  if (!sql) {
    return jsonResponse({ success: true, data: { liked: false } }, 200, origin);
  }

  try {
    const pitchId = extractPitchId(request);
    const [row] = await sql`SELECT 1 FROM likes WHERE user_id = ${userId} AND pitch_id = ${pitchId} LIMIT 1`;

    return jsonResponse({ success: true, data: { liked: !!row } }, 200, origin);
  } catch (error) {
    console.error('Pitch like status error:', error);
    return jsonResponse({ success: true, data: { liked: false } }, 200, origin);
  }
}

/**
 * POST /api/creator/pitches/:id/like
 */
export async function pitchLikeHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: true, data: { liked: true, likeCount: 0 } }, 200, origin);
  }

  try {
    const pitchId = extractPitchId(request);

    await sql`
      INSERT INTO likes (user_id, pitch_id, created_at)
      VALUES (${userId}, ${pitchId}, NOW())
      ON CONFLICT (user_id, pitch_id) DO NOTHING
    `;

    // Update the denormalized count on pitches table
    const [countResult] = await sql`
      SELECT COUNT(*)::int as count FROM likes WHERE pitch_id = ${pitchId}
    `;
    await sql`
      UPDATE pitches SET like_count = ${countResult.count} WHERE id = ${pitchId}
    `;

    return jsonResponse({
      success: true,
      data: { liked: true, likeCount: countResult.count }
    }, 200, origin);
  } catch (error) {
    console.error('Pitch like error:', error);
    return jsonResponse({ success: true, data: { liked: true, likeCount: 0 } }, 200, origin);
  }
}

/**
 * DELETE /api/creator/pitches/:id/like
 */
export async function pitchUnlikeHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: true, data: { liked: false, likeCount: 0 } }, 200, origin);
  }

  try {
    const pitchId = extractPitchId(request);

    await sql`
      DELETE FROM likes WHERE user_id = ${userId} AND pitch_id = ${pitchId}
    `;

    const [countResult] = await sql`
      SELECT COUNT(*)::int as count FROM likes WHERE pitch_id = ${pitchId}
    `;
    await sql`
      UPDATE pitches SET like_count = ${countResult.count} WHERE id = ${pitchId}
    `;

    return jsonResponse({
      success: true,
      data: { liked: false, likeCount: countResult.count }
    }, 200, origin);
  } catch (error) {
    console.error('Pitch unlike error:', error);
    return jsonResponse({ success: true, data: { liked: false, likeCount: 0 } }, 200, origin);
  }
}

/**
 * POST /api/pitches/:id/save
 */
export async function pitchSaveHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: true, data: { saved: true } }, 200, origin);
  }

  try {
    const pitchId = extractPitchId(request);

    await sql`
      INSERT INTO saved_pitches (user_id, pitch_id, created_at)
      VALUES (${userId}, ${pitchId}, NOW())
      ON CONFLICT (user_id, pitch_id) DO NOTHING
    `;

    return jsonResponse({ success: true, data: { saved: true } }, 200, origin);
  } catch (error) {
    console.error('Pitch save error:', error);
    return jsonResponse({ success: true, data: { saved: true } }, 200, origin);
  }
}

/**
 * DELETE /api/pitches/:id/save
 */
export async function pitchUnsaveHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401, origin);
  }
  if (!sql) {
    return jsonResponse({ success: true, data: { saved: false } }, 200, origin);
  }

  try {
    const pitchId = extractPitchId(request);

    await sql`
      DELETE FROM saved_pitches WHERE user_id = ${userId} AND pitch_id = ${pitchId}
    `;

    return jsonResponse({ success: true, data: { saved: false } }, 200, origin);
  } catch (error) {
    console.error('Pitch unsave error:', error);
    return jsonResponse({ success: true, data: { saved: false } }, 200, origin);
  }
}

/**
 * POST /api/pitches/:id/publish
 */
export async function pitchPublishHandler(request: Request, env: Env): Promise<Response> {
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
    const pitchId = extractPitchId(request);

    const [pitch] = await sql`
      UPDATE pitches
      SET status = 'published', visibility = 'public', published_at = NOW(), updated_at = NOW()
      WHERE id = ${pitchId} AND user_id = ${userId}
      RETURNING id, title, status, visibility, published_at
    `;

    if (!pitch) {
      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Pitch not found or not owned by you' } }, 404, origin);
    }

    // Send email notifications to followers (fire-and-forget, separate try/catch)
    try {
      const pitchDetails = await sql`
        SELECT p.title, p.genre, p.logline, u.name, u.first_name, u.last_name
        FROM pitches p JOIN users u ON u.id = p.user_id
        WHERE p.id = ${pitchId} LIMIT 1
      `;
      if (pitchDetails.length > 0) {
        const pd = pitchDetails[0];
        const creatorName = pd.name || `${pd.first_name || ''} ${pd.last_name || ''}`.trim() || 'A creator';
        const followers = await sql`
          SELECT f.follower_id, u.email, u.first_name
          FROM follows f JOIN users u ON u.id = f.follower_id
          WHERE f.following_id = ${userId}
          LIMIT 50
        `;
        const resendKey = (env as Record<string, unknown>).RESEND_API_KEY as string;
        const frontendUrl = (env as Record<string, unknown>).FRONTEND_URL as string || 'https://pitchey-5o8.pages.dev';
        for (const follower of followers) {
          if (follower.email) {
            sendNewPitchFromFollowedEmail(follower.email, {
              creatorName,
              pitchTitle: pd.title || 'Untitled Pitch',
              pitchGenre: pd.genre || undefined,
              pitchLogline: pd.logline || undefined,
              // Previously hardcoded to pitchey.com — that's the coming-soon
              // marketing stub on a separate CF account, not the live frontend.
              pitchUrl: `${frontendUrl}/pitch/${pitchId}`,
            }, resendKey).catch((err: unknown) => {
              const e = err instanceof Error ? err : new Error(String(err));
              console.error('Failed to send new pitch email to follower:', e.message);
              try {
                Sentry.withScope((scope) => {
                  scope.setTag('email.context', 'pitch-interactions.new-pitch-follower-notify');
                  scope.setTag('pitchId', String(pitchId));
                  Sentry.captureException(e);
                });
              } catch { /* Sentry hub not initialized */ }
            });
          }
        }
      }
    } catch (emailErr) {
      // Non-blocking — don't fail the publish if email notifications fail
      console.error('Follower email notification error:', emailErr);
    }

    // Feature: Notify inviter (producer) when referred creator publishes their first pitch
    try {
      const [referral] = await sql`
        SELECT ri.inviter_id
        FROM referral_invites ri
        WHERE ri.redeemed_by = ${userId} AND ri.redeemed_at IS NOT NULL
        LIMIT 1
      `;
      if (referral?.inviter_id) {
        const [creatorInfo] = await sql`
          SELECT name, first_name, last_name FROM users WHERE id = ${Number(userId)} LIMIT 1
        `;
        const creatorName = creatorInfo?.name
          || `${creatorInfo?.first_name || ''} ${creatorInfo?.last_name || ''}`.trim()
          || 'A creator';
        const pitchTitle = pitch.title || 'Untitled Pitch';
        await safeQuery(
          () => sql`
            INSERT INTO notifications (
              user_id, type, title, message,
              related_user_id, related_pitch_id, created_at
            ) VALUES (
              ${Number(referral.inviter_id)},
              'pitch_published',
              ${`New pitch from ${creatorName}`},
              ${`${creatorName} published "${pitchTitle}" — they signed up through your invite`},
              ${Number(userId)},
              ${Number(pitchId)},
              NOW()
            )
          `,
          {
            fallback: [],
            context: 'pitch-interactions.inviter-first-publish-notify',
            tags: { pitchId: String(pitchId), inviterId: String(referral.inviter_id) },
          },
        );
      }
    } catch (referralErr) {
      // Non-blocking — don't fail the publish if referral notification fails
      const e = referralErr instanceof Error ? referralErr : new Error(String(referralErr));
      console.error('Referral invite notification error:', e.message);
    }

    return jsonResponse({ success: true, data: { pitch } }, 200, origin);
  } catch (error) {
    console.error('Pitch publish error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to publish pitch' } }, 500, origin);
  }
}

/**
 * POST /api/pitches/:id/archive
 */
export async function pitchArchiveHandler(request: Request, env: Env): Promise<Response> {
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
    const pitchId = extractPitchId(request);

    const [pitch] = await sql`
      UPDATE pitches
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${pitchId} AND user_id = ${userId}
      RETURNING id, title, status
    `;

    if (!pitch) {
      return jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Pitch not found or not owned by you' } }, 404, origin);
    }

    return jsonResponse({ success: true, data: { pitch } }, 200, origin);
  } catch (error) {
    console.error('Pitch archive error:', error);
    return jsonResponse({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to archive pitch' } }, 500, origin);
  }
}
