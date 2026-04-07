-- Company Verifications for Production Portal
-- Production companies must verify identity before purchasing credits or viewing pitches.
-- Supports USA (EIN), UK (Companies House), and rest-of-world (local registration number).
-- Proof of insurance is a fallback when applicant has no company number.
-- Insurance documents are admin-only and never visible to other users.

CREATE TABLE IF NOT EXISTS company_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('usa', 'uk', 'other')),

  -- Primary identifiers (one required per region, unless insurance fallback)
  ein TEXT,                          -- USA: Employer Identification Number (XX-XXXXXXX)
  company_number TEXT,               -- UK: Companies House number / Other: local registration
  website_url TEXT NOT NULL,

  -- Fallback: proof of insurance when no company number available
  has_company_number BOOLEAN NOT NULL DEFAULT true,
  proof_of_insurance_url TEXT,       -- R2 path, admin-only, never exposed publicly

  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected')),
  rejection_reason TEXT,

  -- Automated check results
  auto_checks JSONB DEFAULT '{}',

  -- Timestamps
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id),

  -- Constraints
  CONSTRAINT unique_user_verification UNIQUE (user_id),
  CONSTRAINT ein_required_for_usa CHECK (
    region != 'usa' OR has_company_number = false OR ein IS NOT NULL
  ),
  CONSTRAINT company_number_required_for_uk CHECK (
    region != 'uk' OR has_company_number = false OR company_number IS NOT NULL
  ),
  CONSTRAINT company_number_required_for_other CHECK (
    region != 'other' OR has_company_number = false OR company_number IS NOT NULL
  ),
  CONSTRAINT insurance_required_without_company_number CHECK (
    has_company_number = true OR proof_of_insurance_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_company_verifications_user_id ON company_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_company_verifications_status ON company_verifications(status);
CREATE INDEX IF NOT EXISTS idx_company_verifications_region ON company_verifications(region);
