# R9 — Reconcile catch-swallow residue (0 vs 34) + instrument WebSocket path

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker backend `src/worker-integrated.ts`, raw SQL via @neondatabase/serverless, React frontend, Neon Postgres, Sentry + Axiom observability). Branch off `main`.

# Goal
Two linked tasks in the "operational reliability / silent-breakage" band:
1. Reconcile the catch-swallow gate's reported residue against a raw grep. The orchestrator (pillar 3) prerequisite depends on the gate being TRUTHFUL at threshold 0. One source says 0 untagged remain in `src/`; another grep-based audit found ~34 untagged `.catch(() => …)`. Find which is stale, then tag/fix the delta so the gate's "0 untagged" claim is real.
2. Close the WebSocket observability blind spot: the WS upgrade path in `src/worker-integrated.ts` (~line 22240) explicitly bypasses BOTH Sentry AND Axiom. Realtime auth/NDA push events are therefore invisible. Add Sentry breadcrumbs + Axiom logging to that path and to `src/auth/legacy-session-handler.ts` (WS auth).

# Files in scope
- `scripts/catch-swallow-gate.mjs` — the gate (classifies `.catch(() => …)` by prior-line tag; `--include-worker --threshold 0 --list`).
- `src/worker-integrated.ts` — WS upgrade short-circuit (~22240): currently `if (upgradeHeader === 'websocket') { console.log(...); return workerHandler.fetch(...) }` returns BEFORE Sentry/Axiom wrapping.
- `src/auth/legacy-session-handler.ts` — WebSocket session auth.
- Any `src/**` files surfaced by the grep/gate delta.
- `.github/workflows/ci-cd.yml:141` — CI invocation (verify only; do not weaken).

# Pre-flight checks (run first, report findings before editing)
1. Run the gate exactly as CI does:
   `node scripts/catch-swallow-gate.mjs --include-worker --threshold 0 --list`
   Record the untagged count and the listed sites. Note its exit code.
2. Run a raw grep for the same antipattern across the live source:
   `grep -rEn "\.catch\(\s*\(\s*\)\s*=>" src/ | grep -v "request.json"`
   Count and list. Compare against the gate's output.
3. Diff the two lists. Classify each site only present in the grep (gate missed it) vs only counted by the gate. Explain WHY they differ — likely causes: the gate's tag-walk logic (it walks back through closing backticks / blank lines for multi-line templates), `EXCLUDED_DIRS` (`workers`), `EXCLUDED_FILES` (`db/safe-query.ts`), or the `request.json().catch(() => ({}))` body-parse idiom being legitimately exempt. State explicitly which tool is stale and why. Do NOT change code until this is reported.
4. Confirm CI invocation: `grep -n "catch-swallow-gate" .github/workflows/ci-cd.yml` — verify `--include-worker` is actually passed and not silently dropped (GH Actions silently ignores unknown inputs — also scan any recent job log for `Unexpected input` if available).
5. Read the WS path: `sed -n '22230,22255p' src/worker-integrated.ts` and read `src/auth/legacy-session-handler.ts` end-to-end. Identify where `createAxiomLogger(env)` is constructed and how the non-WS path logs, so WS logging matches the existing shape.

# Implementation
A. Reconcile the delta. For each genuinely untagged site found:
   - If it is a fire-and-forget telemetry/best-effort write whose failure the user is NEVER told about → tag `// fire-and-forget` on the immediately-preceding line (matching the gate's tag convention).
   - If it is a read-side query returning a zero-ish default → migrate to `safeQuery()` from `src/db/safe-query.ts` (discriminated union, reports to Sentry) OR tag `// TODO(catch-swallow): migrate` if migration is out of scope, and surface the error.
   - If failure is on a path the user is told SUCCEEDED → it MUST propagate to the handler `try/catch` (do not swallow, do not tag). See gate G1 below.
   - If the gate is the stale one (over/under-counting due to its tag-walk or exclusions), fix `scripts/catch-swallow-gate.mjs` so its count matches reality, and document the exclusion rationale inline.
   - End state: `node scripts/catch-swallow-gate.mjs --include-worker --threshold 0 --list` exits 0 with 0 untagged, AND the raw grep delta is fully explained (every remaining grep hit is either the exempt `request.json` idiom, an explicitly-tagged site, or a documented exclusion).
B. Instrument the WS path. In the `~22240` block, before/around `return workerHandler.fetch(...)`:
   - Add a Sentry breadcrumb (e.g. `Sentry.addBreadcrumb({ category: 'websocket', message: 'WS upgrade', level: 'info', data: {...} })`) so realtime connect events appear in error context. Keep it cheap and non-blocking. Do NOT wrap the WS upgrade in `Sentry.withSentry` if that breaks the upgrade response — a breadcrumb / manual capture is sufficient.
   - Add an Axiom log line via the existing `axiomLogger` (the `console.log('[WebSocket Handler] Bypassing Sentry...')` comment says Axiom is skipped because there's no normal HTTP response — replace that with an explicit `axiomLogger.log(...)`/flush call so the connect event is recorded). Ensure the logger is flushed before returning (use `ctx.waitUntil(...)` if the flush is async) so the log isn't dropped when the upgrade response returns.
   - In `legacy-session-handler.ts`, add Axiom logging + Sentry breadcrumbs for WS auth outcomes (success / invalid session / rejected), so realtime auth failures are observable. Match the structured-log shape used elsewhere (requestId/traceId if available).
   - Keep all added observability fire-and-forget and non-throwing — it must NEVER break a WS connection. Tag any new best-effort `.catch` you add per the gate convention.

# Verification gates (all must pass before merge)
G1 — No laundering: any newly-added `// fire-and-forget` tag must be on a path where the user is NOT told the operation succeeded. Re-read each tag you add; if the swallowed call backs a user-facing success response, REMOVE the tag and propagate the error to the handler `try/catch` instead. (Locked rule: a fire-and-forget tag on a user-success path is laundering, same #20 shape.)
G2 — Gate truthful at 0: `node scripts/catch-swallow-gate.mjs --include-worker --threshold 0 --list` exits 0, and the raw grep delta from pre-flight is fully accounted for (paste the before/after counts in the PR body).
G3 — CI invocation intact: `.github/workflows/ci-cd.yml:141` still runs `--include-worker --threshold 0`; the flag is not silently dropped (no `Unexpected input` in the job). Do not lower the threshold or remove `--include-worker`.
G4 — WS not broken: the WS upgrade still returns the upgrade response correctly (added observability is non-throwing, flushed via `ctx.waitUntil`); a local/preview WS connect still succeeds. Confirm by tracing the code path and, if feasible, a `wrangler tail` showing the new Axiom/breadcrumb line on a real WS connect.
G5 — Type check + build: `npx tsc --noEmit` on the worker tsconfig passes (note: the worker is NOT type-checked in CI, so run it locally), and `npm run build:worker` (or the repo's worker build) succeeds — watch for backticks inside `sql\`\`` templates breaking the build.

# Notes
- Pre-flight rule: before editing the WS handler, confirm it is the LIVE path (`grep -n "upgradeHeader" src/worker-integrated.ts`) — `worker-integrated.ts` is the only live router; ignore orphan WS handlers elsewhere.
- Do not touch parked paths `src/workflows/` or `src/workers/` (crawl4ai) — the gate already excludes `workers`.
- Keep the PR focused: reconciliation + WS instrumentation only. Open the PR against `main` with the before/after gate+grep counts and the explanation of which source was stale.
