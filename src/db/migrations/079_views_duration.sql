-- Migration 079: add view_duration to `views` table for consumption gate
--
-- The Pitchey Score consumption gate needs to read SUM(view_duration) for a viewer.
-- trackViewHandler writes to `views` (not `pitch_views`), which never had a duration
-- column, so the gate was stuck at 0 regardless of how long users actually watched.
--
-- Additive + idempotent. Rollback: ALTER TABLE views DROP COLUMN IF EXISTS view_duration;

ALTER TABLE views ADD COLUMN IF NOT EXISTS view_duration INTEGER NOT NULL DEFAULT 0;
