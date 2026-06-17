-- 107_saved_searches_revive.sql
-- Revive the Saved Searches feature (#308 revive candidate). The saved_searches
-- table (migration 021) and the SavedSearches.tsx UI already existed but the
-- backend contract was never reconciled. This reconciles the schema to what the
-- live handlers now persist + adds the execution counter powering the anonymized
-- community-"trending" Popular list.
--
-- Self-contained + idempotent: CREATE TABLE IF NOT EXISTS guarantees the table,
-- then ADD COLUMN IF NOT EXISTS for EVERY column the handlers touch — so this is
-- safe whether or not migration 021 fully applied / left a partial table (the
-- exact drift class that bit migration 081).

CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query TEXT,
  filters JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS query TEXT,
  ADD COLUMN IF NOT EXISTS filters JSONB,
  ADD COLUMN IF NOT EXISTS description TEXT,
  -- Only public saved searches feed the anonymized community-trending list.
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  -- notify_on_results (frontend) maps to alert_enabled; alerts are stored-only for now.
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_frequency VARCHAR(50) NOT NULL DEFAULT 'never',
  -- Bumped on POST /api/search/saved/:id/execute; powers use_count + trending rank.
  ADD COLUMN IF NOT EXISTS execution_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches (user_id);
-- Trending reads the most-executed public searches; index the hot path.
CREATE INDEX IF NOT EXISTS idx_saved_searches_public_trending
  ON saved_searches (execution_count DESC)
  WHERE is_public = TRUE;
