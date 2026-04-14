-- Migration 077: Backfill NULL followed_at on follows table
--
-- Some legacy follow rows (from INSERT paths that pre-date the followed_at
-- column or that explicitly skipped it) have NULL followed_at. The UI formats
-- that as "Invalid Date". Copy created_at into followed_at for those rows so
-- the Following page renders a real date. Also set DEFAULT NOW() so future
-- inserts that omit the column always get a value.

UPDATE follows
SET followed_at = created_at
WHERE followed_at IS NULL
  AND created_at IS NOT NULL;

ALTER TABLE follows
  ALTER COLUMN followed_at SET DEFAULT NOW();
