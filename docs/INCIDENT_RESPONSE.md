# Incident Response

How to triage, communicate, recover, and learn from production incidents on Pitchey.
This is deliberately small and honest: Pitchey is **single-operator** (one owner,
no on-call rotation, no paid status page). The procedures below assume that reality
rather than a fictional org chart — the goal is that one person at 2am can follow it.

Recovery procedures referenced here live in:
- **[Rollback drill runbook](ROLLBACK_DRILL_RUNBOOK.md)** — how `wrangler rollback` works + the repaired `scripts/rollback-deployment.sh`.
- **[Observability](OBSERVABILITY.md)**, **[Logging](LOGGING.md)**, **[Sentry](SENTRY_ERROR_TRACKING.md)**, **[Monitoring guide](monitoring-guide.md)**.

---

## Severity matrix

| Sev | Definition | Examples | Target response |
|-----|------------|----------|-----------------|
| **SEV1** | Platform down or money/data at risk | Worker 5xx for all routes; DB unreachable; Stripe webhooks failing (revenue/credits wrong); auth fully broken; data-loss risk | Drop everything. Triage in minutes. Roll back first, diagnose second. |
| **SEV2** | Major feature broken, platform up | One portal/flow down (e.g. pitch create 500s); login degraded but partial; Redis down (cache only); email not sending | Same session. Stabilise, then root-cause. |
| **SEV3** | Minor / cosmetic / single-user | One endpoint slow; a non-critical 4xx; a stale UI string; an isolated user report | Next working block. Fix at root, don't hotfix-and-forget. |

**When unsure, treat it as one level more severe** until proven otherwise.

---

## First 5 minutes (any severity)

1. **Confirm it's real, not your network.**
   ```bash
   curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq .data
   ```
   `data.status` is `ok` / `degraded`; `data.services` breaks down `database`, `redis`,
   `stripe`, `email`, `rateLimit`. This one call usually names the failing dependency.

2. **Check the front door.**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://pitchey-api-prod.ndlovucavelle.workers.dev/api/plans   # worker
   curl -s -o /dev/null -w '%{http_code}\n' https://pitchey-5o8.pages.dev/                                  # frontend
   ```

3. **Was it a deploy?** If the incident started right after a merge/deploy, suspect the
   deploy first — **roll back before diagnosing** (SEV1/2). See *Bad deploy* below.

4. **Look at live errors.**
   ```bash
   npx wrangler tail --format=json | grep -iE '"level":"error"|does not exist|timeout'
   ```
   Plus Sentry (recent issues / spike) and Axiom (`pitchey-logs`) for structured context.

5. **Classify severity** (table above) and act accordingly.

---

## Who does what

Single operator. There is no escalation *ladder* so much as an **escalation to vendors**:

| If the failing dependency is… | Escalate to / check |
|---|---|
| Database (Neon) | Neon status + dashboard; check connection string / password rotation (see note) |
| Cache (Upstash Redis) | Upstash status + console |
| Payments (Stripe) | Stripe status + Dashboard → Developers → Webhooks/Events |
| Email (Resend) | Resend status + dashboard |
| Edge / Worker / Pages / R2 | Cloudflare status (cloudflarestatus.com) + CF dashboard |

**Neon password-rotation gotcha:** rotating the Neon password is prod-affecting — the old
password stops working minutes-to-hours later. If a DB outage correlates with a recent
rotation, push the new `DATABASE_URL` to the Worker secret immediately. (This took prod
down on 2026-04-23.)

If the dependency's own status page is green and `/api/health` still flags it, it's almost
certainly **our** config/code (wrong secret, schema drift, bad deploy) — go to recovery.

---

## Diagnosis by signal

| Symptom | Most likely | Where to look |
|---|---|---|
| `relation "X"/column "X.Y" does not exist` in logs | Schema drift (a migration not applied) | `wrangler tail`; Cloudflare Observability `$metadata.level=error`; fix = numbered migration with `IF NOT EXISTS` |
| All routes 5xx right after a deploy | Bad deploy | Roll back (below) |
| `/api/health` database `degraded` | Neon down, bad `DATABASE_URL`, or DNS cold-start race | Neon dashboard; re-check secret |
| 401 storm / login failures | Auth/session or secret issue; or brute force | `src/lib/auth-observability.ts` (5+ fails/15min flagged); Sentry |
| Stripe webhooks 4xx/!200 | Signature/secret drift or handler error | Stripe Dashboard → Webhooks; `/api/webhooks/stripe` is HMAC-gated, public endpoint |
| Worker CPU near 50ms / timeouts | Hot path regression | CF Observability request duration; thresholds below |

### Thresholds (from CLAUDE.md observability)

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | 2000ms | — |
| Error rate | 1% | 5% |
| Worker CPU | 45ms | 50ms (CF hard limit) |
| Cache hit rate | <60% | — |
| Login failures | 5 / 15min | 10+ same IP |

---

## Recovery procedures

### Bad deploy → roll back (most common SEV1/2)

The Worker is the usual culprit. Fastest restore is `wrangler rollback`; the repaired
script wraps it with fallbacks.

```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
# Option A — surgical: revert to the previous worker version
npx wrangler rollback -y -m "incident <date>: rollback bad deploy"
# Option B — scripted (tries rollback, else deploys a 503 maintenance worker)
bash scripts/rollback-deployment.sh --worker
# Verify
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq .data.status   # → "ok"
```
See **[ROLLBACK_DRILL_RUNBOOK.md](ROLLBACK_DRILL_RUNBOOK.md)** for semantics (rollback creates
a *new* version copying the target — verify by behaviour + `/api/health`, not version-id).

### Roll forward a fix

When the fix is known and small, forward-deploy known-good code instead of rolling back:
```bash
git fetch origin && git checkout main && git pull
npx wrangler deploy -m "incident <date>: <fix>"
```

### Schema drift

Write a numbered migration (`src/db/migrations/NNN_desc.sql`) using `IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS`, test on a Neon branch, apply to prod, record via `scripts/migrate.mjs`,
then redeploy if code changed. (Full workflow in CLAUDE.md → "Schema Drift Detection".)

### Dependency outage (DB/Redis/Stripe/Email)

Pitchey degrades rather than hard-fails for some of these (Redis is cache-only; email is
best-effort). If the dependency is genuinely down and ours is correctly configured, the
honest move is **maintenance mode** until the vendor recovers:
```bash
bash scripts/rollback-deployment.sh --all    # worker 503 + frontend maintenance page
```

### Total frontend outage

```bash
cd frontend && npx wrangler pages deploy dist/ --project-name=pitchey --branch=main
# (--branch=main is REQUIRED for the canonical URL; without it you publish a preview)
```

---

## Communication

There is **no paid status page**. `pitchey.com` is a separate marketing stub, not the app.
During a SEV1, the user-facing signal *is* the maintenance page deployed by
`rollback-deployment.sh --all` (a 503 + "we'll be right back"). That is the status page.

- **SEV1:** put up the maintenance page if recovery will take more than a few minutes; take
  it down (forward-deploy) the moment service is restored.
- **Alerts** already route automatically: `simple-health-check.yml` posts to Slack
  (`SLACK_WEBHOOK` secret) on failure, or opens a deduplicated GitHub issue labelled
  `health-check-failure`. Acknowledge by commenting on / closing that issue when resolved.
- If real users are affected and you have their contact (e.g. demo/early users), a short
  honest note after recovery beats silence.

---

## Post-mortem template

Write one for every SEV1 and any SEV2 that recurs. Blameless — the system let it happen.
Save as `docs/postmortems/YYYY-MM-DD-<slug>.md`.

```markdown
# Post-mortem: <title>

- **Date / duration:** <start> → <restored> (<total>)
- **Severity:** SEV<n>
- **Author:** <name>

## Impact
Who/what was affected, for how long, and how it surfaced (alert? user report? Sentry?).

## Timeline (UTC)
- HH:MM — first signal
- HH:MM — triaged / severity set
- HH:MM — mitigation (rollback / fix / maintenance mode)
- HH:MM — service restored
- HH:MM — all-clear

## Root cause
The actual cause, not the symptom. (Schema drift? Bad deploy? Secret rotation? Vendor outage?)

## What went well / what hurt
Did the alert fire? Did the rollback work first try? What slowed recovery?

## Action items
- [ ] Root fix (link PR) — owner — due
- [ ] Guardrail so this class can't recur (test/gate/migration/monitor) — owner — due
- [ ] Doc/runbook update if a step was missing or wrong
```

---

## After an incident

1. File the post-mortem (above) for SEV1/recurring SEV2.
2. Turn the root cause into a **guardrail**, not just a fix — a test in the now-gating vitest
   suite, a migration, a `safeQuery` so the error reaches Sentry instead of being swallowed,
   or a new health probe. Every incident should make the next one less likely or louder.
3. If a step in *this* doc was wrong or missing, fix it here while it's fresh.
