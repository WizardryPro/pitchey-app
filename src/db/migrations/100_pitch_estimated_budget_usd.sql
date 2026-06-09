-- 100_pitch_estimated_budget_usd.sql
-- Karl round-2 (P4): give budget a real numeric home.
--
-- `pitches.estimated_budget` is a free-text TEXT column (held values like
-- "12000000", "20000000k", "€14,000", and a 36-digit joke). That can't be
-- compared, capped, or averaged. Add a structured USD integer column instead,
-- bounded to 0..$1,000,000,000 at the DB level, and best-effort backfill the
-- unambiguous numeric rows. The free-text column is kept for legacy display /
-- non-USD/range values that don't convert.

ALTER TABLE pitches
  ADD COLUMN IF NOT EXISTS estimated_budget_usd BIGINT;

-- Hard cap + non-negative, enforced regardless of the app layer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pitches_estimated_budget_usd_range'
  ) THEN
    ALTER TABLE pitches
      ADD CONSTRAINT pitches_estimated_budget_usd_range
      CHECK (estimated_budget_usd IS NULL
             OR (estimated_budget_usd >= 0 AND estimated_budget_usd <= 1000000000));
  END IF;
END $$;

-- Best-effort backfill: only rows whose free text is an UNAMBIGUOUS plain number
-- ≤ $1B. Excludes anything with a letter (k/m/b suffix ambiguity), a range
-- separator, or more than 10 digits (the 36-digit "ton of 000s" joke). Lossy by
-- design — unconverted rows keep their text in estimated_budget and stay NULL here.
UPDATE pitches
SET estimated_budget_usd = CAST(regexp_replace(estimated_budget, '[^0-9]', '', 'g') AS BIGINT)
WHERE estimated_budget_usd IS NULL
  AND estimated_budget IS NOT NULL
  AND estimated_budget !~ '[A-Za-z]'
  AND estimated_budget !~ '[-–—]'
  AND regexp_replace(estimated_budget, '[^0-9]', '', 'g') ~ '^[0-9]{1,10}$'
  AND CAST(regexp_replace(estimated_budget, '[^0-9]', '', 'g') AS BIGINT) BETWEEN 0 AND 1000000000;
