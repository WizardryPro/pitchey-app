-- Human-readable pitch URLs: /pitch/the-last-frontier instead of /pitch/213.
-- Adds a unique `slug` column, backfills existing pitches from their titles, and
-- installs a BEFORE INSERT/UPDATE trigger so every new/renamed pitch gets a slug
-- automatically (no app-path change to the thinly-tested create/update handlers).
-- The public getPitch handler resolves a slug OR a numeric id, so old /pitch/213
-- links keep working.

ALTER TABLE pitches ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill: slugify(title), dedupe collisions with a -N suffix (ordered by id so
-- the oldest pitch keeps the clean slug). Empty/garbage titles fall back to
-- pitch-<id>, which is always unique.
WITH base AS (
  SELECT id,
         NULLIF(trim(both '-' FROM lower(regexp_replace(COALESCE(title, ''), '[^a-zA-Z0-9]+', '-', 'g'))), '') AS s
  FROM pitches
  WHERE slug IS NULL
),
ranked AS (
  SELECT id, s, row_number() OVER (PARTITION BY s ORDER BY id) AS rn
  FROM base
)
UPDATE pitches p
SET slug = CASE
             WHEN r.s IS NULL   THEN 'pitch-' || p.id
             WHEN r.rn = 1      THEN left(r.s, 80)
             ELSE left(r.s, 80) || '-' || r.rn
           END
FROM ranked r
WHERE p.id = r.id AND p.slug IS NULL;

-- Enforce uniqueness (partial: NULL slugs are allowed transiently before the
-- trigger fills them, and never collide).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pitches_slug ON pitches(slug) WHERE slug IS NOT NULL;

-- Auto-slug trigger. Fires BEFORE INSERT (NEW.id is already assigned from the
-- SERIAL default at this point) and BEFORE UPDATE when the title changes or the
-- slug is still empty. On a collision it appends the pitch id, which is always
-- unique — no loop, concurrency-safe. Clean titles (the common case) keep a clean
-- slug; only genuine title collisions get an id suffix.
CREATE OR REPLACE FUNCTION pitches_set_slug() RETURNS trigger AS $$
DECLARE
  base text;
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.slug IS NULL THEN
    base := trim(both '-' FROM lower(regexp_replace(COALESCE(NEW.title, ''), '[^a-zA-Z0-9]+', '-', 'g')));
    IF base IS NULL OR base = '' THEN
      base := 'pitch';
    END IF;
    base := left(base, 80);
    NEW.slug := base;
    IF EXISTS (SELECT 1 FROM pitches WHERE slug = NEW.slug AND id <> NEW.id) THEN
      NEW.slug := base || '-' || NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pitches_set_slug ON pitches;
CREATE TRIGGER trg_pitches_set_slug
  BEFORE INSERT OR UPDATE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION pitches_set_slug();
