-- 099_company_nda_signatures.sql
--
-- Collaboration NDA (B3): when a creator joins a production company via a join
-- code, they sign the Platform Standard NDA before getting workspace access.
-- This is the immutable audit record of that signature.
--
-- Distinct from the `ndas` table (which is PITCH-scoped: an evaluator requesting
-- access to a creator's pitch). This is COMPANY-scoped (a creator signing a
-- company's NDA), one signature per (team, signer), covering all that company's
-- projects. See docs/sessions/2026-06-05-collaboration-nda-scope.md.
--
-- Additive only. Workspace access gating is enforced in the handlers
-- (resolveWorkspace + hasSignedCompanyNda); this table is the source of truth.

CREATE TABLE IF NOT EXISTS company_nda_signatures (
  id              SERIAL PRIMARY KEY,
  team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  signer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'signed'
                    CHECK (status IN ('signed', 'revoked')),
  nda_version     TEXT NOT NULL,            -- template revision agreed to
  signed_name     TEXT NOT NULL,            -- typed full legal name
  signed_address  TEXT,                     -- address-at-signing (formality)
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT,
  signature_data  JSONB,                    -- {agreed:true, renderedHash, ...}
  document_url    TEXT,                     -- generated countersigned PDF (R2)
  revoked_at      TIMESTAMPTZ,
  UNIQUE (team_id, signer_id)
);

-- Fast gate lookup: "has signer X signed for a team owned by producer Y".
CREATE INDEX IF NOT EXISTS idx_company_nda_signatures_signer
  ON company_nda_signatures (signer_id, status);
CREATE INDEX IF NOT EXISTS idx_company_nda_signatures_team
  ON company_nda_signatures (team_id, status);
