-- 110_creator_identity_verification.sql
-- Creator identity verification via Stripe Identity (anti-impersonation "real
-- person" check). Verifies the PERSON — complements pitch_provenance, which seals
-- the IDEA. On a 'verified' result the creator's verification_tier is promoted to
-- 'silver' (we never downgrade a 'gold').
--
-- Result is read via retrieve-on-return (the stored session id), NOT a webhook —
-- so this requires ZERO change to the live Stripe webhook config and cannot
-- disturb subscription billing. Additive columns only.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS identity_session_id   TEXT,       -- Stripe vs_… id of the latest session
  ADD COLUMN IF NOT EXISTS identity_status       TEXT,       -- requires_input | processing | verified | canceled
  ADD COLUMN IF NOT EXISTS identity_verified_at  TIMESTAMPTZ;

-- Look up a user by their in-flight session on return.
CREATE INDEX IF NOT EXISTS idx_users_identity_session
  ON users (identity_session_id) WHERE identity_session_id IS NOT NULL;
