---
id: sig-2026-07-01-001
date: 2026-07-01
severity: medium
source: dead-route-sweep
status: confirmed
---

**Finding:** Nightly re-scan confirms all 8 previously-confirmed orphans persist; 2 needs-human
items unchanged; 2 newly-modified handler files (PR #407 investor-thesis.ts + thesis-matching.ts)
are false positives (properly wired). `find-orphans.mjs` still reports 0 candidates due to known
bugs (see sig-2026-06-29-001) — verifier check remains essential.

**Scan:** `node .claude/skills/audit-dead-routes/find-orphans.mjs` — 84 scanned (unchanged from
prior run), **0 candidates reported by script** (false negatives, same two bugs as
sig-2026-06-29-001). Separate Explore verifier checked 12 files: 8 Group A (re-verify prior
confirmed orphans), 2 Group B (re-verify prior needs-human), 2 Group C (files modified since
2026-06-30 in recent commits). PROTECTED paths (#60/#61) excluded.

**New files — Group C (both false positives, properly wired):**

- `src/handlers/investor-thesis.ts` — dynamically imported in `worker-integrated.ts` at ~line
  3637 with three active route registrations: `GET /api/investor/thesis` (line 3636),
  `GET /api/public/thesis/:id` (line 3643), `PUT /api/investor/thesis` (line 3647). Added/wired
  in PR #407. ✅ Live.
- `src/handlers/thesis-matching.ts` — dynamically imported in `worker-integrated.ts` at ~line
  3653/3657 with two active route registrations: `GET /api/investor/thesis/matches` (line 3652),
  `GET /api/pitches/:id/matching-investors` (line 3656). Added/wired in PR #407. ✅ Live.

**Persistent confirmed orphans (8 — all re-confirmed, full evidence in sig-2026-06-29-001):**

- `src/handlers/messaging.ts` — `MessagingHandlers` class never imported anywhere in `src/`;
  shadowed by `messaging-simple.ts` (live, dynamically imported).
- `src/handlers/pitches.ts` — `pitchesHandler`/`trendingPitchesHandler`/`newPitchesHandler`
  never imported in `worker-integrated.ts`; replaced by specialised handlers.
- `src/routes/creator.ts` — only reference is commented-out import at
  `worker-integrated.ts:359`; endpoints duplicated as private methods inside the monolith.
- `src/routes/email-messaging.routes.ts` — only reference is commented-out at
  `worker-integrated.ts:367`; `EmailMessagingRoutes` class never instantiated.
- `src/routes/investor.ts` — only reference is commented-out at `worker-integrated.ts:360`;
  endpoints duplicated as private methods inside the monolith.
- `src/routes/pitches.ts` — commented-out import at `worker-integrated.ts:362`; stem collision
  with `db/queries/pitches` hides it from the script.
- `src/routes/production.ts` — only reference is commented-out at `worker-integrated.ts:361`;
  endpoints duplicated as private methods inside the monolith.
- `src/routes/users.ts` — only reference is commented-out at `worker-integrated.ts:363`; live
  user endpoints served via `routes/user-profile.ts` + `auth-adapter.ts`.

**Verifier verdict:** confirmed — separate Explore verifier read each file's exports, grepped
`worker-integrated.ts` for module paths and all export names, and found zero active
(non-commented) imports or registrations for all 8 Group A files. No barrel/aggregator mounting
found. Both Group C files confirmed live with specific line numbers.

## needs-human

- **#contracts-revive** — `src/handlers/contracts.ts`: `ContractHandlers` class exports a
  complete contract-management API surface (createContract, listContracts, getContract,
  sendForSignature, signContract, generatePDF, terminateContract, listTemplates, createTemplate,
  amendContract, getVersions, bulkSendContracts) but is never imported in `worker-integrated.ts`
  (no commented or active reference). `ContractService` in `src/services/` IS actively
  maintained. This handler belongs to the contracts/REVIVE cluster (#308). Open question:
  is `contracts.ts` earmarked for a contracts-workflow revival (#60-adjacent), or is it safe
  to include in the batch-deletion prompt alongside the 8 confirmed orphans?

- **#ndas-routes-intent** — `src/routes/ndas.ts`: import commented out at
  `worker-integrated.ts:364`. The NDA feature is live via `src/handlers/nda.ts` (dynamically
  imported at line ~50) with a different implementation path. This file provides RouteHandler
  versions (`requestNda`, `respondToNdaRequest`, `getUserNdaRequests`, `getNdaById`,
  `getNdaStats`, `checkNdaStatus`) that may be a planned refactor or permanently superseded.
  Open question: is `ndas.ts` scheduled for integration, or permanently superseded by the
  inline NDA handling?

## Timeline
- 2026-07-01 — nightly run: 84 scanned (unchanged from 2026-06-30), 8 persistent confirmed
  orphans (all re-confirmed by separate verifier), 2 needs-human unchanged, 2 modified files
  (PR #407: investor-thesis.ts + thesis-matching.ts) both false positives (properly wired).
  Script still 0 candidates (known bugs from sig-2026-06-29-001).
