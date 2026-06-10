-- Opportunities board (Phase 2): creators submit a pitch against an open call.
-- A submission is the workflow object the poster (production/investor) acts on
-- — shortlist / decline / accept.

CREATE TABLE IF NOT EXISTS call_submissions (
  id              SERIAL PRIMARY KEY,
  call_id         INTEGER NOT NULL REFERENCES open_calls(id) ON DELETE CASCADE,
  pitch_id        INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  creator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         TEXT NOT NULL DEFAULT '',
  status          VARCHAR(12) NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'shortlisted', 'declined', 'accepted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (call_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_call_submissions_call ON call_submissions (call_id, status);
CREATE INDEX IF NOT EXISTS idx_call_submissions_creator ON call_submissions (creator_user_id);
