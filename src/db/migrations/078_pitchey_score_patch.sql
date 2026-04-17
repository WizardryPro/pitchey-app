-- Migration 078: Pitchey Score patch — backfill missing prerequisites for migration 075
--
-- Production drift: migrations 003 (rating_average), 018 (pitch_feedback), and most of 075
-- were never applied to the prod DB. This migration is a consolidated, idempotent patch
-- that adds only what the Pitchey Score code path needs to function.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / ON CONFLICT.
--
-- Rollback: everything here is additive, so rollback is a no-op by default — the new
-- columns hold 0 / NULL when rating code paths go unused. Hard rollback (only if absolutely
-- necessary, e.g. column type conflict with a future canonical migration):
--   DROP TABLE IF EXISTS pitch_ratings_anonymous;
--   DROP TABLE IF EXISTS pitch_feedback;
--   ALTER TABLE pitches DROP COLUMN IF EXISTS viewer_score_avg;
--   ALTER TABLE pitches DROP COLUMN IF EXISTS pitchey_score_avg;
--   ALTER TABLE pitches DROP COLUMN IF EXISTS rating_count;
--   ALTER TABLE pitches DROP COLUMN IF EXISTS rating_average;
--   DELETE FROM heat_role_weights WHERE role IN ('anonymous', 'watcher');
-- (heat_role_weights deletions are lossy if other systems depend on those roles later.)

BEGIN;

-- 1. Add rating columns to pitches (would have come from mig 003 + 075)
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS rating_average  DECIMAL(4,2) DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS rating_count    INTEGER       DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS pitchey_score_avg DECIMAL(4,2) DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS viewer_score_avg  DECIMAL(4,2) DEFAULT 0;

-- 2. pitch_feedback table (originally mig 018, with mig 075's 1-10 rating + reviewer_weight)
CREATE TABLE IF NOT EXISTS pitch_feedback (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_type VARCHAR(50),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  reviewer_weight DECIMAL(4,2) DEFAULT 1.0,
  strengths TEXT[],
  weaknesses TEXT[],
  suggestions TEXT[],
  overall_feedback TEXT,
  is_interested BOOLEAN DEFAULT FALSE,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pitch_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_pitch_feedback_pitch ON pitch_feedback(pitch_id, created_at DESC);

-- 3. Anonymous ratings table (mig 075 step 6)
CREATE TABLE IF NOT EXISTS pitch_ratings_anonymous (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  ip_hash VARCHAR(64) NOT NULL,
  reviewer_weight DECIMAL(4,2) NOT NULL DEFAULT 0.25,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pitch_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_pitch_ratings_anon_pitch ON pitch_ratings_anonymous(pitch_id);

-- 4. Heat role weights for anonymous + watcher (mig 075 step 7)
INSERT INTO heat_role_weights (role, weight) VALUES
  ('anonymous', 0.25),
  ('watcher', 0.5)
ON CONFLICT (role) DO UPDATE SET weight = EXCLUDED.weight;

COMMIT;
