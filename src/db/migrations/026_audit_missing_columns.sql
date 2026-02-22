-- =============================================================================
-- Migration: 026_audit_missing_columns.sql
-- Date: 2026-02-22
-- Author: Database audit — February 2026 codebase review
--
-- Context:
--   During the February 2026 codebase audit, several columns were found to be
--   referenced in application queries and handler code but were never present
--   in the database schema. These missing columns caused silent query failures
--   and incorrect NULL-coalescing in API responses. This migration adds each
--   column using IF NOT EXISTS so it is safe to re-run on environments where
--   some columns may already exist.
--
-- Changes:
--   1. pitches.budget_range        — referenced in saved-pitches query joins
--                                    but absent from the original CREATE TABLE
--   2. investments.equity_percentage — used in portfolio analytics aggregations
--                                     but missing from investments DDL
--   3. users.verified               — expected by profile display logic and
--                                     investor trust-badge rendering
--   4. saved_pitches.tags           — used to filter/categorise saved pitches
--                                    in the investor watchlist view
--   5. saved_pitches.created_at     — needed for "saved on" display and
--                                    chronological sorting in saved lists
--
-- Rollback:
--   ALTER TABLE pitches          DROP COLUMN IF EXISTS budget_range;
--   ALTER TABLE investments      DROP COLUMN IF EXISTS equity_percentage;
--   ALTER TABLE users            DROP COLUMN IF EXISTS verified;
--   ALTER TABLE saved_pitches    DROP COLUMN IF EXISTS tags;
--   ALTER TABLE saved_pitches    DROP COLUMN IF EXISTS created_at;
-- =============================================================================

BEGIN;

-- Fix 1: Add budget_range to pitches (referenced in saved-pitches queries but never created)
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS budget_range VARCHAR(100);

-- Fix 2: Add equity_percentage to investments if missing
ALTER TABLE investments ADD COLUMN IF NOT EXISTS equity_percentage DECIMAL(5, 2);

-- Fix 3: Add verified column to users (boolean, defaults to false)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Fix 4: Ensure tags and created_at exist on saved_pitches
ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMIT;
