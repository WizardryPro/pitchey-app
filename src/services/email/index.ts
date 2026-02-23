/**
 * Email Service Index
 * Provides unified access to email sending functions for Cloudflare Workers.
 *
 * All functions accept an optional `apiKey` parameter. In Workers, callers should
 * pass `env.RESEND_API_KEY` directly since Workers don't have process.env.
 */

import { WorkerEmailService } from '../worker-email.ts';

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
