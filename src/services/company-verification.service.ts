/**
 * Company Verification Service
 * Handles automated checks for production company verification:
 * - EIN format + IRS prefix validation (USA)
 * - UK Companies House API lookup
 * - Website DNS/HTTP/content validation
 * - Insurance document file validation
 *
 * Results stored in auto_checks JSONB column on company_verifications table.
 */

import { neon } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckResult = 'pass' | 'fail' | 'warn' | 'skip';

export interface AutoCheckResults {
  ein_format?: CheckResult;
  ein_prefix?: CheckResult;
  companies_house_exists?: CheckResult;
  companies_house_active?: CheckResult;
  companies_house_name_match?: CheckResult;
  website_resolves?: CheckResult;
  website_responds?: CheckResult;
  website_mentions_company?: CheckResult;
  insurance_file_type?: CheckResult;
  insurance_file_size?: CheckResult;
  checked_at: string;
}

export interface VerificationSubmission {
  userId: string;
  companyName: string;
  region: 'usa' | 'uk' | 'other';
  ein?: string;
  companyNumber?: string;
  websiteUrl: string;
  hasCompanyNumber: boolean;
  proofOfInsuranceUrl?: string;
}

// ---------------------------------------------------------------------------
// EIN Validation (USA)
// ---------------------------------------------------------------------------

// Valid IRS campus prefixes
const VALID_EIN_PREFIXES = new Set([
  '01','02','03','04','05','06',
  '10','11','12','13','14','15','16',
  '20','21','22','23','24','25','26','27',
  '30','31','32','33','34','35','36','37','38',
  '40','41','42','43','44','45','46','47','48',
  '50','51','52','53','54','55','56','57','58','59',
  '60','61','62','63','64','65','66','67','68',
  '71','72','73','74','75','76','77',
  '80','81','82','83','84','85','86','87','88',
  '90','91','92','93','94','95','96','97','98','99',
]);

export function validateEinFormat(ein: string): CheckResult {
  // Format: XX-XXXXXXX
  const cleaned = ein.trim();
  if (!/^\d{2}-\d{7}$/.test(cleaned)) return 'fail';
  return 'pass';
}

export function validateEinPrefix(ein: string): CheckResult {
  const prefix = ein.trim().substring(0, 2);
  return VALID_EIN_PREFIXES.has(prefix) ? 'pass' : 'fail';
}

// ---------------------------------------------------------------------------
// UK Companies House Lookup
// ---------------------------------------------------------------------------

export async function checkCompaniesHouse(
  companyNumber: string,
  companyName: string,
  apiKey: string | undefined,
): Promise<{ exists: CheckResult; active: CheckResult; nameMatch: CheckResult }> {
  if (!apiKey) {
    return { exists: 'skip', active: 'skip', nameMatch: 'skip' };
  }

  try {
    const url = `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber.trim())}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Basic ${btoa(apiKey + ':')}`,
      },
    });

    if (resp.status === 404) {
      return { exists: 'fail', active: 'fail', nameMatch: 'fail' };
    }

    if (!resp.ok) {
      console.error(`[CompaniesHouse] API error: ${resp.status}`);
      return { exists: 'skip', active: 'skip', nameMatch: 'skip' };
    }

    const data = await resp.json() as {
      company_name?: string;
      company_status?: string;
    };

    const exists: CheckResult = 'pass';
    const active: CheckResult = data.company_status === 'active' ? 'pass' : 'fail';

    // Fuzzy name match: lowercase, strip punctuation, compare
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const apiName = normalize(data.company_name || '');
    const submittedName = normalize(companyName);
    const nameMatch: CheckResult =
      apiName === submittedName || apiName.includes(submittedName) || submittedName.includes(apiName)
        ? 'pass'
        : 'warn';

    return { exists, active, nameMatch };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`[CompaniesHouse] Fetch error: ${e.message}`);
    return { exists: 'skip', active: 'skip', nameMatch: 'skip' };
  }
}

// ---------------------------------------------------------------------------
// Website Validation
// ---------------------------------------------------------------------------

export async function checkWebsite(
  websiteUrl: string,
  companyName: string,
): Promise<{ resolves: CheckResult; responds: CheckResult; mentionsCompany: CheckResult }> {
  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'PitcheyVerification/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    const resolves: CheckResult = 'pass';
    const responds: CheckResult = resp.ok ? 'pass' : 'warn';

    // Check if company name is mentioned in page content
    let mentionsCompany: CheckResult = 'skip';
    try {
      const text = await resp.text();
      const lowerText = text.toLowerCase().substring(0, 50000); // Limit to first 50k chars
      const lowerName = companyName.toLowerCase().trim();
      // Check for company name or significant words from it (3+ char words)
      const significantWords = lowerName.split(/\s+/).filter(w => w.length >= 3);
      const nameFound = lowerText.includes(lowerName);
      const wordsFound = significantWords.length > 0 &&
        significantWords.filter(w => lowerText.includes(w)).length >= Math.ceil(significantWords.length / 2);

      mentionsCompany = nameFound ? 'pass' : wordsFound ? 'warn' : 'fail';
    } catch {
      mentionsCompany = 'skip';
    }

    return { resolves, responds, mentionsCompany };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    // DNS resolution failure or timeout
    if (e.message.includes('fetch') || e.message.includes('DNS') || e.message.includes('timeout')) {
      return { resolves: 'fail', responds: 'fail', mentionsCompany: 'skip' };
    }
    return { resolves: 'skip', responds: 'skip', mentionsCompany: 'skip' };
  }
}

// ---------------------------------------------------------------------------
// Insurance Document Validation
// ---------------------------------------------------------------------------

const ALLOWED_INSURANCE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const MAX_INSURANCE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateInsuranceFile(
  mimeType: string,
  fileSize: number,
): { fileType: CheckResult; fileSize: CheckResult } {
  const fileTypeResult: CheckResult = ALLOWED_INSURANCE_TYPES.has(mimeType) ? 'pass' : 'fail';
  const fileSizeResult: CheckResult = fileSize <= MAX_INSURANCE_SIZE ? 'pass' : 'fail';
  return { fileType: fileTypeResult, fileSize: fileSizeResult };
}

// ---------------------------------------------------------------------------
// Run All Checks
// ---------------------------------------------------------------------------

export async function runAutoChecks(
  submission: VerificationSubmission,
  companiesHouseApiKey: string | undefined,
  insuranceMimeType?: string,
  insuranceFileSize?: number,
): Promise<AutoCheckResults> {
  const results: AutoCheckResults = {
    checked_at: new Date().toISOString(),
  };

  // Region-specific ID checks
  if (submission.region === 'usa' && submission.hasCompanyNumber && submission.ein) {
    results.ein_format = validateEinFormat(submission.ein);
    results.ein_prefix = validateEinPrefix(submission.ein);
  }

  if (submission.region === 'uk' && submission.hasCompanyNumber && submission.companyNumber) {
    const ch = await checkCompaniesHouse(
      submission.companyNumber,
      submission.companyName,
      companiesHouseApiKey,
    );
    results.companies_house_exists = ch.exists;
    results.companies_house_active = ch.active;
    results.companies_house_name_match = ch.nameMatch;
  }

  // Website check (all regions)
  const web = await checkWebsite(submission.websiteUrl, submission.companyName);
  results.website_resolves = web.resolves;
  results.website_responds = web.responds;
  results.website_mentions_company = web.mentionsCompany;

  // Insurance doc check (fallback path)
  if (!submission.hasCompanyNumber && insuranceMimeType && insuranceFileSize !== undefined) {
    const ins = validateInsuranceFile(insuranceMimeType, insuranceFileSize);
    results.insurance_file_type = ins.fileType;
    results.insurance_file_size = ins.fileSize;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Auto-Approval Logic
// ---------------------------------------------------------------------------

export function shouldAutoApprove(checks: AutoCheckResults, hasCompanyNumber: boolean): boolean {
  // Insurance path always requires manual review
  if (!hasCompanyNumber) return false;

  const values = Object.entries(checks)
    .filter(([key]) => key !== 'checked_at')
    .map(([, val]) => val as CheckResult);

  // All applicable checks must pass — no fails, no warns, no skips
  return values.length > 0 && values.every(v => v === 'pass');
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

export async function submitVerification(
  sql: ReturnType<typeof neon>,
  submission: VerificationSubmission,
  autoChecks: AutoCheckResults,
  autoApproved: boolean,
): Promise<{ id: string; status: string }> {
  const status = autoApproved ? 'auto_approved' : 'pending';

  const rows = await sql`
    INSERT INTO company_verifications (
      user_id, company_name, region, ein, company_number,
      website_url, has_company_number, proof_of_insurance_url,
      status, auto_checks
    ) VALUES (
      ${submission.userId},
      ${submission.companyName},
      ${submission.region},
      ${submission.ein || null},
      ${submission.companyNumber || null},
      ${submission.websiteUrl},
      ${submission.hasCompanyNumber},
      ${submission.proofOfInsuranceUrl || null},
      ${status},
      ${JSON.stringify(autoChecks)}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      region = EXCLUDED.region,
      ein = EXCLUDED.ein,
      company_number = EXCLUDED.company_number,
      website_url = EXCLUDED.website_url,
      has_company_number = EXCLUDED.has_company_number,
      proof_of_insurance_url = COALESCE(EXCLUDED.proof_of_insurance_url, company_verifications.proof_of_insurance_url),
      status = EXCLUDED.status,
      auto_checks = EXCLUDED.auto_checks,
      submitted_at = now(),
      reviewed_at = CASE WHEN EXCLUDED.status = 'auto_approved' THEN now() ELSE NULL END,
      reviewed_by = NULL,
      rejection_reason = NULL
    RETURNING id, status
  ` as Record<string, any>[];

  // Update trust badge tier on user
  await updateUserVerificationTier(sql, submission.userId);

  return { id: rows[0].id, status: rows[0].status };
}

export async function getVerificationStatus(
  sql: ReturnType<typeof neon>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const rows = await sql`
    SELECT id, company_name, region, ein, company_number, website_url,
           has_company_number, status, auto_checks, rejection_reason,
           submitted_at, reviewed_at
    FROM company_verifications
    WHERE user_id = ${userId}
    LIMIT 1
  ` as Record<string, any>[];
  return rows.length > 0 ? rows[0] : null;
}

export async function listVerifications(
  sql: ReturnType<typeof neon>,
  statusFilter?: string,
  limit = 50,
  offset = 0,
): Promise<{ verifications: Record<string, unknown>[]; total: number }> {
  const countRows = (statusFilter
    ? await sql`SELECT COUNT(*)::int as total FROM company_verifications WHERE status = ${statusFilter}`
    : await sql`SELECT COUNT(*)::int as total FROM company_verifications`
  ) as Record<string, any>[];

  const total = countRows[0]?.total || 0;

  const verifications = (statusFilter
    ? await sql`
        SELECT cv.*, u.email, u.name as user_name, u.username
        FROM company_verifications cv
        JOIN users u ON cv.user_id::text = u.id::text
        WHERE cv.status = ${statusFilter}
        ORDER BY cv.submitted_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT cv.*, u.email, u.name as user_name, u.username
        FROM company_verifications cv
        JOIN users u ON cv.user_id::text = u.id::text
        ORDER BY cv.submitted_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
  ) as Record<string, any>[];

  return { verifications, total };
}

export async function reviewVerification(
  sql: ReturnType<typeof neon>,
  verificationId: string,
  reviewerId: string,
  approved: boolean,
  rejectionReason?: string,
): Promise<Record<string, unknown> | null> {
  const status = approved ? 'approved' : 'rejected';
  const rows = await sql`
    UPDATE company_verifications
    SET status = ${status},
        reviewed_at = now(),
        reviewed_by = ${reviewerId},
        rejection_reason = ${approved ? null : (rejectionReason || null)}
    WHERE id = ${verificationId}
    RETURNING id, user_id, status
  ` as Record<string, any>[];

  // Update trust badge tier on user
  if (rows.length > 0) {
    await updateUserVerificationTier(sql, String(rows[0].user_id));
  }

  return rows.length > 0 ? rows[0] : null;
}

export async function isProductionVerified(
  sql: ReturnType<typeof neon>,
  userId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM company_verifications
    WHERE user_id = ${userId}
      AND status IN ('approved', 'auto_approved')
    LIMIT 1
  ` as Record<string, any>[];
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Trust Badge Tier
// ---------------------------------------------------------------------------

export function calculateVerificationTier(
  status: string,
  autoChecks: Record<string, string> | null,
): 'gold' | 'silver' | 'grey' | null {
  if (status === 'approved' && autoChecks) {
    const checkValues = Object.entries(autoChecks)
      .filter(([key]) => key !== 'checked_at')
      .map(([, val]) => val);
    if (checkValues.length > 0 && checkValues.every(v => v === 'pass')) {
      return 'gold';
    }
    return 'silver';
  }
  if (status === 'auto_approved') return 'silver';
  if (status === 'pending') return 'grey';
  return null; // rejected or no verification
}

export async function updateUserVerificationTier(
  sql: ReturnType<typeof neon>,
  userId: string,
): Promise<void> {
  const rows = await sql`
    SELECT status, auto_checks FROM company_verifications
    WHERE user_id = ${userId} LIMIT 1
  ` as Record<string, any>[];

  const tier = rows.length > 0
    ? calculateVerificationTier(rows[0].status, rows[0].auto_checks)
    : null;

  await sql`UPDATE users SET verification_tier = ${tier} WHERE id::text = ${userId}`;
}
