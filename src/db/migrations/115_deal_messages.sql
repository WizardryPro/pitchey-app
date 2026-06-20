-- 115_deal_messages.sql
--
-- Phase 3 of the disintermediation-defense roadmap — structured negotiation thread.
--
-- Today the back-and-forth on a deal is a text-blob appended to
-- `production_deals.notes` (see creator-deals.ts respond: `notes || '[Creator
-- counter]: …'`). It has no structure (who/when/how-much), can't be threaded, and
-- the moment a real negotiation starts the parties move to email — taking the deal
-- (and the relationship) off-platform. That's a disintermediation leak.
--
-- A deal-scoped thread keeps the negotiation ON Pitchey: each entry records who
-- sent it, when, an optional free-form message, and an optional structured
-- terms-delta (proposed amount / terms). It is NON-binding — the deal state machine
-- (accept/counter/reject, mark-outcome) still owns status + standing terms; the
-- thread is the conversation around it.
--
-- Additive + idempotent. ON DELETE CASCADE so a deleted deal takes its thread.

CREATE TABLE IF NOT EXISTS deal_messages (
  id          SERIAL PRIMARY KEY,
  deal_id     INTEGER NOT NULL REFERENCES production_deals(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL,
  -- denormalised from the deal at write time so the thread renders without a join
  sender_role VARCHAR(16) NOT NULL CHECK (sender_role IN ('creator', 'production')),
  -- 'message' = free-form; 'counter' = carries a structured proposed terms-delta
  kind        VARCHAR(16) NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'counter')),
  body            TEXT,
  proposed_amount NUMERIC,
  proposed_terms  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_messages_deal ON deal_messages (deal_id, created_at);
