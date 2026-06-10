-- Compare Phase 3: saved & shareable comparisons.
-- A user can save a comparison (subject type + the ids) and share it via a token
-- (read-only public view). No metric snapshot is stored — the share view always
-- recomputes live from current data.

CREATE TABLE IF NOT EXISTS saved_comparisons (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(160) NOT NULL DEFAULT 'Comparison',
  subject_type VARCHAR(12) NOT NULL CHECK (subject_type IN ('creator', 'pitch', 'slate')),
  subject_ids  TEXT NOT NULL,                 -- comma-separated subject ids
  share_token  VARCHAR(64) NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_comparisons_user ON saved_comparisons (user_id, created_at DESC);
