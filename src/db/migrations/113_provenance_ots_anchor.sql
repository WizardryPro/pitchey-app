-- 113_provenance_ots_anchor.sql
-- OpenTimestamps anchor for pitch provenance (Phase 2 of the IP-theft evidence work).
--
-- The DB `sealed_at` timestamp is on a clock WE control — in a dispute the other side
-- argues we backdated it. OpenTimestamps fixes that: at seal we submit the content
-- hash to public OTS calendars, which fold it into a Bitcoin transaction. The
-- resulting .ots proof shows the hash existed before a Bitcoin block — a timestamp
-- nobody (not even us) can forge or backdate.
--
-- Proof lifecycle: PENDING (submitted, awaiting Bitcoin confirmation, still valid
-- evidence — the anchor is fixed at submit) -> COMPLETE (Bitcoin attestation merged
-- in, ots_upgraded_at + ots_block_height set). We store the .ots as base64 TEXT to
-- avoid bytea binding quirks with the Neon serverless client.

ALTER TABLE pitch_provenance
  ADD COLUMN IF NOT EXISTS ots_proof        TEXT,         -- base64-encoded .ots file
  ADD COLUMN IF NOT EXISTS ots_calendars    TEXT,         -- comma-separated calendars that accepted it
  ADD COLUMN IF NOT EXISTS ots_submitted_at TIMESTAMPTZ,  -- when the digest was submitted
  ADD COLUMN IF NOT EXISTS ots_upgraded_at  TIMESTAMPTZ,  -- when a Bitcoin attestation was confirmed
  ADD COLUMN IF NOT EXISTS ots_block_height INTEGER;      -- Bitcoin block height (once complete)

-- Lets the lazy-upgrade path cheaply find proofs still awaiting Bitcoin confirmation.
CREATE INDEX IF NOT EXISTS pitch_provenance_ots_pending_idx
  ON pitch_provenance (ots_submitted_at)
  WHERE ots_proof IS NOT NULL AND ots_upgraded_at IS NULL;
