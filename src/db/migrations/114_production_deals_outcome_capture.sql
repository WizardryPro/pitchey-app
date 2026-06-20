-- 114_production_deals_outcome_capture.sql
--
-- Phase 1 of the disintermediation-defense roadmap (deal system-of-record).
-- Make Pitchey the record of the deal *even when money moves off-platform*.
--
-- The `production_deals` state machine is LIVE (#6, migration 111) but the
-- `investment_deal_state` enum's terminal states (`completed`/`cancelled`) only
-- say a deal ended — not HOW. A film deal that closes off-platform looks identical
-- to one that closed on-platform, and a dead deal looks like a cancelled one. That
-- blind spot is exactly the disintermediation leak: we capture the high-value intro
-- and keep no record of the outcome.
--
-- This migration adds OUTCOME-CAPTURE columns (NOT new states — the enum already has
-- completed/cancelled; marking an outcome moves the deal to one of those existing
-- terminal states). Both sides can mark an outcome; bilateral confirmation flags
-- feed the Phase 2 reputation loop (mutually-confirmed outcomes only).
--
-- All additive + idempotent (CREATE TYPE guarded, ADD COLUMN IF NOT EXISTS).

-- Outcome classification: how the deal actually ended.
DO $$ BEGIN
  CREATE TYPE deal_outcome AS ENUM ('closed_on_platform', 'closed_off_platform', 'dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE production_deals
  -- How the deal ended (NULL = no outcome recorded yet).
  ADD COLUMN IF NOT EXISTS outcome deal_outcome,
  -- Reported final figures (free-form text terms + numeric amount), distinct from
  -- the proposed option_amount/purchase_price — this is what the parties say the
  -- deal actually closed at, even if transacted off-platform.
  ADD COLUMN IF NOT EXISTS outcome_amount numeric,
  ADD COLUMN IF NOT EXISTS outcome_terms text,
  -- The real close date (when the deal closed), distinct from state_changed_at
  -- (when it was recorded in Pitchey).
  ADD COLUMN IF NOT EXISTS closed_at timestamp without time zone,
  -- Provenance of the outcome record.
  ADD COLUMN IF NOT EXISTS outcome_reported_by integer,
  ADD COLUMN IF NOT EXISTS outcome_reported_at timestamp without time zone,
  -- Bilateral confirmation. Phase 2 credits reputation ONLY when both are true.
  ADD COLUMN IF NOT EXISTS outcome_confirmed_by_creator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome_confirmed_by_production boolean NOT NULL DEFAULT false;

-- Index the outcome so the reputation cron / analytics can scan confirmed closes
-- without a full table sweep. Partial: only rows that have an outcome.
CREATE INDEX IF NOT EXISTS idx_production_deals_outcome
  ON production_deals (outcome)
  WHERE outcome IS NOT NULL;
