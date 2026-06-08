# Money-Path SLOs — 2026-06-08

Part of the money-path-safety work (Phase 3). The research bar: collecting
telemetry is not operating maturely — the gap is **reliability** SLOs on the
paths that make money, alerting on user impact rather than only on availability
("is the DB up?").

## What's monitored

A worker cron (`checkMoneyPathSLOs` in `src/worker-integrated.ts`, wired to the
hourly `0 * * * *` trigger) reads the Axiom request logs the worker already emits
(`type="request"`, `request.path`, `request.method`, `response.status`) and
computes the **5xx error rate** over the trailing hour per money path. 4xx
(validation / auth) do **not** count against the budget.

| SLI (path key) | Matches | Target | Min volume | Min errors to alert |
|---|---|---|---|---|
| `checkout` | `request.path` startswith `/api/payments` | 99% | 5 / h | 2 |
| `signup` | `request.path` contains `register` | 99% | 5 / h | 2 |
| `pitch_upload` | POST `request.path` startswith `/api/pitches` | 99% | 5 / h | 2 |

A path is in **breach** when, in the trailing hour: `total ≥ minVolume` **and**
`errors ≥ minErrors` **and** `errorRate > (1 − target)`. The min-volume /
min-errors guards suppress noise from tiny samples and single blips (launch-stage
traffic is low — better quiet than crying wolf).

Targets / matchers are defined in one place — the `MONEY_PATH_SLOS` const in
`src/worker-integrated.ts`. Adjust there.

## What fires on a breach

Each run emits a structured `category:"slo" action:"check_complete"` log with
per-path `total`/`errors`/`error_rate`/`breached` (healthy runs are visibly
healthy). On a breach it additionally:

1. logs `category:"slo" action:"slo_breach"` at **error** level (captured by
   Cloudflare Observability + Axiom), and
2. sends a **Sentry** `captureMessage` at error level, tagged `slo.breach=<key>`.

The check is pure-read and fully defensive: no `AXIOM_TOKEN` → skip; a failed or
odd-shaped APL query for one path logs and continues, never paging falsely.

## Owner action required (the "channel you actually read")

The breach signal exists; routing it to a human is dashboard config (the Sentry
MCP was removed — configure in the Sentry UI):

- **Sentry alert rule**: route events with tag `slo.breach` (or error-level
  `captureMessage` with "Money-path SLO breach") to Slack / email. Without this,
  breaches sit in Sentry unseen.
- Optionally, a Cloudflare/Axiom monitor on `category = "slo" AND action =
  "slo_breach"` can route to the same Slack webhook the health check uses.

## Verifying

After deploy, the cron runs at the top of each hour. Confirm via Cloudflare
Observability (or `wrangler tail`) for `category:"slo" action:"check_complete"` —
expect a `results` array with one entry per path (`total`/`errors`/`breached`).
A path with no traffic in the window reports `total:0 breached:false`. To
exercise the breach path before real traffic exists, temporarily lower a target's
`minVolume`/`minErrors` in `MONEY_PATH_SLOS`, redeploy, and confirm the Sentry
event + `slo_breach` log appear, then revert.
