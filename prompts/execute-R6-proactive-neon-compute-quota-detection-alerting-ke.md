# R6 — Proactive Neon compute-quota detection + alerting + keep-warm decision

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker backend in `src/worker-integrated.ts`, raw SQL via `@neondatabase/serverless`, no ORM; Neon Postgres; React/Vite frontend; Stripe live; Sentry/Axiom observability). Branch off `main` (do NOT commit to main directly).

GOAL
Neon compute-quota exhaustion is the single highest operational risk for launch. When the Neon plan hits its compute-time quota, Neon returns HTTP 402 on EVERY query, which cascades into login 503s and a silently-empty marketplace (errors are swallowed). This has already taken prod down twice: 2026-04-30 (#65) and 2026-06-22. Today there is NO quota probe, `KEEP_WARM_DB` is gated OFF, and `simple-health-check` runs only hourly (up-to-1h detection latency).

Deliver three things:
1. A compute-headroom / quota probe wired into `/api/health` that reports `degraded` BEFORE full exhaustion (not just after queries start failing).
2. The existing health-check failure alert path (Slack + deduplicated GitHub issue) actually firing on this new degraded signal, verified end-to-end with a synthetic degraded response.
3. A DOCUMENTED decision (committed as a markdown doc) on whether to enable `KEEP_WARM_DB` and/or change the Neon plan tier — with the keep-warm burn-rate question answered before any enable.

CRITICAL DISTINCTION (do not conflate these — the codebase currently does):
- Neon compute-quota 402 = infrastructure quota exhausted; Neon's API/query layer returns it. This is what we are detecting.
- Application HTTP 402 `INSUFFICIENT_FUNDS` = our own Stripe/credits responses. The probe and alert MUST NOT treat an app-level 402 as a Neon outage, and vice versa. Grep for existing 402 usage before writing any code: `grep -rn "402" src/worker-integrated.ts src/utils src/db` and `grep -rn "INSUFFICIENT_FUNDS" src/`.

PRE-FLIGHT (do these first, report findings before editing code)
- Read the live health handler: `grep -n "handleHealth\|/api/health" src/worker-integrated.ts`, then read the full `handleHealth` function. Confirm it is the LIVE route (registered in `worker-integrated.ts`) — per repo convention, a handler is orphaned if it is not wired through `worker-integrated.ts`.
- Read how DB is currently probed inside `handleHealth` (it already checks DB, Upstash Redis, Stripe, Resend and reports `ok`/`degraded`). Reuse that structure; add a quota dimension, do not rewrite it.
- Read `.github/workflows/simple-health-check.yml` end to end. Identify: the cron schedule, the URL it hits (must be `https://pitchey-api-prod.ndlovucavelle.workers.dev` per repo facts — NOT a `cavelltheleaddev` host, which is a stale orphan), how it parses the JSON response, and exactly how it routes a failure to Slack + opens the deduplicated GitHub issue (labels `health-check-failure`). Note whether it currently fails on `degraded` or only on hard non-200/`down`.
- Read `wrangler.toml` for the `KEEP_WARM_DB` var/flag and any keep-warm cron/scheduled handler. Find where it is gated off and the cron it would run on: `grep -n "KEEP_WARM_DB\|keep.?warm\|scheduled" wrangler.toml src/worker-integrated.ts`.
- Determine how (or whether) Neon exposes compute/quota headroom. Check: (a) is there a Neon API key available to the worker or to CI (the repo notes `NEON_API_KEY` exists as a GitHub secret and in `.mcp.json`)? (b) Does Neon's consumption/usage API expose compute-time-used vs quota for the project/branch? Prefer a cheap signal that does NOT itself burn meaningful compute. Document what signal you chose and why.

IMPLEMENTATION
1. Quota probe (`src/worker-integrated.ts`, inside/adjacent to `handleHealth`):
   - Add a `neon_quota` (or similarly named) dimension to the health response with states: `ok` (headroom > warn threshold), `degraded` (headroom below warn threshold but queries still succeeding), `exhausted` (Neon returning 402 on queries).
   - Detection approach: combine (a) catching a Neon 402 from a lightweight probe query and classifying it explicitly as compute-quota (distinct from app 402), and — if a Neon usage API signal is available — (b) reading compute-time-used vs quota to surface `degraded` proactively BEFORE exhaustion. If no usage API is reachable from the worker, document that limitation and fall back to: probe-query 402 detection plus a CI-side usage check (see step 3 option).
   - When the probe detects compute-quota trouble, set the overall health status to `degraded` (not `ok`), include a clear machine-parseable field (e.g. `checks.neon_quota.status`) and a human reason string.
   - Do NOT swallow the probe error. Follow repo convention: `const e = err instanceof Error ? err : new Error(String(err))`. Report to Sentry if appropriate. Do NOT use the `.catch(() => default)` antipattern — the catch-swallow gate runs `--include-worker --threshold 0`.
   - Make the probe cheap and resilient: a `degraded`/`exhausted` Neon state must NOT make `/api/health` itself throw a 500 — health must always return 200 with a structured degraded body so the CI parser can read it.

2. Alert wiring (`.github/workflows/simple-health-check.yml`):
   - Make the workflow treat the new `neon_quota` `degraded`/`exhausted` signal as an alert-worthy condition that routes to the SAME existing Slack + deduplicated-GitHub-issue path (reuse `health-check-failure` label and the existing dedup logic — do not invent a second alert mechanism).
   - Detection latency is currently up to 1h. Reduce the cron interval for THIS check (e.g. every 10-15 min) IF it does not materially increase Neon compute burn — note that the health probe itself runs a query, so a tighter cron trades detection latency against burn. State the chosen interval and the burn reasoning in the PR description. Consider making the quota dimension query as cheap as possible (or reading a cached/usage-API value) so a tighter cron is safe.

3. KEEP_WARM_DB + Neon plan decision (new doc, e.g. `docs/neon-quota-keepwarm-decision-2026-06-30.md`):
   - Record WHY keep-warm was gated off (the concern: its own periodic DB pings accelerate quota burn).
   - Quantify the burn: estimate keep-warm cron frequency × per-ping compute cost vs. the current plan's compute-time quota. Conclude explicitly whether enabling keep-warm is net-positive (fewer cold-start 530/1016 races, see `project_neon_coldstart_retry`) or net-negative (accelerates the very quota exhaustion we are trying to prevent).
   - Make a recommendation on Neon plan tier (the current plan can hit compute-time quota → 402; a plan decision is the real fix, the probe just buys warning time).
   - Do NOT flip `KEEP_WARM_DB` on in this PR unless the burn math in the doc clearly shows it is safe AND gate G3 below passes. If it stays off, say so and leave `wrangler.toml` unchanged for that flag.

VERIFICATION GATES (all must pass before merge — record evidence in the PR description)
- G1 — 402 disambiguation: Show that the probe classifies a Neon compute-quota 402 distinctly from an application-level HTTP 402 `INSUFFICIENT_FUNDS`. Provide the code path + a unit/inline test or a documented manual trace proving an app 402 does NOT trip `neon_quota` and a Neon 402 does NOT get mistaken for app credits. (Grep evidence that the two 402 sources are handled in separate code paths.)
- G2 — alert actually pages: Trigger the alert path with a SYNTHETIC degraded `/api/health` response (e.g. temporarily force `neon_quota: degraded`, or run the workflow against a stub/fixture returning the degraded body) and show that the workflow routes to Slack AND opens (or dedups onto) the `health-check-failure` GitHub issue. Paste the workflow run link / issue link / Slack confirmation. A green workflow that never exercised the failure branch does NOT satisfy G2.
- G3 — keep-warm burn safety: The decision doc contains the burn-rate math (ping frequency × compute cost vs quota) and an explicit safe/unsafe verdict. `KEEP_WARM_DB` is only enabled if the verdict is "safe" AND the math is shown. If unsafe or unknown, the flag stays off and the doc says why.
- G4 — health stays 200 under degraded/exhausted: Demonstrate `/api/health` returns HTTP 200 with a structured `degraded` body (not a 500) when the quota dimension is degraded/exhausted, so the CI parser can read it. Show the response shape.
- G5 — no catch-swallow regression: The catch-swallow gate (`--include-worker --threshold 0`) still passes; the new probe surfaces errors rather than returning a silent zero/default.

CONVENTIONS / GUARDRAILS
- TypeScript, raw SQL only. `credentials: 'include'` n/a here (server-side).
- Confirm the live API host is `pitchey-api-prod.ndlovucavelle.workers.dev`; ignore any `cavelltheleaddev` host (stale orphan that perpetually fails its DB health probe).
- Do not touch parked paths (`src/workflows/`, `src/workers/crawl4ai-worker.ts`, `src/services/console-analysis-crawler.ts`).
- Open a PR against `main` with the G1-G5 evidence block in the description. Do not merge yourself; leave it for review.

Start by doing the PRE-FLIGHT reads and reporting what you find (live health handler shape, current simple-health-check alert mechanism, KEEP_WARM_DB gating, and whether a Neon usage/quota signal is reachable) BEFORE writing any code.
