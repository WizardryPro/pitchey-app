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

## Recovery procedure (if secrets are lost)

1. Restore the vendor secrets into `.secrets/vault.env` from your password manager (or re-issue from each vendor above).
2. Push each back to the worker:
   ```bash
   while IFS='=' read -r k v; do
     [[ "$k" =~ ^[A-Z_]+$ ]] && printf '%s' "$v" | npx wrangler secret put "$k"
   done < .secrets/vault.env
   ```
3. After `DATABASE_URL` rotation, remember Neon password rotation is prod-affecting — update the worker secret in the same step (Hyperdrive copy no longer exists as of 2026-06-04, so that second step is gone).
4. Redeploy: `npx wrangler deploy`. Verify `GET /api/health` → `ok`.

## Backup hygiene
- Re-run after **any** `wrangler secret put`: update `.secrets/vault.env` + your password manager.
- The generic `scripts/secrets-config-manager.sh` (HashiCorp Vault) is **not** wired up — this one-file vault is the pragmatic backup.
- Template to copy: `docs/secrets-vault.template.env` → `.secrets/vault.env` (gitignored), then fill values.
