#!/usr/bin/env bash
#
# Create Pitchey launch promo codes in LIVE Stripe (via the Stripe CLI).
#
# Prompts for the sk_live_ key (no echo), then creates two coupon +
# promotion-code pairs (idempotent — safe to re-run):
#
#   FreeThePitch100  → 100% off, forever, 40 redemptions  ("use the app free")
#   LifesAPitch50    →  50% off, forever, 20 redemptions  ("half price")
#
# These are SUBSCRIPTION discounts. The code box only appears on the
# subscription checkout (createSubscriptionCheckout sets allow_promotion_codes);
# credit purchases don't surface it, so the codes can't be spent there.
#
# The key is passed to the Stripe CLI via the STRIPE_API_KEY env var (NOT a
# --api-key flag) so it never appears in the process list. It lives in this
# script's memory for one run, is never written to disk / echoed / persisted in
# shell history (read -rs), and is unset on exit.
#
# Requires: stripe CLI, jq.

set -euo pipefail

cleanup() { unset STRIPE_API_KEY; }
trap cleanup EXIT

# (coupon_id, percent_off, duration, coupon_name, promo_code, max_redemptions)
PAIRS=(
  "ptchy_free_100|100|forever|Free The Pitch (100% off)|FreeThePitch100|40"
  "ptchy_half_50|50|forever|Life's a Pitch (50% off)|LifesAPitch50|20"
)

echo "=== Pitchey launch promo codes (LIVE Stripe, via Stripe CLI) ==="
echo ""

read -rsp "Paste sk_live_ key (input hidden): " STRIPE_API_KEY
echo ""
if [[ -z "$STRIPE_API_KEY" ]]; then
  echo "✗ Empty key — aborting."; exit 1
fi
if [[ ! "$STRIPE_API_KEY" =~ ^sk_live_ ]]; then
  echo "✗ Key must start with 'sk_live_'. Got: ${STRIPE_API_KEY:0:8}…"; exit 1
fi
export STRIPE_API_KEY   # Stripe CLI reads this; keeps the key out of `ps`.
echo "→ key accepted (sk_live_…${STRIPE_API_KEY: -4})"
echo ""

for entry in "${PAIRS[@]}"; do
  IFS='|' read -r COUPON_ID PERCENT DURATION COUPON_NAME PROMO_CODE MAXR <<< "$entry"

  echo "──────────────────────────────────────────────"
  echo "→ $PROMO_CODE  (${PERCENT}% off, $DURATION, max ${MAXR})"

  # 1. Coupon — fixed id makes this idempotent. Retrieve if it exists, else create.
  # NOTE: the Stripe CLI exits 0 even on a 404 (it prints the error JSON), so we
  # must inspect the payload for a real `.id`, not the exit code.
  coupon_check=$(stripe coupons retrieve "$COUPON_ID" --live 2>/dev/null || true)
  if [[ -n "$(echo "$coupon_check" | jq -r '.id // empty')" ]]; then
    echo "   coupon $COUPON_ID already exists — reusing"
  else
    coupon_json=$(stripe coupons create --live \
      -d "id=$COUPON_ID" \
      -d "percent_off=$PERCENT" \
      -d "duration=$DURATION" \
      -d "name=$COUPON_NAME")
    err=$(echo "$coupon_json" | jq -r '.error.message // empty')
    if [[ -n "$err" ]]; then echo "   ✗ coupon create failed: $err"; exit 1; fi
    echo "   ✓ coupon created: $COUPON_ID"
  fi

  # 2. Promotion code — codes are unique per account. Skip if it already exists.
  existing_promo=$(stripe promotion_codes list --live -d "code=$PROMO_CODE" -d "limit=1" \
    | jq -r '.data[0].id // empty')
  if [[ -n "$existing_promo" ]]; then
    times=$(stripe promotion_codes retrieve "$existing_promo" --live | jq -r '.times_redeemed')
    echo "   promo code $PROMO_CODE already exists: $existing_promo (redeemed ${times}×) — leaving as-is"
    continue
  fi

  promo_json=$(stripe promotion_codes create --live \
    -d "coupon=$COUPON_ID" \
    -d "code=$PROMO_CODE" \
    -d "max_redemptions=$MAXR")
  err=$(echo "$promo_json" | jq -r '.error.message // empty')
  if [[ -n "$err" ]]; then echo "   ✗ promo code create failed: $err"; exit 1; fi
  promo_id=$(echo "$promo_json" | jq -r '.id')
  echo "   ✓ promo code created: $PROMO_CODE ($promo_id)"
done

echo "──────────────────────────────────────────────"
echo ""
echo "=== done ==="
echo "Customers enter the code on the Stripe-hosted checkout page."
echo "Manage / track redemptions in the Stripe Dashboard → Product catalog → Coupons."
echo ""
echo "NOTE: the worker must be deployed with the allow_promotion_codes change"
echo "      (src/services/stripe.service.ts) or the code box won't appear."
