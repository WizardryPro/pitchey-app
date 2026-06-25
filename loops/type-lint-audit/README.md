# Loop contract — `type-lint-audit`

The first read-only audit loop in this repo. It exists to **prove the
skill + loop + signals + verifier pattern end-to-end on something safe** before any
loop is ever given write access to the codebase.

## Goal

Periodically take a read-only health snapshot of the source tree's type/lint state
(worker + frontend), emit verified findings into `signals/`, and keep a trend
timeline — with **zero** risk to the codebase, because the loop physically cannot edit
source.

## Workflow (each run)

1. Read the last ~5–10 entries of `/work-log.md` for recent context.
2. Read this contract (goal, boundaries, backlog) and `STACK.md`.
3. Invoke the **`audit-type-errors`** skill:
   - run the worker type-check, frontend type-check, and frontend lint (all read-only),
   - build candidates, dedup against existing `signals/`,
   - spawn a **separate read-only `Explore` verifier** to confirm each candidate,
   - the main session writes `confirmed` / `unverified` signals.
4. Append one line to `/work-log.md`.
5. Prove inertness: `git status --porcelain` shows only `signals/**` + `work-log.md`;
   no source, no memory.
6. Persist (cloud only): commit those two paths to the `audit-signals` branch and
   open/update its PR to `main`. Abort the push if anything outside the two paths is
   staged.

## Boundaries — READ-ONLY to source (must NEVER do)

- ❌ Edit, create, delete, or format any **source** file (anything outside `signals/`
  and `work-log.md`).
- ❌ Run `tsc --build`/emit, `eslint --fix`, `prettier --write`, or any formatter.
- ❌ Open or update any PR that changes **source**. (A signals-only PR is allowed —
  see below.)
- ❌ Run migrations (`npm run db:migrate`), `wrangler deploy`, or any DB/prod write.
- ❌ Call any mutating endpoint or external write API.
- ❌ Write to the auto-memory directory (read-only for context only).
- ❌ Let the audit agent confirm its own findings (verifier must be separate).
- ❌ Scaffold additional loops, fix agents, or write-access workflows.
- ❌ Touch the PROTECTED parked paths (#60 `src/workflows/`, #61 crawl4ai/console-analysis)
  even as read targets to "flag" — they are intentionally parked, not findings.
- ✅ Allowed writes: `signals/**` and a one-line append to `/work-log.md` — nothing else.
- ✅ **Persistence (cloud routine only):** because a cloud checkout is wiped after each
  run, the routine MAY commit **only** `signals/**` + `work-log.md` to a dedicated
  branch and open/update **one** PR (`audit-signals` → `main`) so findings persist and
  dedup across runs. That PR must contain ZERO source changes — if `git status` shows
  anything outside `signals/` + `work-log.md`, abort the push.

## Trigger

Not yet scheduled. First lives as a **manual** invocation (the skill, run by hand) to
prove the pipeline. A nightly cron cloud routine (via the `schedule` skill) is a later
step, registered only after several clean manual/scheduled runs. Exact cron expression
+ routine id will be recorded in the Timeline below at registration.

> ⚠️ Env requirement: the run env must have **Node + npm with installed deps** for both
> the worker (root `node_modules`, for `tsc`) and the frontend (`frontend/node_modules`,
> for `tsc` + `eslint`). A cloud routine must `npm ci` (root) and `cd frontend && npm ci`
> before the audit, or the audit step is invalid. Verified at registration.

## Outstanding backlog

- [ ] First cloud-routine run on an env that has installed deps (confirm the two
      `npm ci` steps succeed within the routine time budget).
- [ ] Decide a retention/auto-close policy for signals whose underlying error is fixed
      (currently: append "resolved" to Timeline, leave file).
- [ ] (later, out of scope now) the `signal-to-prompt-bridge` loop that *reads*
      confirmed signals to draft fix prompts — deliberately NOT built in this slice.
- [ ] (later) the `dead-route-sweep` loop — Pitchey's orphan model is "not registered
      in `worker-integrated.ts`", NOT file-based routing; needs its own contract.

## Timeline

- 2026-06-25 — loop created. Skill `audit-type-errors` (adapted to Pitchey's
  Worker + React/Vite stack), `signals/` artifact layer, `work-log.md` log layer, and
  `STACK.md` scaffolded. First manual test run + separate Explore verifier executed.
  Shipped as the harness-bootstrap PR. **No cron yet** — manual-only until proven.
