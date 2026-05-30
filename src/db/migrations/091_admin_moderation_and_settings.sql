-- 091_admin_moderation_and_settings.sql
-- Backs the admin panel's previously-mock features with real storage:
--   1. pitch moderation state (approve / reject / flag) — pitches had only the
--      publish lifecycle (draft/published/active), no moderation dimension.
--   2. platform_settings — single-row JSON blob so /admin/settings can persist.
--
-- All additive + idempotent (IF NOT EXISTS). Safe to re-run.

-- 1. Pitch moderation columns ------------------------------------------------
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id);
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Index for the content-moderation list filter by moderation_status.
CREATE INDEX IF NOT EXISTS idx_pitches_moderation_status ON pitches(moderation_status);

-- 2. Platform settings (single-row JSON blob) --------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);
