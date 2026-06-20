/**
 * Email Service Index
 * Provides unified access to email sending functions for Cloudflare Workers.
 *
 * All functions accept an optional `apiKey` parameter. In Workers, callers should
 * pass `env.RESEND_API_KEY` directly since Workers don't have process.env.
 */

import { WorkerEmailService } from '../worker-email';

// Helper to get email service — prefers explicit apiKey, falls back to globals for local dev
function getEmailService(apiKey?: string) {
  let resolvedKey = apiKey;

  if (!resolvedKey) {
    // Fallback for local dev/tests only — does NOT work in Cloudflare Workers
    try {
      resolvedKey = (globalThis as any).Deno?.env.get('RESEND_API_KEY') || (globalThis as any).process?.env?.RESEND_API_KEY;
    } catch {
      // Silently fail in Workers
    }
  }

  if (!resolvedKey) {
    console.debug('Email service: no RESEND_API_KEY available, emails will fail silently');
  }

  return new WorkerEmailService({
    apiKey: resolvedKey || '',
    fromEmail: 'noreply@pitchey.com',
    fromName: 'Pitchey'
  });
}

/**
 * Send NDA Request Email
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendNDARequestEmail(to: string, data: any, apiKey?: string) {
  const service = getEmailService(apiKey);
  return await service.sendTemplate(to, 'ndaRequest', {
    ...data,
    requesterName: data.senderName, // Map template variable
    reviewUrl: data.actionUrl      // Map template variable
  });
}

/**
 * Send NDA Response Email (Approval/Rejection)
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendNDAResponseEmail(to: string, data: any, apiKey?: string) {
  const service = getEmailService(apiKey);
  const template = data.approved ? 'ndaApproved' : 'ndaRejected';

  return await service.sendTemplate(to, template, {
    ...data,
    pitchUrl: data.actionUrl // Map template variable
  });
}

/**
 * Send Team Invite Email
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendTeamInviteEmail(to: string, data: {
  inviterName: string;
  teamName: string;
  role: string;
  message?: string;
  acceptUrl: string;
}, apiKey?: string) {
  const service = getEmailService(apiKey);
  return await service.sendTemplate(to, 'teamInvite', {
    ...data,
    subject: `You've been invited to join "${data.teamName}" on Pitchey`
  });
}

/**
 * Send Collaborator Invite Email
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendCollaboratorInviteEmail(to: string, data: {
  inviterName: string;
  companyName: string;
  role: string;
  projectTitle: string;
  acceptUrl: string;
}, apiKey?: string) {
  const service = getEmailService(apiKey);
  return await service.sendTemplate(to, 'collaboratorInvite', {
    ...data,
    subject: `You've been invited to collaborate on "${data.projectTitle}" — Pitchey`
  });
}

/**
 * Send Collaborator Accepted Notification Email
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendCollaboratorAcceptedEmail(to: string, data: {
  collaboratorName: string;
  role: string;
  projectTitle: string;
  projectUrl: string;
}, apiKey?: string) {
  const service = getEmailService(apiKey);
  return await service.sendTemplate(to, 'collaboratorAccepted', {
    ...data,
    subject: `${data.collaboratorName} joined "${data.projectTitle}" on Pitchey`
  });
}

/**
 * Send New Follower Email
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendNewFollowerEmail(to: string, data: {
  followerName: string;
  followerType: string;
  profileUrl: string;
}, apiKey?: string) {
  const service = getEmailService(apiKey);
  return await service.sendTemplate(to, 'newFollower', {
    ...data,
    subject: 'You have a new follower on Pitchey'
  });
}

/**
 * Send New Pitch From Followed Creator Email
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendNewPitchFromFollowedEmail(to: string, data: {
  creatorName: string;
  pitchTitle: string;
  pitchGenre?: string;
  pitchLogline?: string;
  pitchUrl: string;
}, apiKey?: string) {
  const service = getEmailService(apiKey);
  return await service.sendTemplate(to, 'newPitchFromFollowed', {
    ...data,
    subject: `${data.creatorName} published a new pitch: ${data.pitchTitle}`
  });
}

/**
 * Send "Your pitch was sealed" provenance email. Doubles as an independent,
 * third-party-dated record of the content hash (kept in the creator's inbox,
 * outside our database) — the Phase-1 timestamp anchor for IP-theft evidence.
 * Sent inline (not via a registered template) so it's fully self-contained.
 * @param apiKey - Pass env.RESEND_API_KEY from Worker env
 */
export async function sendPitchSealedEmail(to: string, data: {
  creatorName: string;
  pitchTitle: string;
  contentHash: string;
  sealedAt: string;
  verifyUrl: string;
}, apiKey?: string) {
  const service = getEmailService(apiKey);

  const esc = (v: string) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let sealedDate = data.sealedAt;
  try {
    sealedDate = new Date(data.sealedAt).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  } catch { /* keep raw */ }

  const subject = `Your pitch "${data.pitchTitle}" is sealed — keep this email as proof`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #059669;">🛡️ Your pitch is sealed</h2>
      <p>Hi ${esc(data.creatorName)},</p>
      <p>The content of your pitch <strong>"${esc(data.pitchTitle)}"</strong> has been
      cryptographically sealed (SHA-256) on Pitchey. This is your timestamped proof
      that the idea existed in this form on this date.</p>
      <p style="background:#f9fafb;border-left:3px solid #059669;padding:12px 16px;">
        <strong>Sealed on:</strong> ${esc(sealedDate)}<br>
        <strong>Content hash:</strong><br>
        <code style="font-size:12px;word-break:break-all;">${esc(data.contentHash)}</code>
      </p>
      <p style="font-weight:bold;">Keep this email.</p>
      <p>It is an independent, dated record of your seal held outside Pitchey's own
      systems. If you ever need to prove authorship, this email plus your downloadable
      Certificate of Provenance together establish priority of your idea.</p>
      <p>Anyone can verify the seal at:<br>
        <a href="${esc(data.verifyUrl)}">${esc(data.verifyUrl)}</a></p>
      <p style="color:#6b7280;font-size:12px;">This is evidence of priority, not a
      registration of copyright.</p>
    </div>`;

  const text = [
    `Hi ${data.creatorName},`,
    ``,
    `Your pitch "${data.pitchTitle}" has been cryptographically sealed (SHA-256) on Pitchey.`,
    ``,
    `Sealed on: ${sealedDate}`,
    `Content hash: ${data.contentHash}`,
    ``,
    `KEEP THIS EMAIL. It is an independent, dated record of your seal held outside`,
    `Pitchey's systems. It helps establish priority of your idea if ever disputed.`,
    ``,
    `Verify the seal at: ${data.verifyUrl}`,
    ``,
    `This is evidence of priority, not a registration of copyright.`,
  ].join('\n');

  return await service.send({ to, subject, html, text }, { templateType: 'pitchSealed' });
}
