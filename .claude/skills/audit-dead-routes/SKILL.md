---
name: audit-dead-routes
description: Read-only sweep for orphaned handler/route files in this Cloudflare Worker repo — finds files under src/handlers, src/routes, src/worker-modules that are never imported into src/worker-integrated.ts (the hand-rolled live router) and referenced nowhere else in src/, then routes each candidate through a SEPARATE read-only verifier that must rule out barrels/route-aggregators and confirm the file is truly unwired before anything is marked a real orphan. Emits an aggregate signal into signals/; never edits source or the auto-memory, never deletes. Use for the dead-route-sweep loop or an on-demand orphan-handler check.
---

# audit-dead-routes

A **read-only** sweep for orphaned handler/route files in this repo. It detects files that
*look* dead (never wired into the live worker) and records the verified ones as signals. It
never deletes or edits anything — deletion is a separate, human-gated decision.

## The Pitchey model (read this — it's the inverse of file-based routing)

There is NO file-based routing. The live request path is rooted at
`src/worker-integrated.ts`, which registers every route by hand
(`this.register('METHOD','/api/path', handler)`) and imports its handlers statically or via
`await import(...)`. So an "orphan" is a handler/route file that the live worker **never
imports** — not a registered route that nothing calls. The repo's own CLAUDE.md test:
`grep -rn "<HandlerName>" src/worker-integrated.ts` → zero hits = orphaned.

## Why heuristic detection needs a hard verifier

"Is this file wired?" is a **heuristic** — a grep for its module path / exports. Grep has
blind spots the verifier exists to close:

1. **Route-aggregator / barrel** — a file could be mounted in bulk via an array of route
   modules or a barrel re-export, so its own path never appears at a `register(...)` site.
2. **Dynamic import** — `await import('./handlers/x')` with a partially-constructed
   specifier.
3. **Shadowed duplicate** — the file's URL paths ARE served, but by a *different* live
   handler; the file itself is still dead (note this).

A candidate is only a *candidate* until the verifier reads `worker-integrated.ts` and the
file first-hand.

## Hard boundaries (non-negotiable)

- **READ-ONLY to source.** Only writes allowed: new/updated files under `signals/` and a
  one-line append to `/work-log.md`. Never edit/delete a file, never open a source-changing
  PR, never run migrations.
- **Never write to the auto-memory** (read-only for context).
- **No self-verification.** A separate read-only `Explore` verifier confirms candidates.
- **Never delete.** This loop *reports*. Deletion is a separate human-gated prompt.
- **Never flag PROTECTED parked paths** (#60 `src/workflows/`, #61 crawl4ai/console-analysis)
  — `find-orphans.mjs` excludes them; keep it that way.

## Process

### 1. Build candidates (read-only)

Run the bundled finder from the repo root:

```bash
node .claude/skills/audit-dead-routes/find-orphans.mjs
```

It scans `src/{handlers,routes,worker-modules}` (excluding tests, `types.ts`, `index.ts`
barrels, and PROTECTED paths) and prints, for each file whose module path is imported by
**no other file in `src/`**, an `ORPHAN <path>` line — plus any `authResult: any`
orphan-signature smells. The "imported nowhere in src/" rule is deliberately conservative:
it errs toward marking things *live*, so a candidate is a strong signal.

### 2. Dedup against existing signals/

If a `source: dead-route-sweep` signal already covers a candidate, append a dated line to
its `## Timeline` instead of duplicating.

### 3. Verify — spawn a SEPARATE read-only verifier

Spawn the verifier via the **`Agent` tool, `subagent_type: "Explore"`** (cannot
Write/Edit/Agent). Give it the full candidate list and require, per candidate, that it
reads the file's exports + URL paths and greps `worker-integrated.ts` (module path, basename,
every export name) AND the whole `src/` tree for a route-aggregator/barrel before ruling:

- **real orphan** — not imported anywhere into the live worker, not mounted by any
  aggregator. Severity `low` (dead weight); bump to `medium` only if it duplicates/shadows
  a LIVE route in a confusing way.
- **false positive** — it IS reached (say how: imported at file:line, or mounted by X).
- **needs-human** — unwired BUT plausibly intentional: an external receiver (webhook) that
  looks like deliberate scaffolding, OR a known **REVIVE** cluster (GDPR, contracts — orphan
  catalog #308), OR genuinely ambiguous.

A `*.routes.ts` file is NOT saved by "being a webhook": if nothing imports/mounts it, it
cannot receive requests in this hand-rolled-router worker. Flag deliberate external INTENT
as needs-human, not the wiring as live.

### 4. Write the signal(s) (you, not the verifier)

Write ONE **aggregate** `dead-route-sweep` signal per run (`status: confirmed` — the scan
counts and per-file verdicts are facts), using `signals/README.md` schema. It must contain:
- the headline: `N files scanned, M candidates, K confirmed orphan, J needs-human`;
- a **confirmed-orphan list** (path + one-line evidence each);
- a **`## needs-human`** sub-list, each item with a stable `#item-slug` and the open
  question, so the `signals-to-prompts` bridge can mine them into `investigate` prompts.

Apply the orphan-catalog override: a confirmed-by-verifier file that belongs to a REVIVE
cluster (GDPR, contracts) is recorded as **needs-human**, not confirmed-dead.

Do NOT auto-draft a deletion prompt — confirmed orphans become a single human-gated
batch-deletion prompt a human approves later (out of scope for this read-only loop).

### 5. Log + prove inertness

- Append one line to `/work-log.md`.
- `git status --porcelain` must show only `signals/**` + `work-log.md`. Anything else → STOP.

## Rules (self-improving — append as you learn)

- A confirmed orphan is a *report*, never an auto-deletion.
- If the verifier finds a route-aggregator/barrel pattern grep keeps missing, note its path
  here so future runs pre-exclude what it mounts.
- REVIVE clusters (GDPR, contracts — #308) and any external-receiver scaffolding are
  `needs-human`, not auto-dead.
- Several orphans here are written in frameworks that can't run in the Worker at all
  (Express `Router`, Deno/Oak `https://deno.land/...`, standalone Hono apps) — a strong
  dead tell, but still verify wiring, don't assume.
- (add new never-do-this rules here as they come up)
