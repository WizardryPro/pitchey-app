# P7 — Locale / Currency Billing — Scoping (2026-06-02)

Status: **scoping only, no code.** Money + Stripe-live config. Decisions required before any implementation.

## Current state
- **Single currency: EUR.** `frontend/src/config/subscription-plans.ts` defines `SUBSCRIPTION_TIERS` (Creator/Production/Exec) and `CREDIT_PACKAGES`, all priced in EUR.
- **Single-mode live price IDs.** 16 live price IDs were swapped 1:1 by euro amount (commit `5606f10d`). Flipping currency/mode today means editing that file + redeploy — there is no env-aware or currency-aware price map.
- **Credits balance** now reports `currency: 'EUR'` (P4). The public `/pricing` page and `CreditPurchase` read EUR from config and were built to switch to a locale source later.
- **Known open item** (from `project_stripe_live`): "Stripe Adaptive Pricing EUR→GBP" — i.e. GBP was never wired.
- **Geo signal available for free:** Cloudflare Workers expose `request.cf.country` (ISO-3166) and `request.cf` locale hints — no IP-geo vendor needed.

## What "vary by location/currency" actually requires
Three independent layers, each with a decision:

### 1. Price source (the money model) — DECISION NEEDED
| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Stripe multi-currency Prices** (`currency_options` on one Price, or one Price per currency) | Define each tier's amount per currency in Stripe; Checkout picks by `currency`/customer locale | Real localized amounts you control (€19.99 vs £17.99 vs $21.99); clean Stripe-native | Must set every amount per currency per tier (16 prices × N currencies); config map grows |
| **B. Stripe Adaptive Pricing** | Enable in Stripe Dashboard; Stripe auto-converts presentment currency at checkout from your single (EUR) price | Near-zero code; instant multi-currency | Amounts are FX-converted (ugly £18.37), not rounded marketing prices; less control; availability/fees caveats |
| **C. Presentment-only display** | Keep charging EUR; show approximate local price as a hint on the pricing page | Trivial; no Stripe change | Doesn't actually charge local currency — fails the requirement |

**Recommendation: A** for the subscription ladder (marketing prices matter), optionally **B** as a stopgap for long-tail currencies. C alone does not satisfy the ask.

### 2. Currency/locale selection — DECISION NEEDED
- **Auto from `request.cf.country`** (Worker injects a `currency` into the pricing/checkout responses), with
- **an explicit currency selector** on the pricing page (override), persisted per user.
- Recommendation: auto-detect default + manual override; never silently lock a user to a geo-guessed currency.

### 3. Config shape (de-drift)
- Replace the flat `price.monthly/annual` with a per-currency map, e.g. `price: { EUR: {monthly, annual, priceId}, GBP: {...}, USD: {...} }`, and a `getTierPrice(tierId, currency)` helper.
- The `/pricing` page and `CreditPurchase` already centralize reads — point them at the helper so display + checkout can't diverge.

## Dependencies / prerequisites
- **Stripe Dashboard work** (out of code): create per-currency prices (Option A) or enable Adaptive Pricing (Option B). New live price IDs to capture.
- **Currencies to support** — DECISION NEEDED (proposed launch set: EUR, GBP, USD; expand later).
- **Tax/VAT**: charging GBP/USD raises VAT/sales-tax questions (Stripe Tax?) — flag for finance, out of P7 code scope but a launch dependency.
- **Reversibility**: keep a single source of truth (config map) and an env flag to fall back to EUR-only, so a bad rollout reverts cleanly (the current single-mode setup has no such switch).

## Risks
- Money logic touching live Stripe — must be staged + smoke-tested in test mode first (mirror the Stripe-live go-live discipline).
- Price/currency mismatch (charging EUR while displaying GBP) is the exact class of bug P4 just fixed — the config-map single-source mitigates it.
- Adaptive Pricing FX amounts can confuse users vs. the marketing ladder.

## Proposed phased plan (when approved)
1. Decide currency set + price model (A/B). Create Stripe prices; capture IDs.
2. Refactor `subscription-plans.ts` to a per-currency map + `getTierPrice` helper (display only first — no checkout change). Ship, verify pricing page shows correct per-currency amounts behind a currency selector.
3. Wire checkout to pass the selected currency's price ID; smoke-test in Stripe test mode end-to-end (the go-live script pattern).
4. Auto-detect default currency from `request.cf.country`; persist override.
5. Tax/VAT review before enabling non-EUR charging in production.

## Open decisions to confirm
1. Price model: **A (per-currency prices)** vs B (Adaptive) vs hybrid.
2. Launch currency set (proposed EUR/GBP/USD).
3. Who creates the Stripe prices (owner) — code can't until IDs exist.
4. Tax handling owner + whether Stripe Tax is in scope.
