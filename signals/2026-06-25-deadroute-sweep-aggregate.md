---
id: sig-2026-06-25-011
date: 2026-06-25
severity: low
source: dead-route-sweep
status: confirmed
---

**Finding:** Of 97 handler/route/worker-module files scanned, **17 are orphans** — never
imported into `src/worker-integrated.ts` (the hand-rolled live router) and referenced
nowhere else in `src/`. A separate read-only `Explore` verifier confirmed all 17 unwired:
**15 confirmed dead code**, **2 needs-human** (a REVIVE cluster + one ambiguous). Several
orphans are written in frameworks that can't even run in the Worker (Express `Router`,
Deno/Oak, standalone Hono apps).

**Scan:** `node .claude/skills/audit-dead-routes/find-orphans.mjs` — 97 scanned, 17
candidates, 15 confirmed orphan, 2 needs-human. PROTECTED paths (#60/#61) excluded by the
finder. Detection model: a file unimported by the live worker is dead, regardless of how
complete it looks (CLAUDE.md orphan test).

## Confirmed orphans (dead code — 15)

Each verified unwired by the Explore verifier (read file + greped `worker-integrated.ts`
for module path + every export). These are a candidate **single human-gated batch-deletion
prompt** — NOT auto-deleted by this read-only loop.

| File | Evidence |
|---|---|
| src/handlers/advanced-search.ts | worker-integrated.ts:245/2709 comment "not imported — using SearchFiltersHandler instead" |
| src/handlers/intelligence.ts | worker-integrated.ts:384 comment "future feature, not imported" |
| src/handlers/mobile-auth.ts | exports mobileLogin/… ; no `/api/mobile/*` registered; no import in src |
| src/handlers/nda-rbac.ts | exports NDAWithRBACHandler; zero hits in worker-integrated.ts; live NDA uses handlers/nda |
| src/routes/ab-testing.routes.ts | Express Router (won't run in Worker); `/ws/ab-testing` is a separate built-in method |
| src/routes/admin.routes.ts | Deno/Oak Router (`deno.land` imports); worker uses AdminEndpointsHandler |
| src/routes/api-versions.ts | exports getVersionInfo/… ; no registration, no import |
| src/routes/cache-management.routes.ts | exports handleCacheRoutes; zero hits; no `/api/cache/*` registered |
| src/routes/cache-monitoring.routes.ts | exports handleCacheStats/Metrics; no import/registration |
| src/routes/enhanced-upload.routes.ts | Hono router; worker uses services/enhanced-upload-r2 instead |
| src/routes/feature-flags.routes.ts | Hono router; flags served via built-in abTestingHandler, not this file |
| src/routes/investor-portal.ts | Hono factory createInvestorPortalRoutes; `/api/investor/*` served by built-in methods |
| src/routes/notification.routes.ts | Hono router; notifications served by built-in handleNotificationRoute |
| src/routes/search.routes.ts | exports handlePitchSearch/… ; search served by SearchFiltersHandler |
| src/routes/twilio-webhook.routes.ts | Hono router for Twilio SMS; no import/mount → cannot receive callbacks |

## needs-human

Verified unwired, but NOT recorded as confirmed-dead — each needs a human verdict before
any deletion. The `signals-to-prompts` bridge mines these into `action: investigate` prompts.

### gdpr-handler-revive
- **source_item:** `sig-2026-06-25-011#gdpr-handler-revive`
- **file:** `src/handlers/gdpr-handler.ts` (exports a Hono `gdpr` router; live GDPR routes
  like `/api/gdpr/metrics` are served by `handlers/admin-real` instead, so this file IS
  unwired).
- **open question:** the orphan catalog (#308) marks **GDPR a REVIVE cluster**, not a delete
  target — GDPR/data-export is a compliance obligation. Is this file abandoned dead code, or
  the intended home for a GDPR feature to be revived? Decide before any deletion.

### documentation-ambiguous
- **source_item:** `sig-2026-06-25-011#documentation-ambiguous`
- **file:** `src/routes/documentation.ts` (OpenAPI/docs routes; referenced only in a
  `security-fix.ts` comment, never imported; no `/api/docs|openapi` registered).
- **open question:** verifier flagged `medium`/ambiguous — was this deliberately-parked API
  documentation scaffolding (revive) or abandoned (delete)? Confirm intent before acting.

**Verifier verdict:** real finding (17/17 confirmed unwired; 15 dead, 2 needs-human) — the
"imported nowhere in src/" finder is conservative (errs live), and the verifier independently
read `worker-integrated.ts` per candidate, so the confirmed-15 set is high-confidence dead.

## Timeline
- 2026-06-25 — first run: 97 scanned, 17 orphans (15 dead / 2 needs-human).
- 2026-06-26 — nightly run: 96 scanned (−1 live file removed from codebase), same 17 orphans persist unchanged; separate Explore verifier re-confirmed all 17 still-orphan (last committed 2026-06-16, no modifications). No new candidates, no fixes.
- 2026-06-27 — **RESOLVED**: all 17 orphans deleted. Commit 497b47f deleted 15 confirmed-dead (PR #376, 6759 LOC); commit 9554307 deleted 2 needs-human gdpr-handler + documentation (PR #377, 1039 LOC). Finder now reports 81 scanned, 0 candidates; Explore verifier confirmed 6-file sample all wired. Batch-deletion batch complete (#308).
