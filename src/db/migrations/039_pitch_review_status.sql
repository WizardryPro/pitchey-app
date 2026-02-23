-- Migration 039: Add review status to saved_pitches for production submission workflow
-- Production companies save pitches and track their review status independently

BEGIN;

ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'saved';
ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS review_rating INTEGER CHECK (review_rating >= 1 AND review_rating <= 5);
ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Index for efficient status-based queries
CREATE INDEX IF NOT EXISTS idx_saved_pitches_review_status ON saved_pitches(user_id, review_status);

COMMIT;
