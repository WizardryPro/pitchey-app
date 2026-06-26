-- 116_investor_thesis.sql
--
-- Structured investment thesis for investors — one row per investor (1:1 with users).
--
-- Replaces the prior free-text `users.bio`-as-thesis hack with a proper structured
-- record so investor intent is queryable/matchable (genre/format/stage/deal-type/
-- territory/theme preferences + budget & check-size ranges + a prose positioning).
--
-- Vocabulary discipline: genres/formats/stages/deal_types/territories/themes are stored
-- as native TEXT[] arrays — NOT comma-separated strings and NOT opaque JSONB (both are
-- existing drift patterns we are deliberately avoiding). The canonical genre/format/
-- stage/deal-type vocabularies are validated app-side (the same lists used across the
-- pitch + open-call surfaces); the DB stores plain text tokens.
--
-- `investor_id` is the PRIMARY KEY, which both enforces the 1:1 uniqueness and enables
-- an `ON CONFLICT (investor_id)` upsert in the handler.
--
-- A GIN index on `genres` supports future investor↔pitch matching (array containment).
--
-- The backfill seeds `positioning` from the existing `users.bio` for current investors
-- so no prose is lost in the cutover from bio-as-thesis.

CREATE TABLE IF NOT EXISTS investor_thesis (
  investor_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  genres             TEXT[]  NOT NULL DEFAULT '{}',
  formats            TEXT[]  NOT NULL DEFAULT '{}',
  stages             TEXT[]  NOT NULL DEFAULT '{}',
  deal_types         TEXT[]  NOT NULL DEFAULT '{}',
  territories        TEXT[]  NOT NULL DEFAULT '{}',
  themes             TEXT[]  NOT NULL DEFAULT '{}',
  budget_min_usd     BIGINT,
  budget_max_usd     BIGINT,
  check_size_min_usd BIGINT,
  check_size_max_usd BIGINT,
  positioning        TEXT    NOT NULL DEFAULT '',
  is_public          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_thesis_genres
  ON investor_thesis USING GIN (genres);

-- Backfill: preserve existing free-text bios as the thesis positioning prose.
INSERT INTO investor_thesis (investor_id, positioning)
SELECT id, bio FROM users
WHERE user_type = 'investor' AND bio IS NOT NULL AND btrim(bio) <> ''
ON CONFLICT (investor_id) DO NOTHING;
