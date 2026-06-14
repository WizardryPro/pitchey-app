-- 105_nda_requests_backfill_to_ndas.sql
--
-- Bug #284: the live NDA request path used to write pending requests into
-- `nda_requests`, but approveNDA + the getPitch access-gate only ever read
-- `ndas`. Real (non-demo) pending requests were therefore orphaned and could
-- never be approved. The handler is now fixed to write to `ndas` directly.
--
-- Two parts:
--   1) Make `ndas.signed_at` nullable. Previously it was NOT NULL DEFAULT now(),
--      which was fine when `ndas` only ever held SIGNED rows. Now that the table
--      also holds PENDING requests, an unsigned row must have signed_at = NULL —
--      otherwise getSignedNDAs (`WHERE n.signed_at IS NOT NULL`) would report
--      pending requests as signed. The default is kept (harmless: the live
--      insert passes signed_at explicitly).
--   2) Promote any still-pending `nda_requests` rows into `ndas` so existing
--      (already-charged) requesters aren't stranded. Idempotent: only copies
--      rows with no corresponding `ndas` row, ON CONFLICT DO NOTHING. Duplicate
--      requests for the same (pitch_id, requester_id) — an artifact of the old
--      wrong-table dedup — collapse to a single row via the unique constraint.

ALTER TABLE ndas ALTER COLUMN signed_at DROP NOT NULL;

INSERT INTO ndas (signer_id, pitch_id, status, nda_type, access_granted, signed_at, approved_at, created_at, updated_at)
SELECT
  nr.requester_id                        AS signer_id,
  nr.pitch_id,
  'pending'                              AS status,
  COALESCE(nr.nda_type, 'basic')::nda_type AS nda_type,
  false                                  AS access_granted,
  NULL                                   AS signed_at,
  NULL                                   AS approved_at,
  COALESCE(nr.created_at, NOW())         AS created_at,
  NOW()                                  AS updated_at
FROM nda_requests nr
WHERE nr.status = 'pending'
  AND nr.requester_id IS NOT NULL
  AND nr.pitch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ndas n
    WHERE n.pitch_id = nr.pitch_id
      AND n.signer_id = nr.requester_id
  )
ON CONFLICT (pitch_id, signer_id) DO NOTHING;
