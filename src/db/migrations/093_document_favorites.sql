-- 093_document_favorites.sql
-- Surfaced via Cloudflare Observability 2026-05-30: GET /api/legal/library and the
-- favorite/unfavorite endpoints logged `relation "document_favorites" does not exist`
-- (10 hits/week). The handlers (worker-integrated.ts ~17109/17262/17271) query + toggle
-- this table but no migration ever created it, so the legal-library favorites feature
-- was broken (the handler falls back to a no-favorites query after logging the error).
--
-- Types: generated_documents.id is UUID, users.id is INTEGER.
-- is_favorite supports the library read (`COALESCE(df.is_favorite, false)`); the toggle
-- code uses row presence/absence, so a row implies favorited (default true).

CREATE TABLE IF NOT EXISTS document_favorites (
  id            SERIAL PRIMARY KEY,
  document_id   UUID NOT NULL,
  user_id       INTEGER NOT NULL,
  is_favorite   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_favorites_user ON document_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_document_favorites_document ON document_favorites(document_id);
