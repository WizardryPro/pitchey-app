---
id: sig-2026-06-27-001
date: 2026-06-27
severity: low
source: dead-route-sweep
status: confirmed
---

**Finding:** Clean sweep — 81 handler/route/worker-module files scanned, **0 orphan
candidates**. All 17 orphans from sig-2026-06-25-011 have been batch-deleted (commits
497b47f + 9554307, PRs #376 + #377, 7798 LOC removed total). No new orphans introduced.

**Scan:** `node .claude/skills/audit-dead-routes/find-orphans.mjs` — 81 scanned, 0
candidates, 0 confirmed orphan, 0 needs-human. PROTECTED paths (#60/#61) excluded.

**Resolution of sig-2026-06-25-011:**
- Commit `497b47f` (PR #376, 2026-06-26): deleted 15 confirmed-dead files (6759 LOC)
- Commit `9554307` (PR #377, 2026-06-27): deleted 2 needs-human files — gdpr-handler +
  documentation (1039 LOC)
- Net: 17 files / 7798 LOC removed from `src/handlers/` and `src/routes/`

**Verifier verdict:** real finding (confirmed) — separate Explore verifier confirmed:
(a) all 17 previously-known orphan files are absent from disk; (b) 6 sampled files from
the current universe (handler/route/worker-module, ≥2 per dir) are confirmed imported in
`worker-integrated.ts` at their respective line numbers; (c) git log shows the two deletion
commits with correct file counts. No false negatives detected in sampling.

## needs-human

(none this run)

## Timeline
- 2026-06-27 — first run at this clean state: 81 scanned, 0 candidates; prior 17 orphans
  confirmed deleted (PRs #376/#377). Baseline reset.
