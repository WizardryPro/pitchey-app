-- Migration 040: Production Pitch Data
-- Persists production notes, checklists, and team assignments that were previously stored in localStorage
-- These are per-pitch, per-production-user records

-- Production notes (casting, location, budget, schedule, team, general)
CREATE TABLE IF NOT EXISTS production_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'general'
    CHECK (category IN ('casting', 'location', 'budget', 'schedule', 'team', 'general')),
  author VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_notes_user_pitch ON production_notes(user_id, pitch_id);

-- Production checklist (per pitch, per user)
CREATE TABLE IF NOT EXISTS production_checklists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pitch_id)
);

-- Production team assignments (per pitch, per user)
CREATE TABLE IF NOT EXISTS production_team_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  team JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pitch_id)
);
