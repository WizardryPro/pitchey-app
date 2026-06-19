-- 112_slate_share_links.sql
--
-- Tokenized, tracked share links for slates (moat #5). Today the public slate URL
-- is `/slates/s/{id}` — a raw, guessable, untracked id. This adds per-share tokens
-- with view tracking + revocation, mirroring the proven `portfolio_share_links`
-- design, so creators get a real outbound distribution surface with feedback.
--
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS slate_share_links (
  id              SERIAL PRIMARY KEY,
  token           VARCHAR(36) NOT NULL UNIQUE,
  slate_id        INTEGER NOT NULL,
  creator_id      INTEGER NOT NULL,
  label           VARCHAR(100),
  view_count      INTEGER DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssl_token ON slate_share_links(token);
CREATE INDEX IF NOT EXISTS idx_ssl_slate ON slate_share_links(slate_id);
CREATE INDEX IF NOT EXISTS idx_ssl_creator ON slate_share_links(creator_id);
