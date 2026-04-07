-- Portfolio Share Links
-- Token-based shareable portfolio URLs for creators

CREATE TABLE IF NOT EXISTS portfolio_share_links (
  id SERIAL PRIMARY KEY,
  token VARCHAR(36) NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  label VARCHAR(100),
  view_count INTEGER DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psl_token ON portfolio_share_links(token);
CREATE INDEX IF NOT EXISTS idx_psl_creator ON portfolio_share_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_psl_active ON portfolio_share_links(creator_id) WHERE revoked_at IS NULL;
