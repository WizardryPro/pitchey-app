# Disaster Recovery

Recovering from **catastrophic loss** — data corruption, a deleted resource, a
compromised account, lost secrets — as opposed to a transient outage (that's
[INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)). The question this doc answers:
*"if X is destroyed, how do we get back, and how much do we lose?"*

> **Honesty note.** Some `scripts/*backup*.sh` / `disaster-recovery.sh` files exist but are
> **unverified and partly generic/broken** (e.g. `database-backup.sh` targets AWS S3, which
> isn't in our stack — storage is R2; `disaster-recovery.sh` uses `wrangler --env production`
> which doesn't match our deploy model and its R2 upload is a commented-out no-op). The
> rollback script had the same problem and turned out completely non-functional (see
> PR #183). **Do not trust these scripts in a real disaster until they've been audited the
> same way.** The recovery procedures below rely on **managed, always-on mechanisms** (Neon,
> git, Cloudflare versions) that don't depend on those scripts.

---

## What holds state, and its backup status

| Store | What's in it | Backup mechanism | If lost |
|-------|--------------|------------------|---------|
| **Neon PostgreSQL** | All app data (users, pitches, NDAs, feedback, credits, subscriptions) | **Neon managed history → point-in-time restore + instant branching** (always on; retention = Neon plan) | Restore via PITR/branch — see below. **This is the crown jewel.** |
| **R2 buckets** (`pitchey-pitches`, `-ndas`, `-media`, `-processed`, `-temp`, `-audit-logs`, trace) | Uploaded files (pitch docs, NDAs, media) | ⚠️ **None — versioning NOT enabled.** Overwrite/delete is permanent. | Unrecoverable unless an external copy exists. **DR gap.** |
| **Worker code** | The API | **git** (`origin/main`) + Cloudflare keeps prior **versions** | Redeploy from git; or `wrangler rollback`. |
| **Frontend** | The SPA | **git** + CF Pages deployment history | `wrangler pages deploy` from git. |
| **Secrets** (`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_*`, `RESEND_API_KEY`, `AXIOM_TOKEN`, `SENTRY_DSN`, `JWT_SECRET`, …) | Credentials | ⚠️ **None.** `wrangler secret` values are **write-only** — they cannot be read back from Cloudflare. | Must be **re-obtained from each vendor** or a password manager. **Biggest DR gap.** |
| **KV** (`SESSION_STORE`, `CACHE`, `RATE_LIMITER`, …) | Sessions + cache | None needed | Regenerates. Sessions: users re-login. Cache: cold start. |
| **Durable Objects** (`NotificationHub`, `WebSocketRoom`), **Analytics Engine** (2 datasets) | Live notification/WS state; metrics | None needed | Ephemeral / derived. AE history is lossy by design. |

**Takeaway:** Neon is the only store whose loss is unacceptable, and it has the strongest
backup (managed PITR). The two real **gaps** are **secrets** and **R2** (no versioning).
**Secrets gap is now closed** by [SECRETS_INVENTORY.md](SECRETS_INVENTORY.md) (recovery map
per vendor) + a gitignored `.secrets/vault.env` value backup (Cloud-5, 2026-06-04). R2
versioning remains in *Action items* below.

---

## RPO / RTO (current, honest)

- **RPO (data loss window):** for Neon, effectively minutes — bounded by Neon's PITR
  granularity and retention (**verify your retention window in the Neon dashboard**; free/low
  tiers retain less). For R2, RPO is **∞** (no backups) — a deleted object is gone.
- **RTO (time to restore):** Neon PITR/branch restore is minutes. A full worker+frontend
  redeploy from git is ~10 min. The long pole in a *total* disaster is **re-provisioning
  secrets** (manual, vendor-by-vendor) — could be an hour+ if not stored in a password manager.

These are estimates, not SLAs. The honest improvement levers are in *Action items*.

---

## Restore procedures by scenario

### 1. Bad data / corruption / accidental mass delete (most likely)
Neon point-in-time restore — recover the DB to just before the bad change **without losing
the whole database**:
1. Neon dashboard → project → **Branches** → create a branch from a timestamp just before the
   incident (instant, non-destructive — the current state is untouched).
2. Inspect the branch (it has its own connection string) to confirm the data is good.
3. Either: point the Worker's `DATABASE_URL` at the restored branch (fast cutover), **or**
   copy the good rows back into main. Prefer the branch cutover for speed; reconcile later.
4. Update the `DATABASE_URL` Worker secret + redeploy if you cut over.

> Neon branching is the single most valuable DR tool here — it makes "restore" non-destructive
> and reversible. Use it before any `psql` surgery.

### 2. Neon database/project lost entirely
1. If the **project** still exists but data is gone: PITR to the last good point (scenario 1).
2. If the **project** is gone: recreate a Neon project, apply the full schema via the migration
   runner (`scripts/migrate.mjs` against `src/db/migrations/`), then restore data from the most
   recent dump if one exists. **Note:** there is no *verified* off-Neon dump today (the local
   backup scripts are unaudited) — so in practice this scenario relies on Neon's own retention.
   Push the new `DATABASE_URL` to the Worker secret + redeploy.

### 3. R2 data loss (no versioning — limited recovery)
There is no backup. Mitigation is forward-looking (enable versioning — *Action items*). If
objects are lost today, the only recovery is any external copy (e.g. a creator re-uploading).
Document what was lost; do not pretend it's recoverable.

### 4. Secrets lost / rotated-and-forgotten
Re-provision each from its vendor, then `npx wrangler secret put <NAME>`:
| Secret | Source |
|--------|--------|
| `DATABASE_URL` | Neon dashboard → connection string |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe dashboard (webhook secret: Developers → Webhooks → endpoint) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash console |
| `RESEND_API_KEY` | Resend dashboard |
| `AXIOM_TOKEN` | Axiom (required in prod — worker 503s without it) |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Sentry project settings |
| `JWT_SECRET` | Generate a new one (invalidates existing bearer tokens → users re-auth) |

After restoring secrets: `npx wrangler deploy` and verify `GET /api/health` → all services `connected`.

### 5. Cloudflare account compromise
Assume all secrets are exposed. Rotate **everything**: Neon password (push new `DATABASE_URL`
in the same step — old password stops working minutes-to-hours later), Stripe keys (roll in
Stripe dashboard), Upstash token, Resend key, `JWT_SECRET`. Review CF audit logs. Redeploy.

### 6. Accidental resource deletion
This has happened — the stale `pitchey` Pages project was deleted 2026-04-21 (intentionally,
but it shows deletions are real). For a Pages/Worker deletion: recreate from git
(`wrangler deploy` / `wrangler pages deploy dist/ --project-name=pitchey --branch=main`) and
re-attach bindings (next section). KV/R2/DO deletion: recreate the namespace/bucket and update
IDs in `wrangler.toml`; data in a deleted KV/R2 is gone.

### 7. Full rebuild from zero (everything CF-side gone, git intact)
1. `git clone` the repo.
2. Recreate infra bindings (below) — buckets, KV namespaces, DOs, AE datasets, queues.
3. Set all secrets (scenario 4).
4. Recreate / restore Neon (scenario 2).
5. `npx wrangler deploy` (worker) and `cd frontend && npx wrangler pages deploy dist/ --project-name=pitchey --branch=main`.
6. Verify `/api/health`, `/api/plans`, a login, a pitch view.

---

## Infrastructure inventory (to recreate from wrangler.toml)

- **R2 buckets:** `pitchey-pitches`, `pitchey-ndas`, `pitchey-media`, `pitchey-processed`, `pitchey-temp`, `pitchey-audit-logs`, trace logs bucket.
- **KV namespaces:** `CACHE`, `SESSION_STORE`, `RATE_LIMITER`, `JOB_STATUS`, `CONTAINER_METRICS`.
- **Durable Objects:** `NotificationHub` (NOTIFICATION_HUB), `WebSocketRoom` (WEBSOCKET_ROOMS).
- **Analytics Engine:** `ANALYTICS`, `PITCHEY_ANALYTICS`.
- **Queues:** video/document/AI/media/code processing (several are parked — confirm which are live before recreating).

The authoritative list is always `wrangler.toml`. After recreating, update the IDs there.

---

## DR gaps / action items (prioritised)

1. **Back up secret *values*** (highest leverage, lowest effort). `wrangler secret` is write-only,
   so store the actual values in a password manager / sealed secret. Without this, a full
   disaster's RTO is dominated by manually re-obtaining ~10 credentials. *Owner action.*
2. **Enable R2 versioning** (or a periodic R2→external sync) on the data buckets
   (`pitchey-pitches`, `-ndas`, `-media`) so overwrites/deletes are recoverable.
   `wrangler` has no versioning subcommand — use the dashboard (bucket → Settings →
   Object versioning → Enable) or the S3-compatible `PutBucketVersioning` API with
   R2 S3 credentials:
   ```bash
   # Requires an R2 API token's Access Key ID / Secret configured for aws-cli.
   # account_id = 002bd5c0e90ae753a387c60546cf6869 (ndlovucavelle)
   for b in pitchey-pitches pitchey-ndas pitchey-media; do
     aws s3api put-bucket-versioning \
       --endpoint-url https://002bd5c0e90ae753a387c60546cf6869.r2.cloudflarestorage.com \
       --bucket "$b" \
       --versioning-configuration Status=Enabled
   done
   ```
   **Cost note:** versions accumulate on overwrite/delete (rare for documents, so
   modest), but the org runs a cost-sensitive shared quota (#65) — confirm before
   enabling, and consider an R2 lifecycle rule to expire noncurrent versions after
   N days (`wrangler r2 bucket lifecycle`). *Owner action (credentials + billing).*
3. **Verify Neon retention** in the dashboard and confirm it matches the RPO you want; upgrade
   the plan if the window is too short.
4. **Audit + fix or delete the local backup scripts** (`database-backup.sh` → AWS S3 not R2;
   `disaster-recovery.sh` → `--env production` + commented-out R2 upload; global-wrangler
   assumption) — same treatment the rollback script got in #183. Until then, treat them as
   non-functional.
5. **Test a restore** — branch Neon to a point in time and bring a throwaway worker up against
   it. An untested restore is the same "prayer" the rollback drill exposed.

   **Non-destructive restore drill** (no impact on the live `main` branch; uses brief
   branch compute — modest, but counts against the shared Neon quota #65, so run
   deliberately):
   1. Create a branch from a recent timestamp (Neon dashboard, neonctl, or the Neon MCP
      `create_branch` with a `point_in_time`). Name it `dr-drill-<date>`.
   2. Get its connection string and run the smoke queries: `SELECT NOW();`,
      `SELECT count(*) FROM users;`, `SELECT count(*) FROM pitches;`,
      `SELECT count(*) FROM subscription_history WHERE status='active';` — confirm
      counts look sane vs. production.
   3. (Optional, fuller drill) point a local `wrangler dev` at the branch
      (`DATABASE_URL=<branch-conn> wrangler dev`) and exercise login + a pitch view +
      `/api/health`.
   4. **Delete the branch** (`delete_branch`) to release compute. Record the date +
      outcome in this file's verification log so the quarterly cadence has evidence.

   A passing drill closes the "untested restore" gap until the next quarterly run.

---

## Verification cadence

- **Quarterly:** confirm Neon PITR retention, do a test branch-and-restore, confirm secret
  values are in the password manager and current.
- **After any secret rotation:** confirm the new value is saved off-platform.
- **After adding a binding/bucket:** update this inventory + `wrangler.toml`.
