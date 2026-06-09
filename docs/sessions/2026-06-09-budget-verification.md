# Numeric USD budget — runtime verification (2026-06-09)

Verified the round-2 budget path (PR #228) end-to-end against **production** using a
throwaway pitch (id 2551, alex.creator/1025), read-only SQL on prod Neon
(`patient-surf-83998605`), and direct authenticated API calls. Two real bugs surfaced;
fixed in **PR #230** (`fix/budget-clear-and-normalize`).

## Results

| # | Step | Current prod (worker `2e6bf5ff`) | Verdict |
|---|------|----------------------------------|---------|
| 1 | CREATE budget `50,000,000` | DB `estimated_budget_usd=50000000`, `estimated_budget="50000000"` | ✅ pass |
| 2 | EDIT `50M → 75M` | DB updates to 75000000 | ✅ pass |
| 3 | **CLEAR (send `null`)** | set 60M → clear → **still 60000000** | ❌ **BUG** |
| 4 | CAP `2,000,000,000` | clamped to `1000000000`, HTTP 200 (DB CHECK never hit) | ✅ pass |
| 5 | **JUNK `"£400K"`** | **mangled to `400`** | ❌ **BUG** |
| 6 | MARKETPLACE Avg Budget | averages `estimated_budget_usd` over pitches that have one (code-verified; renders compact via `formatBudgetCompact`) | ✅ pass |
| 7 | LEGACY free-text coexist | rows with only legacy `estimated_budget` (e.g. "£400K") keep their text, contribute 0 to avg, display unaffected | ✅ pass |

## The two bugs (root cause)

**Bug 1 — budget can't be cleared.** `updatePitch` used
`estimated_budget_usd = COALESCE($34, estimated_budget_usd)`. PitchEdit sent `undefined`
on an empty field (JSON drops the key), the handler turned absent → `null`, and
`COALESCE(null, old)` **preserves**. So once set, a budget could never be removed.

*Fix:* PitchEdit always sends the key (`number | null`). `updatePitch` is presence-aware:
`estimated_budget_usd = CASE WHEN $35 THEN $34 ELSE estimated_budget_usd END`, where
`$35 = 'estimatedBudgetUsd' in data`. Explicit `null` clears; an absent key (other
callers) still preserves.

**Bug 2 — junk strings mangled.** `normalizeBudgetUsd("£400K")` stripped non-digits →
`"400"` → **$400**. Silent, wrong.

*Fix:* reject any string containing a letter or dash (k/m/b suffix, range, currency word)
→ `null`. Plain numbers (with separators/decimal/currency symbol) still parse
(`"€14,000"` → 14000).

## The COALESCE-null question (explicit answer)

**Yes — clearing was impossible on the deployed code**, confirmed at runtime (step 3). The
COALESCE meant any `null` (whether from an omitted key or an explicit null) preserved the
prior value. Fixed via the presence flag (`$35`) so the column is only touched when the
client actually sends the field.

## Reported, not changed (minimal-fix discipline)

- **`budgetRange` still sent from PitchEdit** — the visible Budget input was repointed to the
  numeric field in round 2, so `budgetRange` is no longer user-editable there. It round-trips
  its loaded value through `COALESCE` on update = a no-op preserve, **not a clobber**. Safe to
  drop from the payload later; left for now.
- **CreatePitch valibot `EstimatedBudgetSchema`** still types budget as a `maxLength(100)`
  string. The numeric input only ever emits digit strings, so this is permissive-but-safe;
  the real enforcement is `normalizeBudgetUsd` + the DB CHECK. Left as-is.

## Post-deploy re-verification — ✅ CONFIRMED (worker `a17e5de4`, frontend `index-DHryHLuS.js`)

Re-ran the two failing cases on prod (pitch 2551, then deleted it):
- **Clear**: set 60,000,000 → send `null` → DB `estimated_budget_usd` = **NULL**. ✅ (was: stayed 60M)
- **Junk**: set 80,000,000 → send `"£400K"` → DB = **NULL** (rejected, not 400). ✅ (was: 400)

Note: junk-via-API now resolves to `null` (rejected) and, because the field was *present* in
the payload, that clears the column rather than preserving it. This only matters for direct API
calls — the UI input emits digits only — and reject→null is strictly better than mangling to a
wrong number. Acceptable.

Throwaway pitch 2551 deleted (HTTP 204, confirmed absent in DB). Budget path is safe to retest.

## Karl-facing summary

The numeric USD budget field works for create, edit, the $1B cap, and the marketplace
average. Two issues were found and fixed before retest: **a budget couldn't be cleared once
set**, and **non-numeric text like "£400K" was silently turned into $400**. With PR #230 live,
the field is safe to retest — set, change, clear, and over-cap all behave correctly.

> Cleanup: throwaway verification pitch **2551** ("BUDGET VERIFY TEST (delete me)") to be
> deleted after the post-deploy re-check.
