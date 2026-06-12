/**
 * Build Your Team (P1) — invite / accept / decline for creative attachments.
 *
 * A pitch's "Attached Creatives" are typed names today (status='listed'). These handlers
 * let the owner invite the real person — a Pitchey user (in-app notification) or an email
 * (invite link) — to confirm, turning an unverifiable claim into a verified attachment.
 *
 * Routes (registered in worker-integrated.ts):
 *   POST /api/pitches/:id/attachments/:attachmentId/invite   (owner)
 *   POST /api/attachments/:token/accept                      (invitee, authed)
 *   POST /api/attachments/:token/decline                     (invitee, authed)
 */
import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { sendCollaboratorInviteEmail } from '../services/email/index';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

// Segment immediately after `key` in the path (e.g. segAfter(path, 'attachments') → token).
function segAfter(pathname: string, key: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const i = parts.indexOf(key);
  return i >= 0 && i + 1 < parts.length ? parts[i + 1] : null;
}

// Personal name first — never company_name as a person (see reference_display_name_drift).
function displayName(u: { username?: string | null; name?: string | null; first_name?: string | null }): string {
  return (u.username || u.name || u.first_name || 'A creator') as string;
}

// In-app notification — mirrors the direct-insert in handlers/calls.ts notify().
// Omit `priority`: prod's drifted notifications_priority_check rejects an explicit 'normal'.
async function notify(
  sql: ReturnType<typeof getDb>,
  n: { userId: number | string; type: string; title: string; message: string; pitchId?: number | null; fromUserId?: number | string | null; actionUrl?: string },
): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO notifications (user_id, type, title, message, related_pitch_id, related_user_id, action_url, is_read, created_at)
      VALUES (${n.userId}, ${n.type}, ${n.title}, ${n.message}, ${n.pitchId ?? null}, ${n.fromUserId ?? null}, ${n.actionUrl ?? '/creator/dashboard'}, false, NOW())
    `;
  } catch (e) {
    console.error('attachment notify failed:', e);
  }
}

/**
 * POST /api/pitches/:id/attachments/:attachmentId/invite — owner invites a creative.
 * body: { userId?: number } and/or { email?: string }
 */
export async function inviteCreativeAttachmentHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  if (!userId) return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  if (!sql) return jsonResponse({ success: false, error: 'Database unavailable' }, 503, origin);

  const url = new URL(request.url);
  const pitchId = segAfter(url.pathname, 'pitches');
  const attachmentId = segAfter(url.pathname, 'attachments');
  if (!pitchId || !attachmentId) return jsonResponse({ success: false, error: 'Invalid path' }, 400, origin);

  let body: { userId?: number | string; email?: string } = {};
  try { body = await request.json() as typeof body; } catch { /* empty body ok-checked below */ }
  const inviteUserId = body.userId ? Number(body.userId) : null;
  const inviteEmail = body.email ? String(body.email).trim().toLowerCase() : null;
  if (!inviteUserId && !inviteEmail) {
    return jsonResponse({ success: false, error: 'Provide a userId or email to invite' }, 400, origin);
  }

  try {
    const [pitch] = await sql`
      SELECT p.id, p.title, p.user_id, u.username, u.name, u.first_name
      FROM pitches p JOIN users u ON u.id = p.user_id
      WHERE p.id = ${pitchId} LIMIT 1
    `;
    if (!pitch) return jsonResponse({ success: false, error: 'Pitch not found' }, 404, origin);
    if (Number(pitch.user_id) !== Number(userId)) {
      return jsonResponse({ success: false, error: 'Only the pitch owner can invite creatives' }, 403, origin);
    }

    const [attachment] = await sql`
      SELECT id, name, role, status FROM pitch_creative_attachments
      WHERE id = ${attachmentId} AND pitch_id = ${pitchId} LIMIT 1
    `;
    if (!attachment) return jsonResponse({ success: false, error: 'Attachment not found' }, 404, origin);
    if (attachment.status === 'accepted') {
      return jsonResponse({ success: false, error: 'This creative has already confirmed their attachment' }, 409, origin);
    }

    const token = crypto.randomUUID();
    await sql.query(
      `UPDATE pitch_creative_attachments
         SET status = 'invited', invited_user_id = $1, invited_email = $2,
             invite_token = $3, invited_at = NOW(), responded_at = NULL
       WHERE id = $4`,
      [inviteUserId, inviteEmail, token, attachmentId],
    );

    const ownerName = displayName(pitch);
    const role = attachment.role as string;
    const base = (env as Env & { FRONTEND_URL?: string }).FRONTEND_URL || 'https://pitchey-5o8.pages.dev';
    const acceptUrl = `${base}/attachments/${token}`;

    if (inviteUserId) {
      await notify(sql, {
        userId: inviteUserId,
        type: 'creative_attachment_invite',
        title: `You've been attached as ${role}`,
        message: `${ownerName} added you as ${role} on "${pitch.title}" — confirm to verify your attachment.`,
        pitchId: Number(pitchId),
        fromUserId: userId,
        actionUrl: `/attachments/${token}`,
      });
    }
    if (inviteEmail) {
      try {
        await sendCollaboratorInviteEmail(inviteEmail, {
          inviterName: ownerName,
          companyName: '',
          role,
          projectTitle: pitch.title as string,
          acceptUrl,
        }, (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY);
      } catch (e) {
        console.error('attachment invite email failed:', e);
      }
    }

    return jsonResponse({
      success: true,
      data: { id: String(attachment.id), status: 'invited', invitedUserId: inviteUserId, invitedEmail: inviteEmail },
    }, 200, origin);
  } catch (error) {
    console.error('inviteCreativeAttachment error:', error);
    return jsonResponse({ success: false, error: 'Failed to send invite' }, 500, origin);
  }
}

async function respondToInvite(request: Request, env: Env, decision: 'accepted' | 'declined'): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  if (!userId) return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  if (!sql) return jsonResponse({ success: false, error: 'Database unavailable' }, 503, origin);

  const token = segAfter(new URL(request.url).pathname, 'attachments');
  if (!token) return jsonResponse({ success: false, error: 'Invalid invite link' }, 400, origin);

  try {
    const [att] = await sql`
      SELECT a.id, a.pitch_id, a.role, a.status, a.invited_user_id, p.title, p.user_id AS owner_id
      FROM pitch_creative_attachments a JOIN pitches p ON p.id = a.pitch_id
      WHERE a.invite_token = ${token} LIMIT 1
    `;
    if (!att) return jsonResponse({ success: false, error: 'Invite not found or already used' }, 404, origin);
    if (att.status !== 'invited') {
      return jsonResponse({ success: false, error: 'This invite has already been responded to' }, 409, origin);
    }
    // If the invite named a specific Pitchey user, only they may respond.
    if (att.invited_user_id && Number(att.invited_user_id) !== Number(userId)) {
      return jsonResponse({ success: false, error: 'This invite was addressed to a different account' }, 403, origin);
    }

    await sql.query(
      `UPDATE pitch_creative_attachments
         SET status = $1, invited_user_id = COALESCE(invited_user_id, $2),
             responded_at = NOW(), invite_token = NULL
       WHERE id = $3`,
      [decision, userId, att.id],
    );

    const [me] = await sql`SELECT username, name, first_name FROM users WHERE id = ${userId} LIMIT 1`;
    const myName = me ? displayName(me) : 'A creative';
    await notify(sql, {
      userId: att.owner_id,
      type: decision === 'accepted' ? 'creative_attachment_accepted' : 'creative_attachment_declined',
      title: decision === 'accepted' ? 'Attachment confirmed' : 'Attachment declined',
      message: `${myName} ${decision === 'accepted' ? 'confirmed' : 'declined'} the ${att.role} attachment on "${att.title}".`,
      pitchId: Number(att.pitch_id),
      fromUserId: userId,
      actionUrl: `/creator/pitch/${att.pitch_id}`,
    });

    return jsonResponse({ success: true, data: { id: String(att.id), status: decision } }, 200, origin);
  } catch (error) {
    console.error('respondToInvite error:', error);
    return jsonResponse({ success: false, error: 'Failed to respond to invite' }, 500, origin);
  }
}

export const acceptCreativeAttachmentHandler = (request: Request, env: Env) => respondToInvite(request, env, 'accepted');
export const declineCreativeAttachmentHandler = (request: Request, env: Env) => respondToInvite(request, env, 'declined');
