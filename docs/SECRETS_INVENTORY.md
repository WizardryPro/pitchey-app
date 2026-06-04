# Secrets Inventory & Recovery Map (Cloud-5)

Closes the **biggest DR gap** called out in [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md):
`wrangler secret` values are **write-only** — Cloudflare will not read them back, so if the
secrets are lost they must be **re-obtained vendor-by-vendor**. This doc is the map that
makes that fast, plus a one-file local vault so a real value backup exists.

> **The actual values live in a gitignored vault, never in git.** Store them in
> `.secrets/vault.env` (the whole `.secrets/` dir is gitignored — verified) **and** in a
> password manager. This file is only the *map*.

## The 12 production worker secrets (`wrangler secret list`)

| Secret | What it is | Where to re-obtain | Recoverable locally? |
|---|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | Neon console → project → Connection string (pooled) | ✅ **already in `.dev.vars`** |
| `STRIPE_SECRET_KEY` | Stripe live secret (`sk_live_…`) | Stripe Dashboard → Developers → API keys | ❌ vendor |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) | Stripe Dashboard → Developers → Webhooks → endpoint `we_1TbpEA…` → Signing secret | ❌ vendor |
| `RESEND_API_KEY` | Email send API key | Resend → API Keys | ❌ vendor |
| `FROM_EMAIL` | Verified sender address | Config value (the verified Resend domain sender, e.g. `noreply@pitchey.com`) | ⚠️ re-derive |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Upstash console → database → REST API | ❌ vendor |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Upstash console → database → REST API | ❌ vendor |
| `TURNSTILE_SECRET_KEY` | Turnstile server secret (sitekey `0x4AAAAAACzpFR…`) | Cloudflare → Turnstile → widget → Settings | ❌ vendor (CF) |
| `AXIOM_TOKEN` | Axiom ingest token (dataset `pitchey-logs`) | Axiom → Settings → API tokens | ❌ vendor |
| `COMPANIES_HOUSE_API_KEY` | UK company verification | developer.company-information.service.gov.uk | ❌ vendor |
| `JWT_SECRET` | Signs JWT bearer fallback tokens | **Regenerate** (random). Rotating invalidates existing bearer tokens — users re-auth. | 🔁 regenerate |
| `BETTER_AUTH_SECRET` | Legacy (Better Auth ripped, issue #19) | **Regenerate** (random) — vestigial; safe to rotate. | 🔁 regenerate |

> Sentry DSN is not a `wrangler secret` — it lives in `wrangler.toml` `[vars]` (`SENTRY_DSN`), already in git.

## Helper script: `scripts/secrets-vault.sh`

Manages the vault — **never prints values**:

```bash
scripts/secrets-vault.sh status    # what's in the vault vs CF (no values shown)
scripts/secrets-vault.sh fill      # prompt (no-echo) for each empty secret -> vault
scripts/secrets-vault.sh fill NAME # (re)enter one
scripts/secrets-vault.sh verify    # vault keys vs `wrangler secret list` (drift check)
scripts/secrets-vault.sh push      # restore: push filled vault values to the worker (confirms first)
```

## Recovery procedure (if secrets are lost)

1. `scripts/secrets-vault.sh fill` — paste each value from your password manager / re-issue from the vendor above.
2. `scripts/secrets-vault.sh push` — pushes them back to the worker (`wrangler secret put`, after a YES confirm).
3. `npx wrangler deploy` (if needed), then verify `GET /api/health` → `ok`.
4. Note: Neon password rotation is prod-affecting — update `DATABASE_URL` and `push` in the same step. (The Hyperdrive credential copy no longer exists as of 2026-06-04, so that extra step is gone.)

## Backup hygiene
- After **any** `wrangler secret put`, run `scripts/secrets-vault.sh fill NAME` to keep the vault current + update your password manager.
- The generic `scripts/secrets-config-manager.sh` (HashiCorp Vault) is **not** wired up — `secrets-vault.sh` + the one-file vault is the pragmatic backup.
