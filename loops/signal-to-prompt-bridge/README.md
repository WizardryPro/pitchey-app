# Loop contract — `signal-to-prompt-bridge`

The loop that closes the gap between *finding* and *acting*: it reads the audit loop(s)'
signals and drafts the exact Claude Code prompt a human would run — correctly stacked,
evolution-mode tagged, and marked execute vs. investigate. It **generates prompts; it
never executes them.** The human stays the author, executor, and merge gate.

## Goal

After the audit loop(s), turn confirmed + needs-human signals into ready-to-act prompts
in `prompts/`, so the morning's work collapses to *reading prompts and choosing which to
launch* — without ever giving a loop write access to source.

## Workflow (each run)

1. Read the last ~10 entries of `/work-log.md` (the shared brain).
2. Read this contract and `STACK.md`.
3. Invoke the **`signals-to-prompts`** skill:
   - overlay `signals prompts work-log.md` from the shared `audit-signals` branch,
   - select confirmed signals + needs-human items, dedup against existing `prompts/`,
   - for each, invoke **`oneshot-prompt-generator`** (stack resolved from `STACK.md`),
   - write one prompt per item: `confirmed → action:execute`, `needs-human → action:investigate`.
4. Append one line to `/work-log.md`.
5. Prove inertness: `git status` shows only `prompts/**` + `work-log.md`; `signals/`, the
   auto-memory, and all source untouched.
6. Persist to the shared `audit-signals` PR.

## Boundaries — READ-ONLY to source, GENERATE-ONLY (must NEVER do)

- ❌ Execute any generated prompt, spawn a fix agent, or write source.
- ❌ Open or update any **source-changing** PR.
- ❌ Write to `signals/` (it reads signals; it never mutates them) or to the auto-memory.
- ❌ Emit an `action: execute` prompt from a `needs-human` signal — investigate only.
- ❌ Run migrations or any DB write; call any mutating endpoint.
- ✅ Allowed writes: `prompts/**` + a one-line append to `/work-log.md` — nothing else.
- ✅ **Persistence:** commit ONLY `prompts/**` + `work-log.md` to the shared
  `audit-signals` branch and update its PR.

## Coordination (writer on the shared brain)

| Loop | Cron (UTC) | Reads | Writes |
|---|---|---|---|
| `type-lint-audit` | (tbd, e.g. `0 3 * * *`) | source | `signals/` |
| `dead-route-sweep` (slice 3, later) | (tbd, e.g. `0 4 * * *`) | source | `signals/` |
| **`signal-to-prompt-bridge`** | **(tbd, e.g. `0 5 * * *`)** | **`signals/` (freshest)** | **`prompts/`** |

The bridge cron must fire **after** every audit loop, so it reads the run's complete
signal set. STEP 1 overlays all three artifact paths — `git checkout origin/audit-signals
-- signals prompts work-log.md` — so every writer accumulates on the shared
`audit-signals` PR without clobbering on push.

## Pitchey-specific generation notes

- A confirmed **worker type error** → a Band-1 fix prompt with the `path:line`, scoped to
  the named file(s), and a **`Done When` green gate**:
  `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error gone
  **and introduces no new errors** (the worker is not type-checked in CI — the gate is the
  only safety net). `gates: recommended` for high-severity live-path fixes, `optional` for
  low-severity cosmetic ones.
- There is **no `fresh.gen.ts` / manifest regen** here (that was a sibling-repo concern).
- Skip pure aggregate/trend signals (the lint-aggregate) as discrete tasks — they have no
  single fix.
- Respect PROTECTED parked paths (#60/#61): never draft a prompt that edits them.

## Outstanding backlog

- [ ] Once a few rounds of `action: execute` prompts land, judge whether they're prompts
      you'd actually have run yourself. If yes, a *write* loop (`launch-prompts`) becomes a
      small, evidence-backed next step. If no, that was learned cheaply — in a folder.
- [ ] `needs-human` items are currently absent (slice-1 signals were all confirmed or
      aggregate). When the `dead-route-sweep` lands, its aggregate will carry needs-human
      items to mine into `investigate` prompts.

## Timeline

- 2026-06-25 — loop created. `prompts/` artifact layer + `signals-to-prompts` +
  `morning-brief` skills + contract scaffolded. First manual run drafted 9 `action:execute`
  prompts from the 9 confirmed worker type-error signals (lint-aggregate skipped as a
  trend). No cron yet — manual-only until proven. Shipped stacked on the slice-1 PR.
