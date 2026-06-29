# R3 — Pre-deploy Stripe live-key gate + reconcile-cron alert teeth

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker live router `src/worker-integrated.ts`, raw SQL via @neondatabase/serverless, React/Vite frontend, Neon Postgres, Stripe LIVE, Sentry + Axiom + Slack alerting). Stripe is in production. Two payment-integrity gaps need closing. Do NOT touch parked code under `src/workflows/` or `src/workers/crawl4ai-worker.ts`.

GOAL
1. Add a CI gate to the production deploy workflow that BLOCKS the deploy if, when ENVIRONMENT=production, `STRIPE_SECRET_KEY` does not start with `sk_live_`. A test `sk_test_` key in prod silently drops ALL Stripe webhook deliveries (test secret can't verify live signatures) — runtime only logs+Sentry today (worker-integrated.ts:11396), nothing blocks the deploy.
2. Give the daily Stripe reconcile cron alert TEETH: route a `paid_no_access` drift (a customer paid in Stripe but has no active local subscription row → "I paid but I'm locked out") to the existing Slack/GitHub-issue alert path, not just a Sentry log. Reconcile is `reconcileStripeSubscriptions()` in `src/worker-integrated.ts` (~line 22427), currently LOG/Sentry-only with up to 24h lag.

PRE-FLIGHT (do these first, report findings before editing)
- `ls .github/workflows/` and read `deploy-production.yml` (and `deploy-worker.yml` — confirm which one actually runs `wrangler deploy` for the prod worker `pitchey-api-prod`). The gate must live in the workflow that performs the prod worker deploy, BEFORE the deploy step.
- Determine how the workflow obtains the secret value. `STRIPE_SECRET_KEY` is a Cloudflare Worker secret (set via `wrangler secret put`), NOT necessarily a GitHub Actions secret. Check `git grep -n "STRIPE_SECRET_KEY" .github/` and `git grep -n "secrets\." .github/workflows/deploy-production.yml`. If the live key is NOT available to CI as a GH secret, the gate must check a GH-secret mirror (e.g. add repo secret `STRIPE_SECRET_KEY` for CI-validation purposes) or `wrangler secret list` (which only shows secret NAMES, not values — so it cannot validate the prefix). Pick the approach that can actually read the prefix; document which in the PR. Do not invent a secret that doesn't exist — if no value is reachable, surface that in your report and propose the minimal addition (a CI-only `STRIPE_SECRET_KEY` GH Actions secret) rather than silently no-op'ing.
- Read worker-integrated.ts:11390-11420 (existing runtime go-live guard) and ~22420-22535 (`reconcileStripeSubscriptions`) to match existing log shape and the `paidNoAccess` block exactly.
- Find the existing Slack/issue alert path: `git grep -ln "SLACK_WEBHOOK\|slack" .github/workflows/` and read `simple-health-check.yml` (per CLAUDE.md it routes failures to Slack + opens a deduplicated GitHub issue, with `health-check-failure` / `incident` labels). Reuse this mechanism — do not build a new alerting channel.

IMPLEMENTATION
Part 1 — CI gate (deploy-production.yml or the prod-worker deploy workflow):
- Add a step that runs ONLY for the production environment, before `wrangler deploy`, e.g.:
  - `if [ "$ENVIRONMENT" = "production" ] && ! printf '%s' "$STRIPE_SECRET_KEY" | grep -q '^sk_live_'; then echo "::error::STRIPE_SECRET_KEY is not a live key (sk_live_*) — blocking production deploy"; exit 1; fi`
- Source the value from the resolved CI secret you identified in pre-flight. Never echo the key itself (only its validity). Keep it minimal — a prefix check, no value logging.
- Add a workflow-level or step-level guard so a missing/empty key also fails (empty must NOT pass).

Part 2 — reconcile alert teeth:
- The worker cron cannot directly open GitHub issues. Choose the lowest-coupling wiring that reaches the EXISTING Slack/issue path:
  - Preferred: in the `paidNoAccess.length > 0` case, POST to the Slack webhook (secret already used by the alert path; confirm the worker has it as `env.SLACK_WEBHOOK_URL` or add via `wrangler secret put` — check `wrangler.toml` / secret list). Include count + the subscription ids + `category: stripe_reconcile, action: paid_no_access_drift`. Keep it fire-and-forget but tagged `// fire-and-forget` on the prior line AND ensure the cron still records the drift in its summary log (don't let a Slack failure mask the drift). Wrap the POST in try/catch with `const e = err instanceof Error ? err : new Error(String(err))`.
  - If the worker genuinely cannot post to Slack (no webhook secret reachable), the fallback is a scheduled GH Action that reads the reconcile summary (Axiom query for `action:reconcile_complete` with `paid_no_access > 0`) and routes through the same dedup-issue logic as `simple-health-check.yml`. Pick ONE approach; justify in PR.
- Keep the existing Sentry `captureException` for `paid_no_access` — this ADDS an alert sink, it does not replace Sentry.
- Honor the catch-swallow gate: the repo runs `catch-swallow-gate.mjs --include-worker --threshold 0`. Any new `.catch`/catch must either propagate or be explicitly tagged `// fire-and-forget` AND must not tell anyone something succeeded when it didn't.

VERIFICATION GATES (all must pass before opening/merging the PR; paste evidence in the PR body)
- G1 (CI gate blocks): Prove the gate fails a prod deploy with a test key. Run the deploy workflow (or the gate step in isolation) in a dry-run with `STRIPE_SECRET_KEY=sk_test_dummy` and `ENVIRONMENT=production` and confirm the step exits non-zero with the `::error::` message. Then confirm `sk_live_dummy` passes the prefix check. Show both runs.
- G2 (CI gate doesn't false-block): Confirm non-production environments / previews skip the gate (no live key required), and an empty key in production is also blocked.
- G3 (live secret still matches): Verify the live Stripe webhook endpoint `we_1TbpEAGfa7gtG8QyNz0mMdC8` + portal `bpc_1TbpEBGfa7gtG8QyubavJQ2p` still match the deployed worker — cross-check Stripe dashboard against `wrangler secret list` for `pitchey-api-prod` (confirm `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are present). Report names (not values).
- G4 (reconcile alert fires): On a branch, inject a synthetic `paid_no_access` diff (e.g. temporarily push a fake Stripe-active id into the `paidNoAccess` array, or unit-invoke the alert branch) and confirm the Slack/issue alert actually fires through the existing path — show the Slack message or the opened/dedup'd issue. Revert the synthetic injection before merge.
- G5 (catch-swallow + typecheck clean): `node scripts/catch-swallow-gate.mjs --include-worker --threshold 0` passes; `npx tsc --noEmit` (root worker tsconfig) shows no NEW errors introduced by your change.

CONSTRAINTS
- Branch off `main` (don't commit to main). Do NOT deploy to prod yourself — the gate/PR is the deliverable; deploys go through the normal workflow after review.
- Never log the Stripe secret value anywhere. Prefix-only checks.
- Keep changes surgical: the CI workflow + the reconcile `paid_no_access` branch (+ a secret addition if pre-flight proves it's needed). No refactors of the webhook handler or the reconcile paging logic.
- PR body must end with:
  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  and the commit with the Co-Authored-By trailer.

Start by reporting the pre-flight findings (which workflow deploys the prod worker, whether the live key is reachable in CI, and the exact Slack/issue alert mechanism) BEFORE writing code.
