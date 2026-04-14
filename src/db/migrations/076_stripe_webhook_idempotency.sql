-- 076_stripe_webhook_idempotency.sql
--
-- Idempotency table for the Stripe webhook handler.
--
-- Stripe retries webhook deliveries on any non-2xx response for up to 3 days,
-- and Cloudflare Workers can process the same event in parallel across edge
-- locations. Without distributed deduplication, we would double-flip user
-- types, double-grant credits, and double-insert subscription history rows.
--
-- The webhook handler INSERTs into this table FIRST, keyed by Stripe event.id.
-- ON CONFLICT DO NOTHING makes that write serve as a distributed lock — only
-- the first invocation gets a non-empty RETURNING clause and proceeds; any
-- concurrent or retried invocation short-circuits with a 200.
--
-- `received_at` is retained so we can purge old rows (Stripe only retries
-- for 3 days, so anything > 7 days old is safe to drop).

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swe_received_at
  ON stripe_webhook_events(received_at);
