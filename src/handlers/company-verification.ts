/**
 * Company Verification Handlers
 * Routes for production company verification flow:
 *   POST   /api/production/verify                — submit verification
 *   POST   /api/production/verify/upload-insurance — upload proof of insurance to R2
 *   GET    /api/production/verification-status    — check own verification status
 *   GET    /api/admin/verifications               — list verifications (admin)
 *   PATCH  /api/admin/verifications/:id           — approve/reject (admin)
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import {
  runAutoChecks,
  shouldAutoApprove,
  submitVerification,
  getVerificationStatus,
  listVerifications,
  reviewVerification,
  type VerificationSubmission,
} from '../services/company-verification.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, status: number, origin: string | null): Response {
  return jsonResponse({ error: message }, status, origin);
}

// ---------------------------------------------------------------------------
// POST /api/production/verify
// ---------------------------------------------------------------------------

export async function submitVerificationHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', 401, origin);

  const db = getDb(env);
  if (!db) return errorResponse('Database unavailable', 503, origin);

  let body: {
    companyName?: string;
    region?: string;
    ein?: string;
    companyNumber?: string;
    websiteUrl?: string;
    hasCompanyNumber?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin);
  }

  // Validate required fields
  const { companyName, region, ein, companyNumber, websiteUrl, hasCompanyNumber = true } = body;

  if (!companyName?.trim()) return errorResponse('Company name is required', 400, origin);
  if (!region || !['usa', 'uk', 'other'].includes(region)) {
    return errorResponse('Region must be usa, uk, or other', 400, origin);
  }
  if (!websiteUrl?.trim()) return errorResponse('Website URL is required', 400, origin);

  // Region-specific validation
  if (hasCompanyNumber) {
    if (region === 'usa' && !ein?.trim()) {
      return errorResponse('EIN is required for USA companies', 400, origin);
    }
    if ((region === 'uk' || region === 'other') && !companyNumber?.trim()) {
      return errorResponse('Company registration number is required', 400, origin);
    }
  }

  // If no company number, insurance must already be uploaded
  if (!hasCompanyNumber) {
    const existing = await getVerificationStatus(db, userId);
    if (!existing?.proof_of_insurance_url) {
      return errorResponse(
        'Proof of insurance must be uploaded first (use /api/production/verify/upload-insurance)',
        400,
        origin,
      );
    }
  }

  const submission: VerificationSubmission = {
    userId,
    companyName: companyName.trim(),
    region: region as 'usa' | 'uk' | 'other',
    ein: ein?.trim(),
    companyNumber: companyNumber?.trim(),
    websiteUrl: websiteUrl.trim(),
    hasCompanyNumber,
    proofOfInsuranceUrl: undefined, // Preserved from existing row via COALESCE in upsert
  };

  // Run automated checks
  const autoChecks = await runAutoChecks(
    submission,
    env.COMPANIES_HOUSE_API_KEY as string | undefined,
  );

  const autoApproved = shouldAutoApprove(autoChecks, hasCompanyNumber);

  const result = await submitVerification(db, submission, autoChecks, autoApproved);

  return jsonResponse({
    verification: result,
    autoChecks,
    message: autoApproved
      ? 'Your company has been automatically verified.'
      : 'Verification submitted. Our team will review it shortly.',
  }, 200, origin);
}

// ---------------------------------------------------------------------------
// POST /api/production/verify/upload-insurance
// ---------------------------------------------------------------------------

export async function uploadInsuranceHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', 401, origin);

  const db = getDb(env);
  if (!db) return errorResponse('Database unavailable', 503, origin);

  const bucket = env.PITCH_STORAGE as R2Bucket | undefined;
  if (!bucket) return errorResponse('Storage unavailable', 503, origin);

  const contentType = request.headers.get('Content-Type') || '';

  // Validate file type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowedTypes.some(t => contentType.startsWith(t))) {
    return errorResponse('File must be PDF, JPEG, or PNG', 400, origin);
  }

  // Read file body
  const fileBuffer = await request.arrayBuffer();
  const fileSize = fileBuffer.byteLength;

  if (fileSize > 10 * 1024 * 1024) {
    return errorResponse('File must be under 10MB', 400, origin);
  }

  if (fileSize === 0) {
    return errorResponse('File is empty', 400, origin);
  }

  // Upload to R2 under verifications/ prefix
  const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';
  const key = `verifications/${userId}/insurance.${ext}`;

  await bucket.put(key, fileBuffer, {
    httpMetadata: { contentType },
    customMetadata: { userId, purpose: 'proof_of_insurance', uploadedAt: new Date().toISOString() },
  });

  // Upsert the insurance URL into company_verifications (create row if needed)
  await db`
    INSERT INTO company_verifications (user_id, company_name, region, website_url, has_company_number, proof_of_insurance_url, status)
    VALUES (${userId}, '', 'other', '', false, ${key}, 'pending')
    ON CONFLICT (user_id) DO UPDATE SET
      proof_of_insurance_url = ${key}
  `;

  return jsonResponse({
    message: 'Insurance document uploaded successfully.',
    key,
  }, 200, origin);
}

// ---------------------------------------------------------------------------
// GET /api/production/verification-status
// ---------------------------------------------------------------------------

export async function verificationStatusHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', 401, origin);

  const db = getDb(env);
  if (!db) return errorResponse('Database unavailable', 503, origin);

  const verification = await getVerificationStatus(db, userId);

  return jsonResponse({
    verified: verification
      ? ['approved', 'auto_approved'].includes(verification.status as string)
      : false,
    verification: verification || null,
  }, 200, origin);
}

// ---------------------------------------------------------------------------
// GET /api/admin/verifications
// ---------------------------------------------------------------------------

export async function adminListVerificationsHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const db = getDb(env);
  if (!db) return errorResponse('Database unavailable', 503, origin);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const { verifications, total } = await listVerifications(db, status, limit, offset);

  return jsonResponse({ verifications, total, limit, offset }, 200, origin);
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/verifications/:id
// ---------------------------------------------------------------------------

export async function adminReviewVerificationHandler(
  request: Request,
  env: Env,
  verificationId: string,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const reviewerId = await getUserId(request, env);
  if (!reviewerId) return errorResponse('Unauthorized', 401, origin);

  const db = getDb(env);
  if (!db) return errorResponse('Database unavailable', 503, origin);

  let body: { approved?: boolean; rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin);
  }

  if (typeof body.approved !== 'boolean') {
    return errorResponse('approved (boolean) is required', 400, origin);
  }

  const result = await reviewVerification(db, verificationId, reviewerId, body.approved, body.rejectionReason);

  if (!result) return errorResponse('Verification not found', 404, origin);

  return jsonResponse({
    verification: result,
    message: body.approved ? 'Verification approved.' : 'Verification rejected.',
  }, 200, origin);
}
