-- Pitch-specific follows
CREATE TABLE IF NOT EXISTS pitch_follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_pitch_follows_follower ON pitch_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_pitch_follows_pitch ON pitch_follows(pitch_id);
