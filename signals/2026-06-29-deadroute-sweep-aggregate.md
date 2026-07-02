---
id: sig-2026-06-29-001
date: 2026-06-29
severity: medium
source: dead-route-sweep
status: confirmed
---

**Finding:** Script bug caused false-negative clean state — 10 orphaned files masked by
`find-orphans.mjs` (commented-import matching + cross-directory stem collision). Separate
Explore verifier confirmed all 10 unwired: 8 confirmed orphan, 2 needs-human.

**Scan:** `node .claude/skills/audit-dead-routes/find-orphans.mjs` — 82 scanned, **0
candidates reported by script** (false negatives). Verifier independently found 10 orphans
the script missed. PROTECTED paths (#60/#61) excluded.

**Script flaws (find-orphans.mjs — two bugs causing false negatives):**

1. **No comment filtering** — the script reads raw file contents including `//` comments
   and matches the import regex against them. Commented-out imports in
   `worker-integrated.ts` (e.g., `// import { pitchesRoutes } from './routes/pitches';`
   at lines ~359–364) count as valid references, hiding 7 route files.

2. **No directory disambiguation** — the stem-based regex
   `[^'"]*\b${stem}['"]` matches any import path ending in that stem, regardless of
   directory. `src/handlers/pitches.ts` (stem `pitches`) is falsely "referenced" because
   `src/db/queries/pitches.ts` has active imports using the same stem. Similar collision
   for `src/handlers/messaging.ts` and potentially others.

**Confirmed-orphan list (8 files):**

- `src/handlers/messaging.ts` — no uncommented import found anywhere in `src/`; stem
  collision means the script sees a false reference.
- `src/handlers/pitches.ts` — stem "pitches" falsely matched against
  `from './db/queries/pitches'` (a DB module, not this handler); zero actual handler
  imports in `worker-integrated.ts`.
- `src/routes/creator.ts` — only reference is commented-out:
  `// import { ... } from './routes/creator';` (~line 359 of `worker-integrated.ts`).
- `src/routes/email-messaging.routes.ts` — only reference is a commented-out import in
  `worker-integrated.ts`; no live wiring.
- `src/routes/investor.ts` — only reference is commented-out (~line 360); zero active
  imports.
- `src/routes/pitches.ts` — double false-negative: commented-out import AND stem
  collision with `db/queries/pitches`; zero active wiring.
- `src/routes/production.ts` — only reference is a commented-out import in
  `worker-integrated.ts`; no live wiring.
- `src/routes/users.ts` — only reference is commented-out (~line 363); zero active
  imports.

**Verifier verdict:** real finding (confirmed) — separate Explore verifier read each file's
exports, grepped `worker-integrated.ts` for module paths and export names, and confirmed
zero live references for all 8 files. Script flaws traced and reproduced by the verifier.

## needs-human

- **#contracts-revive** — `src/handlers/contracts.ts`: verifier confirmed no imports in
  `src/`; however this file belongs to the contracts REVIVE cluster (orphan catalog #308
  — GDPR/contracts). Open question: is this file earmarked for the contracts workflow
  revival (#60-adjacent), or is it safe to batch-delete alongside the 8 confirmed orphans?
  A human familiar with #308 should decide before deletion.

- **#ndas-routes-intent** — `src/routes/ndas.ts`: commented-out import in
  `worker-integrated.ts` (~line 364); NDA routes are a core business feature and the
  commenting-out may have been intentional during a routing migration rather than a
  permanent removal. Open question: were these NDA routes permanently retired (moving
  to the inline `worker-integrated.ts` NDA handlers) or should they be revived?

## Timeline
- 2026-06-29 — first detection: verifier exposed 10 orphans hidden by script bugs (8
  confirmed, 2 needs-human). The sig-2026-06-27-001 "clean state" was a false negative
  caused by these same bugs. Recommend fixing `find-orphans.mjs` before next run:
  (a) strip `//` comment lines before regex matching; (b) anchor stems to their source
  directory path to prevent cross-directory collisions.
- 2026-06-30 — re-confirmed: all 8 confirmed orphans still unwired; 2 needs-human
  unchanged. 2 new handler files entered the universe (admin-credits.ts PR #401,
  creator-reputation-admin.ts PR #405) — both false positives (properly wired). See
  sig-2026-06-30-001.
