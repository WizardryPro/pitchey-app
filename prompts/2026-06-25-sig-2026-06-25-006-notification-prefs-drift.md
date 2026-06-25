---
id: prompt-2026-06-25-006
date: 2026-06-25
source_signal: sig-2026-06-25-006
signal_status: confirmed
band: 1
gates: recommended
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Reconcile NotificationPreferences type drift (9× TS2339) in `src/services/notification.service.ts`

### Context
`type-lint-audit` confirmed 9× `TS2339` in `src/services/notification.service.ts` (lines 933-978): the `NotificationPreferences` type is missing properties the code reads — `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`, `timezone`, `ndaNotifications`, `investmentNotifications`, `pitchUpdateNotifications`. Reached on a live path via `notification-integration.service.ts` → `worker-integrated.ts:149/798`. Signal `sig-2026-06-25-006`.

### Fix (read first — this touches a shared type)
1. Find the `NotificationPreferences` type definition and the underlying table/columns it maps.
2. Decide per property whether the **type is stale** (DB has the column → add the field to the type) or the **code uses a wrong name** (`TS2551` hints: `ndaNotifications`→`emailNotifications`?, `investmentNotifications`→`smsNotifications`?). Reconcile against the actual schema — do not blindly add all 7 fields if some are renamed reads.
3. ⚠️ Cross-check `reference_notifications_broken` lessons before widening: the notifications path has known drift. Verify the columns exist in prod (or are intended) before adding type fields that imply DB reads.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
