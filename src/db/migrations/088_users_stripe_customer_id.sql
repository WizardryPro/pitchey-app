-- 088_users_stripe_customer_id.sql
--
-- Add stripe_customer_id to users. Populated by the checkout.session.completed
-- webhook handler (worker-integrated.ts) and used by the new
-- POST /api/payments/billing-portal endpoint to open Stripe's hosted Customer
-- Portal (card updates, invoice downloads, cancel, billing email).
--
-- Nullable: existing users (and watchers who never subscribe) have no Stripe
-- customer. Populated lazily — either via webhook on first checkout, or via
-- the billing-portal endpoint's getOrCreateCustomer fallback for any pre-088
-- user who somehow already has a sub.
--
-- Partial index: most users will be null while the platform is small; only
-- index the populated rows to keep the index lean and lookup-on-customer_id
-- fast for the inverse direction (Stripe Dashboard → user lookup) if we
-- ever need it.

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
