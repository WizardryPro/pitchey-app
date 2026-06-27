-- 117_deal_signatures.sql
--
-- P5.0 (deal-servicing roadmap): promote the deal-sheet from a rendered VIEW
-- (getProductionContract) into a BINDING, hash-sealed, co-signed instrument.
--
-- This is the cheapest real on-platform lock-in: no payments, no Stripe Connect,
-- no take-rate, no PCI surface. A co-signed, content-hash-sealed deal sheet that
-- lives on Pitchey is a reason for both parties to transact on-platform rather
-- than just record (P1) that they transacted elsewhere.
--
-- Reuses the proven primitives:
--   * the Standard-NDA click-to-sign engine (signNDA) — typed name + agree + audit
--   * the provenance SHA-256 seal (sha256Hex / crypto.subtle) — content_hash pins
--     EXACTLY the deal terms a party agreed to, so a later mutation is detectable.
--
-- Keyed to the LIVE `production_deals` spine — NOT the orphan `contract_signatures`
-- schema (migration 004, never wired). Additive only.
--
-- One signature per (deal, signer). `party` records which side signed so the
-- "fully executed" check is "both creator AND production have a row". `content_hash`
-- is the seal of the canonical deal sheet at the moment of signing; the read path
-- compares it to the live sheet's hash to surface tampering (a term changed after
-- one party signed).

CREATE TABLE IF NOT EXISTS deal_signatures (
  id              SERIAL PRIMARY KEY,
  deal_id         INTEGER NOT NULL REFERENCES production_deals(id) ON DELETE CASCADE,
  signer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party           VARCHAR(20) NOT NULL CHECK (party IN ('creator', 'production')),
  status          VARCHAR(20) NOT NULL DEFAULT 'signed'
                    CHECK (status IN ('signed', 'revoked')),
  content_hash    VARCHAR(64) NOT NULL,      -- sha256 of the canonical deal sheet at signing
  algorithm       VARCHAR(20) NOT NULL DEFAULT 'sha256',
  signed_name     TEXT NOT NULL,             -- typed full legal name
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT,
  signature_data  JSONB,                     -- {agreed:true, title, ...} — the click-to-sign payload
  revoked_at      TIMESTAMPTZ,
  UNIQUE (deal_id, signer_id)
);

-- Fast "is this deal fully executed / who has signed" lookup.
CREATE INDEX IF NOT EXISTS idx_deal_signatures_deal
  ON deal_signatures (deal_id, status);
