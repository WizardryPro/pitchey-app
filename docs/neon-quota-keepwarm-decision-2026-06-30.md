# Neon compute-quota: detection, keep-warm, and plan decision (2026-06-30, R6)

## Context

Neon compute-quota exhaustion is the single highest operational risk for launch.
When the plan's compute-time quota is spent, Neon returns **HTTP 402 on every
query**, which cascades into login 503s and a silently-empty marketplace (errors
swallowed). It has taken prod down twice: **2026-04-30 (#65)** and **2026-06-22**.

This doc records the detection added in R6 and the keep-warm / plan decision.

## Two different 402s — do not conflate

| 402 | Source | Meaning |
|-----|--------|---------|
| **Neon compute-quota 402** | Neon query layer | Infra quota exhausted → every query 402s. *This is the outage.* |
| **App `INSUFFICIENT_FUNDS` 402** | `src/utils/api-response.ts` → credit/payment handlers (`worker-integrated.ts:7198/7353/20769/20976`) | Our own "not enough credits" response. Normal. |

These never share a code path: the app 402 is a `Response` object built in payment
handlers; the Neon 402 is a thrown `NeonDbError` caught in the `/api/health` DB
probe. The R6 `neon_quota` classifier only inspects the DB-probe catch, so an app
402 can never trip it and a Neon 402 is never mistaken for credits.

## Detection added in R6

**Reactive (worker, `handleHealth`):** a new `neon_quota` service in `/api/health`.
`ok` normally; `exhausted` when the DB probe throws a compute-quota-402 signature
(`402` / `quota` / `compute time` / `exceeded`). `/api/health` still returns **200
with a degraded body** so the CI parser can read it. Because the CI per-service
gate treats anything outside `{connected,active,ok,healthy}` as unhealthy, an
`exhausted` value automatically fires the existing Slack + GitHub-issue alert — no
new alert channel.

**Proactive (CI, `simple-health-check.yml`):** the worker has **no `NEON_API_KEY`
secret** (verified via `wrangler secret list`), so it cannot read Neon's usage API.
The before-exhaustion signal therefore lives in CI: a control-plane call (zero DB
compute) reads `project.cpu_used_sec` vs the quota window and fails at **≥ 85%**
when a ceiling is configured. Cron tightened **hourly → every 15 min** to cut
detection latency.

### Action required to arm the proactive threshold

The proactive check is **log-only until a ceiling is set**. Set the repo variable
once the plan's compute-time quota (in seconds) is known:

```
gh variable set NEON_COMPUTE_QUOTA_SEC --body "<plan compute-seconds per window>"
```

Until then the step logs `cpu_used_sec` each run for trend visibility but does not
page (no false alarm on an unknown ceiling). The reactive `exhausted` catch still
pages the moment a real 402 storm begins.

## Keep-warm burn analysis → verdict: **stays OFF**

`KEEP_WARM_DB` (`wrangler.toml:168 = "false"`) gates `keepDatabaseWarm()`
(`worker-integrated.ts:22512`), which `SELECT 1`s on the `*/5` cron to close
Neon's autosuspend cold-start gap.

**Burn math (current period):**
- Observed: `cpu_used_sec ≈ 132,036` s ≈ **36.7 active compute-hours** this quota
  window (so Neon *is* autosuspending during idle — it is not pinned on).
- Keep-warm at `*/5` = **288 pings/day**. A ping every 5 min holds Neon awake
  ~continuously, i.e. ~**730 compute-hours/month** at the 0.25 CU floor.
- That is **~20× the current burn** — keep-warm would *accelerate* the exact quota
  exhaustion it is meant to soften.

**Verdict: UNSAFE on the current plan. `KEEP_WARM_DB` stays `false`** (wrangler.toml
unchanged). Cold-start 530/1016 races are already handled by the DB retry
classifier (see `project_neon_coldstart_retry`); that is the cheaper mitigation.

## Plan recommendation

The probe only buys warning time; the real fix is plan capacity. Recommended:
**upgrade the Neon plan to one whose compute-time allowance comfortably exceeds the
trailing usage with launch headroom, keeping autosuspend ON** (so idle periods stay
cheap). Do **not** solve this by pinning compute on / enabling keep-warm. Once the
new plan's quota is known, set `NEON_COMPUTE_QUOTA_SEC` so the proactive check has
teeth. This is an owner/billing decision — the code change here makes the outage
*observable*; the plan change makes it *not happen*.
