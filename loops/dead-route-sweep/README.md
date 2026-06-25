# Loop contract — `dead-route-sweep`

A read-only audit loop sharing the same `signals/` brain as
[`type-lint-audit`](../type-lint-audit/README.md). It sweeps for **orphaned handler/route
files** — the Era 0–6 parallel-handler-tree problem this repo has repeatedly deleted by
hand. Read-only: it *reports* orphans, it never deletes them.

## Pitchey's orphan model (this is NOT file-based routing)

The live request path is rooted at `src/worker-integrated.ts`, which registers every API
route by hand (`this.register('METHOD','/api/path', handler)`) and imports its handlers
statically or via `await import(...)`. There is **no file-based routing**. So:

> A handler/route file under `src/handlers`, `src/routes`, or `src/worker-modules` that is
> **never imported into `worker-integrated.ts`** (statically or dynamically) and whose
> exported names are referenced nowhere else in `src/` is **dead code** — no matter how
> complete it looks. The repo's own CLAUDE.md test: `grep -rn "<HandlerName>"
> src/worker-integrated.ts` → zero hits = orphaned.

This is the inverse of a Fresh-style "no caller calls this registered route" sweep.

## Goal

Periodically find unwired handler/route files, verify each against barrels/route-mounts
and the live registry, and record the genuinely-dead ones as `dead-route-sweep` signals —
so orphaned code surfaces continuously instead of via occasional manual audits.

## Workflow (each run)

1. Read the last ~10 entries of `/work-log.md` (shared brain).
2. Read this contract and `STACK.md`.
3. Invoke the **`audit-dead-routes`** skill:
   - run `find-orphans.mjs` (read-only) to build candidates,
   - dedup against existing `signals/`,
   - spawn a **separate read-only `Explore` verifier** that reads each file and greps
     `worker-integrated.ts` (+ any route-aggregator) to rule out indirect wiring,
   - the main session writes the aggregate signal (with a needs-human sub-list).
4. Append one line to `/work-log.md`.
5. Prove inertness: `git status` shows only `signals/**` + `work-log.md`.
6. Persist to the **shared** `audit-signals` branch/PR.

## Boundaries — READ-ONLY to source (must NEVER do)

- ❌ Delete, edit, or format any handler/route/source file. **This loop reports; it never
  deletes.** A confirmed orphan becomes a *separate, human-gated* batch-deletion prompt.
- ❌ Open or update any **source-changing** PR.
- ❌ Run migrations or any DB write; call any mutating endpoint.
- ❌ Write to the auto-memory (read-only for context).
- ❌ Let the candidate-finder confirm its own candidates (verifier must be separate).
- ❌ Flag PROTECTED parked paths (#60 `src/workflows/`, #61 crawl4ai/console-analysis) —
  `find-orphans.mjs` already excludes them; never re-add them.
- ❌ Assert "dead" on a known **REVIVE** cluster (GDPR, contracts — see the orphan catalog,
  issue #308) → mark `needs-human` instead.
- ✅ Allowed writes: `signals/**` + a one-line append to `/work-log.md` — nothing else.
- ✅ **Persistence:** commit ONLY `signals/**` + `work-log.md` to the shared
  `audit-signals` branch and open/update its PR (same branch `type-lint-audit` uses).

## Coordination (shared brain, staggered)

Both audit loops write the **same** `signals/` folder and the **same** `audit-signals` PR.
To avoid branch contention they stagger; each does STEP 1.5 first —
`git fetch origin audit-signals && git checkout origin/audit-signals -- signals work-log.md`
— so it picks up the other loop's latest signals before writing.

| Loop | Cron (UTC, tbd) |
|---|---|
| `type-lint-audit` | `0 3 * * *` |
| `dead-route-sweep` | `0 4 * * *` |
| `signal-to-prompt-bridge` | `0 5 * * *` |

## Outstanding backlog

- [ ] The 15 confirmed orphans from the first run are a candidate **single human-gated
      batch-deletion prompt** (verify zero importers per file, then delete) — out of scope
      for this read-only loop; a human drafts/approves it.
- [ ] Widen the candidate universe beyond `handlers/routes/worker-modules` (the orphan
      catalog #308 estimates ~179 unreachable backend files) only after the verifier proves
      reliable on this bounded set.
- [ ] The 2 needs-human items (gdpr-handler, documentation) feed the bridge as `investigate`
      prompts on its next run.

## Timeline

- 2026-06-25 — loop created. Skill `audit-dead-routes` + `find-orphans.mjs` + contract
  scaffolded. First manual run: 97 handler/route/worker-module files scanned, 17 orphan
  candidates, a separate Explore verifier confirmed all 17 unwired (15 → confirmed dead,
  2 → needs-human: GDPR revive-cluster + documentation ambiguity). 1 aggregate signal
  written, 0 source touched. No cron yet — manual-only until proven.
