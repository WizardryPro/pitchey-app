---
name: audit-type-errors
description: Read-only audit that runs the worker type-check (tsc on the root tsconfig), the frontend type-check (tsc on tsconfig.app.json), and the frontend lint (eslint) over this Cloudflare Worker + React/Vite repo, emits per-finding type-error signals and one aggregate lint trend signal into signals/, and routes each candidate through a separate read-only verifier before marking it confirmed. Never edits source, never touches the auto-memory. Use for the type-lint-audit loop or any on-demand read-only type/lint health pass on this repo.
---

# audit-type-errors

A **read-only** audit pass for this Cloudflare Worker (`src/`) + React 18 + Vite
(`frontend/`) repo. It detects type and lint problems and records them as signals. It
does **not** fix anything. Resolve all stack specifics from `STACK.md`.

## Hard boundaries (non-negotiable)

- **READ-ONLY.** The only writes permitted are new/updated files under `signals/` and a
  one-line append to `/work-log.md`. No source edits. No PRs (except the signals-only
  persistence PR described in the loop contract). No migrations. No `wrangler deploy`.
  No `eslint --fix`, no `tsc --build`/emit, no `prettier --write`.
- **Never write to the auto-memory directory.** You may *read* memory for context only.
- **No self-verification.** The agent that runs the audit must NOT confirm its own
  findings. Confirmation comes from a *separate* read-only verifier (step 4).
- **Stay in this lane.** Do not scaffold other loops, fix agents, or write-access
  workflows. Do not touch the PROTECTED parked paths (#60 `src/workflows/`, #61
  crawl4ai/console-analysis) even to flag them.

## Process

### 1. Run the audit commands (read-only)

Requires installed deps. **Important env reality (verified 2026-06-25):** TypeScript is
**NOT installed at the repo root** — the worker is bundled by esbuild, which does no
type-checking, so the worker has no native type-check step and CI never type-checks it.
The only `tsc` lives in `frontend/node_modules`. So the worker type-check is run with
the **frontend's tsc binary against the root tsconfig** (this resolves `src/**`
correctly because the root tsconfig's paths are root-relative and we invoke from root).
Do NOT use bare `npx tsc` at root — with no local typescript it triggers npx's install
prompt and the run is invalid. On a fresh/cloud checkout run `npm ci` (root) and
`cd frontend && npm ci` first.

```bash
# Worker type-check — root tsconfig (strict), run via the frontend tsc binary from root.
# CI does NOT do this; it is the highest-value finder here (silent worker type drift).
./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | tee /tmp/tc-worker.out

# Frontend type-check — tsconfig.app.json (the FE gate, per STACK.md).
( cd frontend && node_modules/.bin/tsc --noEmit -p tsconfig.app.json ) 2>&1 | tee /tmp/tc-frontend.out

# Frontend lint — high volume, aggregated not per-finding. (No backend ESLint exists.)
( cd frontend && node_modules/.bin/eslint . ) 2>&1 | tee /tmp/lint.out
```

**Do not trust the shell exit code when piping** (`| tee` masks it). Parse the output
text instead:
- type errors: each `error TSxxxx:` block with its `path(line,col)` location, plus the
  trailing `Found N errors` line if present.
- lint: the per-file `error/warning` lines and eslint's `✖ N problems (E errors, W warnings)`
  summary line.

### 2. Build candidate findings

- **One candidate per `tsc` error**, separately tagged `worker` or `frontend`. Extract
  `path:line:col`, the `TSxxxx` code, the message, and the offending source excerpt.
- **One aggregate candidate for lint:** total problems (errors/warnings split) + the
  top 3 rule names by frequency. Do NOT emit a signal per lint hit.

Triage hints for the verifier (Pitchey-specific — see `STACK.md`):
- A `tsc` error in an **orphan** file (a handler/route under `src/handlers`,
  `src/routes`, `src/worker-modules` with NO `register('METHOD','/path',…)` reference
  in `src/worker-integrated.ts`) is **low value / likely needs-human** — the file may
  be dead. Pre-tag it `likely-orphan`.
- A `tsc` error under a **PROTECTED parked path** (`src/workflows/`,
  `src/workers/crawl4ai-worker.ts`, `src/services/console-analysis-crawler.ts`) is a
  **false positive for fixing** — intentionally parked (#60/#61). Pre-tag
  `protected-parked`; never propose a fix.
- The orphan smell signature `(request, env: any, authResult: any)` marks dead code.
- An error on a **live path** (`src/worker-integrated.ts` itself, a handler reachable
  from it, or a live `frontend/src/pages|features|services|stores` file) is a **real
  finding**.

### 3. Check for existing signals (dedup)

For each candidate, search `signals/` for an existing signal on the same
`path:line + code`. If found, **append a dated line to its `## Timeline`**
("still present") instead of creating a duplicate. Only genuinely new candidates
become new files.

### 4. Verify — spawn a SEPARATE read-only verifier

For the new candidates, spawn a read-only verifier and pass it the candidate list + the
triage hints above. Use the **`Agent` tool with `subagent_type: "Explore"`** — Explore
cannot Edit/Write/Agent, so it is structurally incapable of mutating the repo or of
being the same actor that writes the signal.

Ask the verifier to return, per candidate: `real finding | false positive |
needs-human`, a severity (`low|medium|high`), and one line of justification. The
verifier reads the cited files first-hand (and, for orphan candidates, greps
`worker-integrated.ts` itself) — it does not take the finder's word.

### 5. Write signals (main session only)

The **main session** (not the verifier) writes the files into `signals/` using the
schema in `signals/README.md`:
- verifier said *real finding* → `status: confirmed`, severity from verifier.
- verifier said *false positive* or *needs-human* → `status: unverified` (record the
  verdict so it isn't re-surfaced as confirmed next run).
- always write the aggregate lint trend signal (status `confirmed` — the count is a
  fact; no per-line verification needed).

### 6. Log and prove inertness

- Append one line to `/work-log.md`: date, source, run summary (`worker N errs,
  frontend M errs, K lint problems, J new signals, C confirmed`).
- **Prove read-only:** run `git status --porcelain` and confirm only paths under
  `signals/` and `work-log.md` changed. If anything else shows up, STOP and report —
  the loop violated its contract.
- Confirm `git status` shows **zero** changes under any source path or the auto-memory.

## Output

A short summary back to the caller: counts, which signals were created/updated, the
verifier verdicts, and the `git status` proof-of-inertness line.

## Rules (self-improving — append as you learn)

- Always emit the aggregate lint signal even when the count is unchanged; the
  `## Timeline` is the trend record.
- If both type-checks report **zero** errors, that's a healthy run — append to
  `work-log.md` and do not invent findings.
- A failed tool *launch* (missing `node_modules`, wrong cwd) is NOT a clean run — never
  record it as "0 errors". Fix the env or report the env gap as the finding.
- Pre-tag orphan / protected-parked candidates for the verifier; do not skip them
  silently and do not auto-confirm them.
- The worker has no ESLint config; lint is frontend-only. Do not invent a backend lint
  signal.
- (add new never-do-this rules here as they come up)
