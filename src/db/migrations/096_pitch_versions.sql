-- Pitch content snapshots — powers "progress from feedback" (Phase 4B / WS-5).
--
-- A row is written on each pitch UPDATE (src/worker-integrated.ts updatePitch),
-- capturing the content + score at that moment. With this history we can show a
-- reviewer that a pitch was edited AFTER their feedback, and how its score moved
-- since then (baseline = snapshot at/just-before the feedback timestamp).
--
-- Pitches still update in-place; this is an append-only audit alongside, not a
-- replacement. No backfill — deltas accrue from the first edit after deploy.

CREATE TABLE IF NOT EXISTS pitch_versions (
  id               BIGSERIAL PRIMARY KEY,
  pitch_id         INTEGER NOT NULL,
  title            TEXT,
  logline          TEXT,
  short_synopsis   TEXT,
  long_synopsis    TEXT,
  rating_average   NUMERIC,
  rating_count     INTEGER,
  pitchey_score_avg NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "latest snapshot at/before T" and "edits since T" both scan by (pitch, time).
CREATE INDEX IF NOT EXISTS idx_pitch_versions_pitch_created
  ON pitch_versions (pitch_id, created_at DESC);
