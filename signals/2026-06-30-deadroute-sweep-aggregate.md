---
id: sig-2026-06-30-001
date: 2026-06-30
severity: medium
source: dead-route-sweep
status: confirmed
---

**Finding:** Nightly re-scan confirms all 8 previously-confirmed orphans persist; 2 needs-human
items unchanged; 2 newly-added handler files (PRs #401/#405) are properly wired (false
positives). `find-orphans.mjs` still reports 0 candidates due to known bugs (see
sig-2026-06-29-001) — verifier check remains essential.

**Scan:** `node .claude/skills/audit-dead-routes/find-orphans.mjs` — 84 scanned (up from 82;
+2 new files from PRs #401/#405), **0 candidates reported by script** (false negatives, same
two bugs as 2026-06-29). Separate Explore verifier checked 12 files: 8 Group A (re-verify
prior confirmed orphans), 2 Group B (re-verify prior needs-human), 2 Group C (new files).
PROTECTED paths (#60/#61) excluded.

**New files — Group C (both false positives, properly wired):**

- `src/handlers/admin-credits.ts` — dynamically imported in `worker-integrated.ts` (~line
  3906): registers `POST /api/admin/credits/grant` and `POST /api/admin/credits/revoke`;
  `/api/admin/credits` is in the AdminEndpointsHandler exclusion list so both endpoints
  reach the handler. Added in PR #401. ✅ Live.
- `src/handlers/creator-reputation-admin.ts` — dynamically imported in `worker-integrated.ts`
  (~line 3893): registers `POST /api/admin/reputation/recompute`; `/api/admin/reputation` is
  in the AdminEndpointsHandler exclusion list. Added in PR #405. ✅ Live.

**Persistent confirmed orphans (8 — all re-confirmed, full evidence in sig-2026-06-29-001):**

- `src/handlers/messaging.ts` — shadowed by `messaging-simple.ts` (live, 11 dynamic
  imports); `MessagingHandlers` class never instantiated anywhere in `src/`.
- `src/handlers/pitches.ts` — `pitchesHandler`/`trendingPitchesHandler`/`newPitchesHandler`
  never imported in `worker-integrated.ts`; replaced by specialised handlers.
- `src/routes/creator.ts` — only reference is commented-out import at
  `worker-integrated.ts:359`; endpoints duplicated as private methods inside the monolith.
- `src/routes/email-messaging.routes.ts` — only reference is commented-out at
  `worker-integrated.ts:367`; `EmailMessagingRoutes` class never instantiated.
- `src/routes/investor.ts` — only reference is commented-out at
  `worker-integrated.ts:360`; endpoints duplicated as private methods inside the monolith.
- `src/routes/pitches.ts` — commented-out import at `worker-integrated.ts:362`; stem
  collision with `db/queries/pitches` hides it from the script.
- `src/routes/production.ts` — only reference is commented-out at
  `worker-integrated.ts:361`; endpoints duplicated as private methods inside the monolith.
- `src/routes/users.ts` — only reference is commented-out at `worker-integrated.ts:363`;
  live user endpoints served via `routes/user-profile.ts` + `auth-adapter.ts`.

**Verifier verdict:** confirmed — separate Explore verifier read each file's exports, grepped
`worker-integrated.ts` for module paths and all export names, and found zero active
(non-commented) imports or registrations for all 8. No barrel/aggregator mounting found.

## needs-human

- **#contracts-revive** — `src/handlers/contracts.ts`: `ContractHandlers` class exports a
  complete contract-management API surface but is never imported in `worker-integrated.ts`
  (no commented or active reference). `ContractService` in `src/services/` IS actively
  maintained. This handler belongs to the contracts/REVIVE cluster (#308). Open question:
  is `contracts.ts` earmarked for a contracts-workflow revival (#60-adjacent), or is it safe
  to include in the batch-deletion prompt alongside the 8 confirmed orphans?

- **#ndas-routes-intent** — `src/routes/ndas.ts`: import commented out at
  `worker-integrated.ts:364`. The NDA feature is live via internal methods inside
  `worker-integrated.ts` (different implementation path). This file may be a planned
  refactor (newer API shape awaiting integration) or a legacy duplicate superseded by the
  inline implementation. Open question: is `ndas.ts` scheduled for integration, or
  permanently superseded by the inline NDA handling?

## Timeline
- 2026-06-30 — nightly run: 84 scanned (+2 from prior run), 8 persistent confirmed orphans
  (all re-confirmed live by separate verifier), 2 needs-human unchanged, 2 new files both
  false positives (properly wired in PRs #401/#405). Script still 0 candidates (known bugs).
