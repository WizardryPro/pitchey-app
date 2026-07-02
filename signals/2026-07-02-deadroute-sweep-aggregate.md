---
id: sig-2026-07-02-001
date: 2026-07-02
severity: medium
source: dead-route-sweep
status: confirmed
---

**Finding:** Nightly re-scan confirms all 8 previously-confirmed orphans persist; 2 needs-human
items unchanged. Two commits since last run (#411 Stripe/notification fix, #412 slug URLs) added
no new handler/route/worker-module files and made no wiring changes to any of the 10 tracked
files. `find-orphans.mjs` still reports 0 candidates due to known false-negative bugs
(documented in sig-2026-06-29-001).

**Scan:** `node .claude/skills/audit-dead-routes/find-orphans.mjs` — **84 scanned** (unchanged),
**0 candidates reported by script** (false negatives persist), **8 confirmed orphans**, **2
needs-human**. Separate Explore verifier checked all 10 files plus new-commit impact. PROTECTED
paths (#60/#61) excluded.

**Recent commits (no impact):**
- `3dcf67c` feat(pitches): slug URLs (#412) — adds `src/db/migrations/118_pitch_slugs.sql` and
  modifies `worker-integrated.ts` (slug resolution only); no new handler/route/worker-module
  files; no wiring changes to any tracked file.
- `3156539` fix: Stripe webhook/notification/provenance (#411) — adds 2 test files under
  `src/services/__tests__/`; no new handler/route/worker-module files; no wiring changes to
  any tracked file.

**Confirmed orphans (8 — all re-confirmed):**

- `src/handlers/messaging.ts` — `MessagingHandlers` class has 0 imports across all of `src/`;
  live path uses `handlers/messaging-simple.ts` (11 separate dynamic imports in
  `worker-integrated.ts`).
- `src/handlers/pitches.ts` — `pitchesHandler`, `trendingPitchesHandler`, `newPitchesHandler`
  referenced nowhere in `src/`; equivalent functionality is an inline private method in
  `worker-integrated.ts` (~line 12590).
- `src/routes/creator.ts` — only reference is commented-out import at `worker-integrated.ts:359`
  (`// import { creatorRoutes } from './routes/creator'`); endpoints duplicated as private
  methods inside the monolith.
- `src/routes/email-messaging.routes.ts` — import commented out at `worker-integrated.ts:367`;
  instantiation also commented out at line 844; `EmailMessagingRoutes` / `EmailMessagingEnv`
  referenced nowhere else in `src/`.
- `src/routes/investor.ts` — only reference is commented-out import at `worker-integrated.ts:360`
  (`// import { investorRoutes } from './routes/investor'`); endpoints duplicated as private
  methods inside the monolith.
- `src/routes/pitches.ts` — only reference is commented-out import at `worker-integrated.ts:362`
  (`// import { pitchesRoutes } from './routes/pitches'`); live route `/api/pitches/public`
  served by inline `getPublicPitches` method registered at line 4013.
- `src/routes/production.ts` — only reference is commented-out import at `worker-integrated.ts:361`
  (`// import { productionRoutes } from './routes/production'`); endpoints duplicated as private
  methods inside the monolith.
- `src/routes/users.ts` — only reference is commented-out import at `worker-integrated.ts:363`
  (`// import { usersRoutes } from './routes/users'`); live user endpoints served via
  `routes/user-profile.ts` + inline methods.

**Verifier verdict:** confirmed — separate Explore verifier read each file's exports, grepped
`worker-integrated.ts` for module paths and all export names (active imports only, not
commented-out), and confirmed zero active wiring for all 8 files. No barrel/aggregator mounting
found. New commits #411/#412 verified to have no impact on any tracked file.

## needs-human

- **#contracts-revive** — `src/handlers/contracts.ts`: `ContractHandlers` class (createContract,
  listContracts, getContract, sendForSignature, signContract, generatePDF, terminateContract,
  listTemplates, createTemplate, amendContract, getVersions, bulkSendContracts) has 0 active
  imports anywhere in `src/` (verifier confirms technically orphaned). Orphan-catalog override
  applies: belongs to the contracts/REVIVE cluster (#308). Open question: is `contracts.ts`
  earmarked for a contracts-workflow revival, or safe to include in the batch-deletion prompt
  alongside the 8 confirmed orphans?

- **#ndas-routes-intent** — `src/routes/ndas.ts`: import commented out at
  `worker-integrated.ts:364` (`// import { ndasRoutes } from './routes/ndas'`). Live NDA
  functionality fully served by `handlers/nda.ts` (active import at line 50) + inline private
  methods in `worker-integrated.ts` (registered at lines 2433–2457, casing differs:
  `this.requestNDA` vs `requestNda` in the routes file). Verifier confirms technically
  orphaned. Open question: is `ndas.ts` a planned refactor-in-progress or permanently
  superseded by the inline NDA handling?

## Timeline
- 2026-06-25 — first manual run: 97 scanned, 17 candidates, 15 confirmed dead, 2 needs-human.
- 2026-06-27 — nightly: 97 scanned, 2 confirmed, 2 needs-human (script bug reduced candidates).
- 2026-06-29 — nightly: 84 scanned (script refinement), 8 confirmed, 2 needs-human; script
  false-negative bugs documented.
- 2026-06-30 — nightly: 84 scanned (unchanged), 8 confirmed, 2 needs-human; no new files.
- 2026-07-01 — nightly: 84 scanned (unchanged), 8 confirmed, 2 needs-human; PR #407 files
  (investor-thesis.ts + thesis-matching.ts) verified false positives (properly wired).
- 2026-07-02 — nightly: 84 scanned (unchanged), 8 confirmed, 2 needs-human; commits #411/#412
  verified no impact on any tracked file; contracts.ts technically confirmed orphan but
  REVIVE-override keeps it needs-human.
