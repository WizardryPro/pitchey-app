---
name: signals-to-prompts
description: Read-only bridge that turns signals/ findings into ready-to-act Claude Code prompts in prompts/. Reads confirmed signals + needs-human items, invokes the oneshot-prompt-generator skill (stack resolved from STACK.md) for each, and writes one prompt artifact per finding — confirmed→action:execute, needs-human→action:investigate (strict, never crossed). Generates prompts only; never executes them, never writes source, signals/, or the auto-memory. Use for the signal-to-prompt-bridge loop or an on-demand signals→prompts pass.
---

# signals-to-prompts

A **read-only** drafting bridge. It reads what the audit loop(s) found and writes the exact
Claude Code prompt a human would need to act — correctly stacked, evolution-mode tagged,
and classified execute vs. investigate. It **generates prompts; it never runs them.**

## Hard boundaries (non-negotiable)

- **Generate, never execute.** Only writes allowed: new files under `prompts/` and a
  one-line append to `/work-log.md`. Never run a generated prompt, never spawn a fix
  agent, never edit source, never open a source-changing PR.
- **Never write to `signals/` or the auto-memory.** It *reads* signals; it never mutates them.
- **`needs-human` → `action: investigate`, always.** A finding the verifier did not
  confirm can only become an investigate prompt. Never label it `execute`. This is the
  one rule whose violation could cause harm.

## Input: which signals become prompts

Read `signals/` and select work items:

1. **Standalone `status: confirmed` signals that name a discrete, actionable item**
   (a worker type error on a live path). → `signal_status: confirmed`, `action: execute`.
2. **`needs-human` items.** The verifier's *needs-human* verdicts (e.g. the orphan-route
   candidates a future `dead-route-sweep` aggregate will enumerate). Each becomes its own
   prompt with `source_signal: <aggregate-id>#<item-slug>`. → `signal_status: needs-human`,
   `action: investigate`.

**Skip** pure aggregate/trend signals as discrete tasks (e.g. the lint-aggregate) — they
have no single fix. (You still *mine* an aggregate for any needs-human list it carries.)

## Process

### 1. Overlay the shared brain (cloud run, read-only)

```bash
git fetch origin audit-signals 2>/dev/null && \
  git checkout origin/audit-signals -- signals prompts work-log.md 2>/dev/null || \
  echo "no prior audit-signals branch yet — read signals from the current checkout"
```
This pulls the freshest signals and existing prompts onto the current source, so dedup
works and the shared `audit-signals` PR accumulates.

### 2. Dedup

For each candidate item, skip it if `prompts/` already has a file whose `source_signal`
matches (including the `#item` fragment for aggregate items).

### 3. Generate via `oneshot-prompt-generator`

For each new item, invoke the **`oneshot-prompt-generator`** skill. Pass it the signal's
finding + evidence + file refs as the task. **Let it resolve the stack from `STACK.md`** —
do NOT hardcode a stack. Apply the action mapping:

- **confirmed → `action: execute`.** A ready fix.
  - A confirmed *worker type error* → a Band-1 fix prompt with the `path:line`, scoped to
    the named file(s), and a **`Done When` green gate**:
    `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error gone
    **and introduces no new errors**. (The worker is not type-checked in CI — this gate is
    the only safety net.) `gates: recommended` for high-severity live-path fixes (e.g.
    `worker-integrated.ts`, `worker-database.ts`, `notification.service.ts`), `optional` for
    low-severity cosmetic ones (implicit-any params).
  - Constrain the fix to the cited file(s); forbid widening shared types or adding `any`/
    casts to silence the checker — fix the actual mismatch.
- **needs-human → `action: investigate`.** NOT a fix. The prompt MUST:
  - lead with the **open question the verifier couldn't resolve**;
  - instruct Claude Code to **verify the finding is real first** (grep for indirect /
    external callers, check git history / intent) before any change;
  - have a "Done When" that is **a written verdict, not a code change**. Explicitly: no
    source edit in an investigate prompt.

### 4. Write prompts

One file per item into `prompts/` using the schema in `prompts/README.md`. The body is
the full generated one-shot prompt, beginning with the resolved stack banner.

### 5. Log + prove inertness

- Append one line to `/work-log.md` (items read, prompts written, execute vs investigate).
- `git status --porcelain` must show only `prompts/**` + `work-log.md`. If `signals/`,
  the auto-memory, or any source path changed → STOP and report.

### 6. Persist (cloud run)

Commit ONLY `prompts/**` + `work-log.md` to the shared `audit-signals` branch and update
its PR (same signals-only-PR relaxation the audit loops use). Never `git add -A`.

## Rules (self-improving)

- Never emit an `execute` prompt from a `needs-human` item, no matter how obvious it looks.
- Skip aggregates as tasks; mine them only for their needs-human lists.
- Never draft a prompt that edits a PROTECTED parked path (#60 `src/workflows/`, #61
  crawl4ai/console-analysis) — even if a signal slipped through about one.
- Every worker-type-fix prompt MUST carry the worker-tsc green gate in "Done When" — the
  worker has no CI type-check, so without it a "fix" is unverifiable.
- If `oneshot-prompt-generator` can't resolve the stack (no STACK.md/manifest), it asks —
  in a headless cron run, record the item as skipped in `work-log.md` rather than guessing.
- (add new never-do-this rules here as they come up)
