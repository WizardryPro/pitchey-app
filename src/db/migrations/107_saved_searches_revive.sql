-- 107_saved_searches_revive.sql
-- Revive the Saved Searches feature (#308 revive candidate).
--
-- IMPORTANT: the LIVE saved_searches table was created by migration 012 with
-- columns search_query JSONB ({"query":"..."}), search_filters JSONB,
-- notification_enabled BOOLEAN. Migration 021 re-declared it with
-- query/filters/alert_enabled, but that CREATE TABLE IF NOT EXISTS was a silent
-- no-op (012 already made the table) — those columns DO NOT exist in prod.
-- This migration extends the REAL table; it must not target the 021 phantom columns.
--
-- Adds: description + is_public (anonymized community-trending feeds off public
-- searches), alert_frequency (deferred alerts), execution_count + last_executed_at
-- (powers use_count + trending rank). Idempotent.

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_frequency VARCHAR(50) NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS execution_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP;

-- Trending reads the most-executed public searches; index the hot path.
CREATE INDEX IF NOT EXISTS idx_saved_searches_public_trending
  ON saved_searches (execution_count DESC)
  WHERE is_public = TRUE;
