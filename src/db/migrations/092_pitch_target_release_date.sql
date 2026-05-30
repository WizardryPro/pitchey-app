-- 092_pitch_target_release_date.sql
-- Adds the only column missing for the production-standard pitch field set.
-- The other production-wizard fields (estimated_budget, budget_bracket,
-- production_timeline, visibility_settings, long_synopsis, target_audience, comps)
-- already exist on `pitches`; createPitch/updatePitch are being wired to populate them.
-- Stored as TEXT (not DATE) to match the loose, empty-string-tolerant convention
-- used by sibling columns like estimated_budget, and to avoid cast errors on '' input.

ALTER TABLE pitches
  ADD COLUMN IF NOT EXISTS target_release_date TEXT;
