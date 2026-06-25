# HARNESS.md — the read-only autonomous-audit harness (Pitchey)

A portable **find → (later) draft → (later) execute** audit harness. The de-bias lives
in one file: [`STACK.md`](STACK.md). The stack-agnostic skills resolve it, so the same
skill that produces Deno/Fresh prompts on a sibling repo produces Cloudflare-Worker/Neon
prompts here — automatically.

> **Status: slice 1 of N.** Only the read-only *find* layer exists today (one loop). The
> *draft* (signal→prompt bridge) and *execute* (launch-prompts) layers are deliberately
> NOT built yet. See "Roadmap" below.

## The pipeline (target shape)

```
loops/type-lint-audit  ──(read-only audit)──►  signals/   ──►  work-log.md
        │                                          │
   audit-type-errors skill                    (artifact layer)
   + separate Explore verifier                     │
                                                    ▼
   [LATER] signal-to-prompt-bridge  ──►  prompts/  (action: execute | investigate)
                                                    │
                                                    ▼
   [LATER] morning-brief (list) ─► human picks ─► [PARKED] launch-prompts (worktree → PR)
```

## What exists now (slice 1)

| Piece | Path | Role |
|---|---|---|
| Stack profile (the bias file) | `STACK.md` | resolved by all generator skills |
| Loop contract | `loops/type-lint-audit/README.md` | the read-only type/lint loop's charter + boundaries |
| Finder skill | `.claude/skills/audit-type-errors/SKILL.md` | runs worker+frontend tsc + frontend eslint, verifies, writes signals |
| Artifact layer | `signals/` (+ `signals/README.md`) | durable, verified findings; `confirmed`/`unverified` |
| Run log | `work-log.md` | one line per loop run |

## Invariants (every loop, forever)

1. **Read-only to source.** A loop may only write `signals/**` + one line to
   `work-log.md`. Prove it each run with `git status --porcelain`.
2. **Verify-not-self-verify.** The finder never confirms its own findings; a separate
   read-only `Explore` agent does.
3. **Generate, never execute.** (Applies once the bridge exists — prompts are drafts a
   human chooses to run.)
4. **The human is the only merge gate.** The single allowed PR is the signals-only
   `audit-signals` PR; it must contain zero source changes.
5. **Never write to the auto-memory.** Read-only for context.
6. **Respect PROTECTED parked paths** (#60 `src/workflows/`, #61 crawl4ai/console-analysis).

## Roadmap (gated — each step ships + is judged before the next)

- [x] **Slice 1 — brain + one read-only finder (type/lint).** This PR.
- [ ] **Slice 2 — `signal-to-prompt-bridge` + `morning-brief`.** Reads confirmed
      signals → drafts `prompts/` (`execute`/`investigate`, strict mapping).
- [ ] **Slice 3 — `dead-route-sweep`.** Pitchey's orphan model is "handler not
      registered in `worker-integrated.ts`", NOT file-based routing. Must exclude
      PROTECTED paths and account for the `/api/admin/*` intercept (see `STACK.md`).
- [ ] **Slice 4 — cron routines** (via `schedule`), staggered, with a not-merged guard,
      persisting to the shared `audit-signals` PR.
- [ ] **Slice 5 — `launch-prompts`** (the write layer): PARKED until several nights of
      drafted prompts are judged good by a human.

## Note on the catch-swallow finder

This repo already enforces silent-error discipline via
`scripts/catch-swallow-gate.mjs --include-worker --threshold 0` (wired into CI). Any
future catch-swallow audit loop must **defer to that gate**, not reinvent a competing
rule.
