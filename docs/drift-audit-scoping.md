# Drift Audit Script — Issue #20 Scoping

_Captured 2026-05-04 alongside Phase 5.0 (orchestrator) and Phase 4 (unit
economics) decompositions. The "looks load-bearing, isn't" pattern surfaced on
**eight surfaces** today; this doc scopes the unified audit script that
catches the whole class. Honest total: ~8 days active engineering + 2-week
soak. The original #20 framing was 3 checks; today's session expanded the
inventory to 8. Phase 1 below ships the original 3; Phase 2 ships the
expansion._

## What this doc is

A unified **declaration-vs-runtime audit** — one tool, N checks, one allowlist
convention, one report. The pattern across all checks is:

> For every declaration X in source/config, verify the corresponding runtime
> entity Y exists. Mismatches are drift.

Not a code linter, not a security scanner, not a test runner. Specifically a
*reality-check* tool: things that are documented or declared but don't
correspond to live runtime behavior.

## Existing infrastructure (don't rebuild from scratch)

Three hook scripts already implement pieces of this:

| Script | Hook | Implements |
|---|---|---|
| `scripts/list-orphan-pages.sh` | SessionStart | Orphan-pages check (frontend pages without `<Route>` or import in `App.tsx`) |
| `scripts/check-orphan-page.sh` | PostToolUse on Edit/Write | Per-file orphan-page check |
| `scripts/docs-vs-code-audit.sh` | Stop | 3 ad-hoc checks: BA-import tripwire, FRONTEND_URL doc-match, .pages.dev URL resolution |

Plus an allowlist convention exists at `frontend/.orphan-pages-allowlist`:
- One entry per line: `<repo-relative-path> # <required reason>`
- Comment is **required** — lines without comment are invalid and ignored. This is the right shape for the unified script — keep it.

**The unification work is migration + expansion, not greenfield.**

## Drift findings during this scoping pass

| # | Finding | Action |
|---|---|---|
| 1 | `docs-vs-code-audit.sh` check #2 ("FRONTEND_URL matches CLAUDE.md") is hyper-specific — not generalizable. Other URL doc-claims drift the same way. | Generalize to "any URL declared as canonical in `wrangler.toml` `[vars]` should match the source-of-truth doc." Or skip — see discussion in Phase 2 below. |
| 2 | Orphan-pages script applies only to React pages. Worker handlers can also be orphaned (parallel handler trees per CLAUDE.md). | Worker-handler orphan check is in scope for the unified script; surfaced as M9 in Phase 2 below. |
| 3 | Existing scripts are Bash. AST-based checks (library import → runtime call) need TypeScript/Node. | Architecture decision: TypeScript runner with one check per file, Bash wrapper for backwards-compat with existing hooks. |
| 4 | The Stop hook earlier today (BA-import tripwire) is the canonical proto-version of an audit check. Same shape: declaration → runtime. Worth naming it as Pattern A and standardizing. | Document in M1's framework section — every check should emit identical-shaped output regardless of internal mechanism. |

## The 8 check inventory (today's complete picture)

| # | Check name | Pattern | Already exists? | Phase |
|---|---|---|---|---|
| 1 | **Page → Route binding** | Every `frontend/src/pages/*.tsx` has an import + `<Route>` in `App.tsx` | YES (`list-orphan-pages.sh`) | 1 (migrate) |
| 2 | **Dependency → Import binding** | Every `package.json` `dependencies`/`devDependencies` entry has at least one `import` site in `src/` or `frontend/src/` | NO (depcheck handles externally) | 1 (integrate) |
| 3 | **CI step → Fixture binding** | Every CI workflow step that runs a script/test against a file (e.g., `npx vitest run path/to/file.test.ts`) — that file exists | NO | 1 (new) |
| 4 | **Library import → Runtime call binding** | Every `import { X } from 'lib'` has at least one `X(...)` invocation in the same file | NO (BA-import tripwire is a manual one-off) | 2 (new, AST) |
| 5 | **DO export → wrangler binding** | Every `export { X } from './durable-objects/...'` in worker entry point is in `wrangler.toml` `[[migrations]] new_classes` | NO | 2 (new) |
| 6 | **Module reference → File existence** | Every `import './X'` or `await import('./X')` resolves to an existing file (`X.ts`, `X/index.ts`) | YES (TSC at compile time, but not surfaced in audit reports) | 2 (integrate) |
| 7 | **AE write target → wrangler binding** | Every `env.<X>.writeDataPoint(...)` references a binding declared in `wrangler.toml` `[[analytics_engine_datasets]]` | NO | 2 (new) |
| 8 | **Strategy-doc action → wrangler binding** | Every "bounded action" mentioned in `docs/strategy-five-pillars-*.md` that names a runtime binding (Hyperdrive cache, DO restart, etc.) — that binding exists | NO | 2 (new, markdown parse) |

The split: **Phase 1 = original #20 scope (3 checks per memory)** + **Phase 2 = expansion surfaced today (5 checks)**. Phase 1 is the immediate-value PR; Phase 2 is the comprehensive coverage.

## Architecture

**TypeScript runner with per-check files** under `scripts/audit/`:

```
scripts/audit/
├── runner.ts              # Entry point, loads checks, executes, formats report
├── types.ts                # CheckResult, CheckContext, AllowlistEntry
├── checks/
│   ├── orphan-pages.ts     # Migrated from list-orphan-pages.sh
│   ├── unused-deps.ts      # Wraps depcheck or implements directly
│   ├── ci-step-fixtures.ts # New
│   ├── unused-imports.ts   # Phase 2: AST-based
│   ├── do-bindings.ts      # Phase 2
│   ├── module-resolution.ts # Phase 2: integrate TSC
│   ├── ae-bindings.ts      # Phase 2
│   └── strategy-doc.ts     # Phase 2: markdown parse
└── allowlist.toml          # Single allowlist file at scripts/audit/ root
```

**Bash wrapper** preserves existing hooks:
- `scripts/list-orphan-pages.sh` calls `node scripts/audit/runner.ts --check=orphan-pages --mode=session-start --json`
- `scripts/check-orphan-page.sh` calls `node scripts/audit/runner.ts --check=orphan-pages --mode=post-tool-use --file=<path> --json`
- `scripts/docs-vs-code-audit.sh` calls `node scripts/audit/runner.ts --mode=stop`

Same hook surface, unified internals. Existing scripts can be deleted in Phase 1's M5 (migration), or kept as thin wrappers indefinitely if breakage risk is too high.

## Allowlist convention

Extend the `frontend/.orphan-pages-allowlist` shape into a single file `scripts/audit/allowlist.toml`:

```toml
[orphan_pages]
"frontend/src/pages/SomeParkedPage.tsx" = "parked: see issue #61, market-intel revival"
"frontend/src/portals/creator/pages/WipDashboardV2.tsx" = "in-progress: PR #123"

[unused_deps]
"some-lib" = "vendored types only, no runtime code"

[ci_step_fixtures]
"tests/manual/load-test-fixtures.json" = "generated at runtime by quality-gates.yml step 4"

[unused_imports]
# (Phase 2)

[do_bindings]
"ContainerOrchestrator" = "parked container worker, see issue #73"
"JobScheduler" = "parked container worker, see issue #73"

# ... one section per check
```

**Allowlist hygiene:**
- Comment value is **required**. Empty string allowlists are rejected by the runner.
- Comment must reference an issue # OR a PR # OR a CLAUDE.md carve-out paragraph (the runner doesn't enforce this textually, but the team convention does).
- Allowlist entries are reviewed quarterly: a check `audit-allowlist-review` opens an issue listing entries older than 90 days for re-justification.

## Output format

Same shape as existing `docs-vs-code-audit.sh`:

```
Running drift audit (8 checks)...
✅ orphan_pages — 0 violations (3 allowlisted)
✅ unused_deps — 0 violations (1 allowlisted)
❌ ci_step_fixtures — 1 violation:
   - .github/workflows/quality-gates.yml:42 references tests/db-tests.test.ts which doesn't exist
✅ unused_imports — 0 violations
❌ do_bindings — 2 violations:
   - src/worker-integrated.ts:20646 exports ContainerOrchestrator (not in wrangler.toml)
   - src/worker-integrated.ts:20647 exports JobScheduler (not in wrangler.toml)
✅ module_resolution — 0 violations
❌ ae_bindings — 2 violations:
   - src/db/traced-operations.ts:223 writes to PITCHEY_PERFORMANCE (not in wrangler.toml)
   - src/services/trace-service.ts:206 writes to TRACE_ANALYTICS (not in wrangler.toml)
✅ strategy_doc — 0 violations

5 violations across 3 checks. Run `node scripts/audit/runner.ts --explain` for guidance.
Exit code: 1
```

**Exit code:** non-zero if any **non-allowlisted** violations. Zero if everything is either compliant or allowlisted.

## Hard prerequisites

| ID | Description | Estimate | Gate |
|---|---|---|---|
| P1 | **Architecture decision** — confirm TypeScript runner with per-check files. Alternatives (single Bash script, Python, AST-based via Rust tooling like Biome) considered. | 0.5 days | Decision documented in this doc |
| P2 | **Allowlist convention finalize** — extend existing `.orphan-pages-allowlist` shape into TOML, OR keep separate per-check files | 0.5 days | Schema documented in this doc; example `allowlist.toml` committed in M1 |

(Both folded into M1 in practice.)

## Phase 1 — Original #20 scope (3 checks)

### M1 — Framework + first check (orphan-pages migration) (1.5 days)

**What:** Build the TypeScript runner, allowlist loader, report formatter, and migrate the existing orphan-pages logic into `scripts/audit/checks/orphan-pages.ts`. The Bash wrappers `list-orphan-pages.sh` and `check-orphan-page.sh` become thin shells calling the new runner.

**Gate G-M1:**
- (a) `node scripts/audit/runner.ts --check=orphan-pages` produces output identical to current `list-orphan-pages.sh` (including allowlist handling)
- (b) Bash wrappers still trigger correctly from SessionStart and PostToolUse hooks
- (c) Report format matches the spec above (per-check summary + violation list + exit code)
- (d) Allowlist file `scripts/audit/allowlist.toml` accepted with `[orphan_pages]` section; existing `frontend/.orphan-pages-allowlist` migrated entries (or kept as a delegated source)

### M2 — Unused-dependencies check (0.5 days)

**What:** Add `scripts/audit/checks/unused-deps.ts`. Either wrap `depcheck` (npm CLI tool, well-maintained) or re-implement: parse `package.json`, grep for imports across `src/`, `frontend/src/`, `scripts/`. Wrap is faster.

**Gate G-M2:**
- (a) `node scripts/audit/runner.ts --check=unused-deps` reports zero violations against current main (post the today-cleanup of `resend` + `@better-auth/infra`)
- (b) After Phase 1.5 of the BA rip uninstalls `better-auth` + `better-auth-cloudflare`, this check would have flagged them as unused had it been live (verify by running pre-uninstall)
- (c) Allowlist supports `[unused_deps]` section — vendored types-only deps, build-tooling deps that don't import directly, etc.

### M3 — CI step → fixture binding check (1 day)

**What:** Parse `.github/workflows/*.yml` looking for `run:` steps that reference paths under `tests/`, `scripts/`, `src/`, etc. For each, verify the path exists. The CI workflow recently had a "broken setup" because `deploy-staging` referenced a deleted Pages project — this check would have caught that class.

**Gate G-M3:**
- (a) Synthetic broken workflow (e.g., reference to `tests/nonexistent.test.ts`) triggers a violation
- (b) All current workflow steps pass (no references to missing files)
- (c) Allowlist supports `[ci_step_fixtures]` for runtime-generated test data

### M4 — CI workflow integration (0.5 days)

**What:** Add a step to `.github/workflows/quality-gates.yml`:

```yaml
- name: Drift Audit
  run: node scripts/audit/runner.ts
  continue-on-error: false
```

Make it a required check on `main` via branch protection (separate manual step, called out in the merge runbook).

**Gate G-M4:**
- (a) Quality-gates workflow runs the audit; passes when state is clean
- (b) A deliberately-broken PR (e.g., delete a routed page without removing the route) fails the audit step
- (c) Stop hook continues to work via the migrated wrappers

### M5 — Allowlist backfill (0.5 days)

**What:** Walk the current state, populate `scripts/audit/allowlist.toml` with intentional drift items:

- Parked-features paths from `CLAUDE.md` (`src/workflows/`, `src/workers/crawl4ai-worker.ts`, etc.)
- Existing orphan-pages allowlist entries (migrate from `frontend/.orphan-pages-allowlist`)
- Vendored or build-tooling deps surfaced by M2
- Any in-flight WIP (cite branch/PR)

**Gate G-M5:**
- (a) `node scripts/audit/runner.ts` returns exit 0 against current main
- (b) Each allowlist entry has a non-empty comment
- (c) `scripts/audit/runner.ts --check-allowlist-comments` returns 0 violations (no empty comments)

### Phase 1 — Honest total

- Prerequisites: folded into M1
- M1–M5: **4 days** active engineering
- Soak: 1 week of CI runs to surface unexpected drift in unfamiliar code paths

## Phase 2 — Expansion (5 new checks surfaced today)

### M6 — Library import → runtime call (1 day, AST-based)

**What:** For each `import { X } from 'lib'`, verify at least one `X(...)` or `X.method(...)` call exists in the same file (or in any file importing the symbol downstream). The BA-import case was the canonical instance — `betterAuth` and `withCloudflare` were imported but never invoked.

Uses TypeScript Compiler API (already a project dep via `tsc`).

**Gate G-M6:**
- (a) Synthetic file with `import { foo } from 'lib'; const x = 1;` (no `foo(...)` use) triggers violation
- (b) Re-running pre-rip on PR #70's parent commit would have flagged the BA imports (regression test for the rip itself)
- (c) Allowlist supports `[unused_imports]` for type-only imports already typed but not invoked (TypeScript-typed-but-not-runtime patterns)

### M7 — DO class export → wrangler new_classes binding (0.5 days)

**What:** For each `export { X } from './durable-objects/...'` in `src/worker-integrated.ts`, verify `X` is in `wrangler.toml` `[[migrations]] new_classes`. Surfaces the `ContainerOrchestrator` + `JobScheduler` orphans (issue #73).

**Gate G-M7:**
- (a) Current state surfaces 2 violations matching #73's contents
- (b) Allowlist supports `[do_bindings]` — parked DOs cite the parking issue
- (c) After #73 resolves, this check returns 0 violations

### M8 — Module reference → file existence (0.5 days)

**What:** For each `import './X'` or `await import('./X')`, verify `X.ts`, `X.tsx`, or `X/index.ts` exists. TSC catches these at compile time but the audit surfaces them in a unified report alongside other drift.

**Gate G-M8:**
- (a) Current state surfaces the 3 `await import('./db')` violations from issue #71
- (b) Allowlist supports `[module_resolution]` (rarely needed; mostly for dynamic-loaded plugins not in tree)

### M9 — AE write target → wrangler binding (0.5 days)

**What:** For each `env.<X>.writeDataPoint(...)`, verify `<X>` is a binding declared in `wrangler.toml` `[[analytics_engine_datasets]]`. Surfaces the `PITCHEY_PERFORMANCE` + `TRACE_ANALYTICS` orphans (issue #77).

**Gate G-M9:**
- (a) Current state surfaces 2 violations matching #77's contents
- (b) After #77 resolves, this check returns 0 violations
- (c) Allowlist supports `[ae_bindings]` — extremely rarely needed

### M10 — Strategy-doc action → wrangler binding (1 day, markdown parse)

**What:** Parse `docs/strategy-five-pillars-*.md` and `docs/orchestrator-decomposition.md` for "bounded actions" or named bindings (Hyperdrive cache, NotificationHub, WebSocketRoom, etc.). Verify each named binding exists in `wrangler.toml`. Surfaces the original Hyperdrive drift if it had been listed without binding (it has been corrected, but the check guards against re-introduction).

**Gate G-M10:**
- (a) Synthetic strategy-doc edit adding a "flush Foo cache" action where `Foo` isn't a binding triggers violation
- (b) Current state passes (Hyperdrive correction landed in PR #74)
- (c) Allowlist supports `[strategy_doc]` for forward-looking actions explicitly marked "deferred until binding exists"

### Phase 2 — Honest total

- M6–M10: **3.5 days** active engineering
- Soak: 1 additional week (combined with Phase 1's soak if M6–M10 ship in close succession)

## Critical path

```
P1, P2 ──► M1 (framework) ──► M2 (unused-deps) ──► M3 (ci-fixtures) ──► M4 (CI hook) ──► M5 (backfill) ──► PHASE 1 SHIPS

PHASE 1 SHIPS ──► M6 (unused-imports) ──► M7 (do-bindings) ──► M8 (module-resolution) ──► M9 (ae-bindings) ──► M10 (strategy-doc) ──► PHASE 2 SHIPS
```

**Parallel opportunities:**
- M2 and M3 can run in parallel after M1 lands
- M6–M10 are largely independent of each other; can split across multiple engineers

## Honest total (combined)

- Phase 1: **4 days** active + 1-week soak
- Phase 2: **3.5 days** active + 1-week soak (overlapping)
- Grand total: **~8 days active engineering + 2-week soak**

This is comparable to orchestrator (13.5 days) but with much shorter soak windows because audit-script soak is "did we surface new drift?" not "did we cause an outage?" — observability not autonomous action.

## Out of scope (explicitly)

- **Auto-fix mode** — the audit reports drift, doesn't fix it. Fix decisions are human judgments (allowlist with reason vs. fix the source). Auto-fix would re-introduce the silent-failure pattern this audit is designed to catch.
- **Real-time CI gating on every PR** — Phase 1 ships as a required check on `main` only initially. Tightening to all branches comes after the soak proves false-positive rate is manageable.
- **Cross-repo drift** — only catches drift within this repo. Cross-repo (e.g., frontend deployment URL pointing at a Worker URL that doesn't exist) requires API calls during audit; deferred.
- **Performance regression detection** — not drift, that's observability. Pillar 2 (unit-economics dashboard) covers it.

## Why this scoping was worth doing

The original #20 framing was 3 checks. Today's session added 5 more. Without this scoping, the user would have either:
1. Built the original 3 and stopped (missing 5 surfaces of drift now known)
2. Built all 8 in one mega-PR (risky, hard to land cleanly)

The Phase 1 / Phase 2 split is the right path: ship the framework + 3 original checks first, prove the model, then expand to 5 more in a follow-up. **Each phase's soak surfaces the next phase's content** — Phase 1's allowlist backfill teaches us what shapes of drift exist that we hadn't categorized; Phase 2 covers the residual.

## Maintenance

Update this doc when:
- A milestone ships → mark complete with merge commit
- A new drift surface is discovered → add to the check inventory, estimate the cost
- Allowlist hygiene review finds entries older than 90 days needing re-justification

Do not maintain on a calendar.
