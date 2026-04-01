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
