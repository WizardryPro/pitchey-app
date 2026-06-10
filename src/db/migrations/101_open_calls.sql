-- Opportunities board (Phase 1): production/investor "open calls" (mandates).
-- A demand-side sibling to the pitch catalog — companies post what they're
-- seeking, creators browse and (Phase 2) submit pitches against a call.

CREATE TABLE IF NOT EXISTS open_calls (
  id              SERIAL PRIMARY KEY,
  poster_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poster_type     VARCHAR(20) NOT NULL CHECK (poster_type IN ('production', 'investor')),
  title           VARCHAR(160) NOT NULL,
  mandate         TEXT NOT NULL DEFAULT '',
  seeking_genres  TEXT,                      -- comma-separated genre labels
  seeking_formats TEXT,                      -- comma-separated format labels
  budget_min_usd  BIGINT CHECK (budget_min_usd IS NULL OR (budget_min_usd >= 0 AND budget_min_usd <= 1000000000)),
  budget_max_usd  BIGINT CHECK (budget_max_usd IS NULL OR (budget_max_usd >= 0 AND budget_max_usd <= 1000000000)),
  region          VARCHAR(120),
  status          VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  slots           INTEGER CHECK (slots IS NULL OR slots >= 0),
  deadline        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_open_calls_status_created ON open_calls (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_calls_poster ON open_calls (poster_user_id);
