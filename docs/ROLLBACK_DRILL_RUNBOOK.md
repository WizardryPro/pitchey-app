# Rollback Drill — Phase 2 Runbook (supervised, live)

**Status:** Phase 1 complete (script repaired + dry-run verified, PR #183). This is the
**supervised, destructive** Phase 2: prove that `wrangler rollback` actually reverts a
live worker deployment. Passing this is **gate (b)** — the last blocker for the
orchestrator-agent work (Phase D.4). Per CLAUDE.md, an *untested* rollback is worse than
no rollback, which is the whole reason this drill exists.

> **Run this with a human present.** It changes the production worker. It is intentionally
> low-risk (the only change you deploy is a benign marker header), but it is still prod.
> Budget ~15 minutes. Do not run it during a real incident or a high-traffic window.

---

## What this proves

The roadmap requires: *"roll forward, confirm rollback restores the previous version."*
So the drill must show, end-to-end:

1. A new version can be deployed and becomes active (**roll forward**).
2. `wrangler rollback` reverts to the prior version (**rollback**).
3. The reverted change is actually **gone** and the service is **healthy** (**confirm restored**).

We make the "change" an observable-but-harmless response header (`X-Rollback-Drill`), so
step 3 is verifiable over HTTP without any user-facing impact.

---

## Roles / facts

| Thing | Value |
|---|---|
| Worker name | `pitchey-api-prod` (wrangler.toml `name`) |
| Worker URL | `https://pitchey-api-prod.ndlovucavelle.workers.dev` |
| Active-version probe | `GET /api/version` → `{ "version": "<id>", ... }` (CF_VERSION_METADATA) |
| Health probe | `GET /api/health` → `ok` / `degraded` |
| Wrangler | local devDependency — always `npx wrangler` (verified 4.95.0 has `rollback`) |
| Repaired script | `scripts/rollback-deployment.sh` (PR #183) |

`wrangler rollback` semantics (4.95.0): `wrangler rollback [version-id] -y -m "<reason>"`.
With **no** version-id it targets the version immediately before the current active one.
A rollback creates a **new** version that is a copy of the target, so `/api/version` after
a rollback shows a *new* id whose **behaviour** matches the target (the marker header is
gone) — verify by behaviour (header absence + health), not by id-equality.

---

## Pre-flight (do all of these before touching prod)

```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# 1. Auth + wrangler resolve
npx wrangler whoami            # expect: ndlovucavelle@gmail.com

# 2. Dry-run still passes (no changes)
bash scripts/rollback-deployment.sh --worker --dry-run    # expect: "Dry run completed successfully!"
rm -f rollback-*.log rollback-report-*.md

# 3. Capture the CURRENT good state — write these down
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/version   # → V_GOOD (note the id)
curl -s -o /dev/null -w '%{http_code}\n' https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health  # → 200
npx wrangler versions list | head -20    # confirm V_GOOD is the most-recent, note the id below it

# 4. Working tree is clean and == origin/main (so a roll-forward redeploys known-good code)
git fetch origin && git status --short && git rev-parse HEAD origin/main
```

**Abort the drill if:** auth fails, dry-run fails, `/api/health` is not 200, or the working
tree differs from `origin/main`. Fix that first.

---

## The drill

### Step 1 — Roll forward (deploy the marker version)

Add a single benign response header so the deployed change is observable, then deploy.

```bash
# Add a temporary marker header to the worker's response path.
# (Insert near where the main fetch handler builds its Response / CORS headers in
#  src/worker-integrated.ts, e.g. add:  'X-Rollback-Drill': '<UTC timestamp>'  )
#   --> make the smallest possible edit; this is throwaway.

npx wrangler deploy -m "ROLLBACK DRILL marker — safe to roll back"
```

**Verify the marker is LIVE:**

```bash
curl -s -D - -o /dev/null https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | grep -i x-rollback-drill
# expect: x-rollback-drill: <timestamp>
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/version    # → V_MARKER (new id, != V_GOOD)
```

If the marker header is present and `/api/version` changed, the **roll-forward** worked.

### Step 2 — Rollback

```bash
npx wrangler rollback -y -m "rollback drill — reverting marker"
# (no version-id => reverts to the version before the current marker version = V_GOOD's code)
```

If `wrangler rollback` errors, **do not panic** — go to *Recovery* below (roll forward from
`main`). The error itself is a finding worth capturing.

### Step 3 — Confirm restored

```bash
# marker header must be GONE
curl -s -D - -o /dev/null https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | grep -i x-rollback-drill
# expect: (no output)

# health green
curl -s -o /dev/null -w '%{http_code}\n' https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health   # → 200

# a real endpoint still works (proves it's the real worker, not the maintenance fallback)
curl -s -o /dev/null -w '%{http_code}\n' https://pitchey-api-prod.ndlovucavelle.workers.dev/api/plans     # → 200

# version moved again (rollback = new version copying V_GOOD)
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/version
```

**Drill PASSES if:** marker header gone + `/api/health` 200 + `/api/plans` 200. That is
"rollback restored the previous version," end-to-end. ✅ gate (b) met.

### Step 4 — Clean up the marker in source

The marker was a throwaway edit — make sure it never ships for real:

```bash
git checkout -- src/worker-integrated.ts    # discard the marker edit (it was never committed)
git status --short                           # expect clean
```

Prod is already back on marker-free code (Step 2). This just keeps the marker out of the repo.

---

## Recovery (if rollback fails or anything looks wrong)

The fastest restore is a forward deploy of known-good `main`:

```bash
git checkout -- src/worker-integrated.ts            # drop the marker edit
git fetch origin && git reset --hard origin/main    # known-good code
npx wrangler deploy -m "restore after rollback drill"
curl -s -o /dev/null -w '%{http_code}\n' https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health  # → 200
```

If the worker itself is unreachable (not just the marker), the repaired script's
fallbacks are now real tools:

```bash
bash scripts/rollback-deployment.sh --worker           # tries `wrangler rollback -y`, else emergency 503 worker
# or, full maintenance posture:
bash scripts/rollback-deployment.sh --all              # worker + frontend maintenance page + secrets reset
```

---

## Capture (turn the drill into the next artifact)

Record, in `docs/INCIDENT_RESPONSE.md` (new — roadmap Phase C item 2) or a drill log:

- Wall-clock from "Step 2 rollback issued" → "Step 3 health green" (this is your real RTO).
- Did `wrangler rollback` with no version-id pick the right target? (It should = V_GOOD.)
- Any prompt/hang/auth surprise not caught by the dry-run.
- Whether `/api/version` id-after-rollback is new (expected) — note it so future responders
  don't mistake a new id for a failed rollback.

Once this passes, gate (b) is met: update `project_roadmap_apr2026` memory (Phase 2 done)
and CLAUDE.md's orchestrator-agent prerequisite, and Phase D.4 is unblocked.

---

## Why a marker header (and not a zero-change redeploy)

A zero-change redeploy would prove the rollback *mechanism* runs, but not that a *bad change
is actually reverted*. The marker header is the smallest change that is (a) observable over
HTTP, (b) harmless to every user, and (c) unambiguous to verify gone. It's the honest
minimum that proves the property the roadmap actually cares about.
