-- Migration 072: Slate System
-- Curated collections of related pitches

CREATE TABLE IF NOT EXISTS slates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  cover_image TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slates_user ON slates(user_id);
CREATE INDEX IF NOT EXISTS idx_slates_user_status ON slates(user_id, status);

CREATE TABLE IF NOT EXISTS slate_pitches (
  id SERIAL PRIMARY KEY,
  slate_id INTEGER NOT NULL REFERENCES slates(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slate_id, pitch_id)
);

CREATE INDEX IF NOT EXISTS idx_sp_slate ON slate_pitches(slate_id);
CREATE INDEX IF NOT EXISTS idx_sp_pitch ON slate_pitches(pitch_id);
