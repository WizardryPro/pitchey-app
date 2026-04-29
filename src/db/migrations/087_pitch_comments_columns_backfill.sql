-- Schema drift fix surfaced 2026-04-29 via Cloudflare observability:
-- "getPitchComments error: column pc.user_type does not exist"
--
-- Migration 075_pitchey_score.sql defines pitch_comments with id/pitch_id/user_id/
-- user_type/content/ip_hash/created_at/updated_at. Prod's pitch_comments is missing
-- user_type and ip_hash but has an extra parent_id column from some earlier
-- migration not in tree. 075's CREATE TABLE IF NOT EXISTS was a silent no-op against
-- the pre-existing table.
--
-- Same drift mechanism as migration 086 (this session) and migration 081 (Apr 22).
-- Same fix: ADD COLUMN IF NOT EXISTS for the canonical columns.
--
-- handlers/pitch-feedback.ts:773 selects pc.user_type — this is what was failing.

ALTER TABLE pitch_comments ADD COLUMN IF NOT EXISTS user_type VARCHAR(50);
ALTER TABLE pitch_comments ADD COLUMN IF NOT EXISTS ip_hash   VARCHAR(64);
