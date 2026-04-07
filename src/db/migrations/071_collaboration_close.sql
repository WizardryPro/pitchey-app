-- Migration 071: Add close support to collaborations
-- Production companies can close a collaboration with a creator.
-- NDA remains intact — closing only affects the collaboration record.

ALTER TABLE collaborations
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by INTEGER;

-- Allow 'closed' as a valid status (existing CHECK constraint is permissive — status is VARCHAR(50))
-- Update the count queries to distinguish closed from completed.
