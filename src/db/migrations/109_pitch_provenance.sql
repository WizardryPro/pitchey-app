-- 109_pitch_provenance.sql
-- Content-hash provenance ("Sealed on [date]"): a tamper-evident timestamp proving
-- a pitch's substantive content existed on Pitchey at a given date. This is the
-- creator's priority-of-idea artifact — it protects the IDEA (not the person; that
-- is the separate verification_tier track).
--
-- One row per (pitch, distinct content_hash). Re-publishing identical content is a
-- no-op (unique gate); changed content adds a new version row, so history is kept.
-- `prev_hash` chains each new seal to the creator's previous seal → tamper-evident
-- (you can't backdate or insert a seal without breaking the chain). The verify
-- endpoint exposes ONLY the hash + date + creator + title, never protected content.

CREATE TABLE IF NOT EXISTS pitch_provenance (
  id              SERIAL PRIMARY KEY,
  pitch_id        INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  creator_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_hash    TEXT NOT NULL,                 -- SHA-256 hex of canonical content
  algorithm       TEXT NOT NULL DEFAULT 'sha256',
  content_version INTEGER NOT NULL DEFAULT 1,    -- 1-based, per pitch
  prev_hash       TEXT,                          -- creator's previous seal hash (chain)
  sealed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- content_hash already encodes pitch_id + creator_id, so a single global unique
-- index both (a) dedups identical re-seals (ON CONFLICT DO NOTHING) and (b) backs
-- the public verify-by-hash lookup.
CREATE UNIQUE INDEX IF NOT EXISTS pitch_provenance_hash_uniq
  ON pitch_provenance (content_hash);

-- "Sealed since" badge reads the earliest seal per pitch.
CREATE INDEX IF NOT EXISTS pitch_provenance_pitch_sealed_idx
  ON pitch_provenance (pitch_id, sealed_at);

-- Per-creator chain walk.
CREATE INDEX IF NOT EXISTS pitch_provenance_creator_sealed_idx
  ON pitch_provenance (creator_id, sealed_at DESC);
