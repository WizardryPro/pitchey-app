-- Add shared flag to production_notes so producers can share feedback with creators
ALTER TABLE production_notes ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient lookups of shared notes by pitch
CREATE INDEX IF NOT EXISTS idx_production_notes_shared ON production_notes (pitch_id, shared) WHERE shared = true;
