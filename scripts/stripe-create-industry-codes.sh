#!/usr/bin/env bash
#
# Create the FILM-INDUSTRY seeding promo in LIVE Stripe (via the Stripe CLI).
#
# This is an OWNER/OPERATOR step (creating codes, NOT redeeming them — the
# do-not-consume rule still applies). Recipients redeem their code on Pitchey's
# billing page (the "Have a promo code?" field on the subscribe flow); the admin
# panel at /admin/promo-codes shows the code, its X/50 redemptions, and who
# redeemed — because every code created here carries metadata.cohort=film-industry,
# which the promo-codes report includes automatically.
#
# Two shapes (set MODE):
#   MODE=shared   (default) → ONE code, max 50 redemptions. Simple; you hand the
#                             same code to up to 50 industry contacts.
#   MODE=distinct           → COUNT single-use codes (one per recipient) for
#                             per-recipient attribution. Codes look like
#                             FILMIND-XXXX.
#
# Tunables (env vars, all optional):
#   PERCENT   discount percent off          (default 100 = free access)
#   DURATION  coupon duration               (default forever)
#   MODE      shared | distinct             (default shared)
#   MAXR      redemptions (shared mode)      (default 50)
#   COUNT     number of codes (distinct)     (default 50)
#   CODE      code string (shared mode)      (default FilmIndustry50)
#
# The key is passed via STRIPE_API_KEY (read -rs, never echoed/persisted/in `ps`),
# and unset on exit. Idempotent: existing codes are left as-is.
#
# Requires: stripe CLI, jq.

set -euo pipefail

cleanup() { unset STRIPE_API_KEY; }
trap cleanup EXIT

PERCENT="${PERCENT:-100}"
DURATION="${DURATION:-forever}"
MODE="${MODE:-shared}"
MAXR="${MAXR:-50}"
COUNT="${COUNT:-50}"
CODE="${CODE:-FilmIndustry50}"
# COHORT tags the code so it surfaces in /admin/promo-codes. Override to 'test'
# to create a throwaway verification code that is clearly NOT one of the 50.
COHORT="${COHORT:-film-industry}"
COUPON_ID="ptchy_film_industry_${PERCENT}"
COUPON_NAME="Film Industry (${PERCENT}% off)"

echo "=== Pitchey film-industry promo (LIVE Stripe, via Stripe CLI) ==="
echo "    mode=$MODE  percent=$PERCENT  duration=$DURATION  cohort=$COHORT"
[[ "$MODE" == "shared" ]] && echo "    one code '$CODE' with max_redemptions=$MAXR"
[[ "$MODE" == "distinct" ]] && echo "    $COUNT single-use codes (FILMIND-XXXX)"
echo ""

read -rsp "Paste sk_live_ key (input hidden): " STRIPE_API_KEY
echo ""
if [[ -z "$STRIPE_API_KEY" ]]; then echo "✗ Empty key — aborting."; exit 1; fi
if [[ ! "$STRIPE_API_KEY" =~ ^sk_live_ ]]; then
  echo "✗ Key must start with 'sk_live_'. Got: ${STRIPE_API_KEY:0:8}…"; exit 1
fi
export STRIPE_API_KEY
echo "→ key accepted (sk_live_…${STRIPE_API_KEY: -4})"
echo ""

# 1. Coupon — fixed id makes this idempotent (retrieve-or-create).
echo "──────────────────────────────────────────────"
echo "→ coupon $COUPON_ID  (${PERCENT}% off, $DURATION)"
coupon_check=$(stripe coupons retrieve "$COUPON_ID" --live 2>/dev/null || true)
if [[ -n "$(echo "$coupon_check" | jq -r '.id // empty')" ]]; then
  echo "   coupon already exists — reusing"
else
  coupon_json=$(stripe coupons create --live \
    -d "id=$COUPON_ID" \
    -d "percent_off=$PERCENT" \
    -d "duration=$DURATION" \
    -d "name=$COUPON_NAME" \
    -d "metadata[cohort]=$COHORT")
  err=$(echo "$coupon_json" | jq -r '.error.message // empty')
  if [[ -n "$err" ]]; then echo "   ✗ coupon create failed: $err"; exit 1; fi
  echo "   ✓ coupon created"
fi

# 2. Promotion code(s). metadata[cohort] is what makes them show in /admin/promo-codes.
create_code() {
  local code="$1" maxr="$2" recipient="${3:-}"
  local existing
  existing=$(stripe promotion_codes list --live -d "code=$code" -d "limit=1" | jq -r '.data[0].id // empty')
  if [[ -n "$existing" ]]; then
    echo "   promo $code already exists ($existing) — leaving as-is"; return
  fi
  local args=(-d "coupon=$COUPON_ID" -d "code=$code" -d "max_redemptions=$maxr" -d "metadata[cohort]=$COHORT")
  [[ -n "$recipient" ]] && args+=(-d "metadata[recipient]=$recipient")
  local out err
  out=$(stripe promotion_codes create --live "${args[@]}")
  err=$(echo "$out" | jq -r '.error.message // empty')
  if [[ -n "$err" ]]; then echo "   ✗ $code failed: $err"; exit 1; fi
  echo "   ✓ $code  ($(echo "$out" | jq -r '.id'))"
}

echo ""
if [[ "$MODE" == "shared" ]]; then
  echo "→ promotion code $CODE (max $MAXR)"
  create_code "$CODE" "$MAXR"
else
  echo "→ $COUNT single-use codes"
  for ((i = 1; i <= COUNT; i++)); do
    suffix=$(LC_ALL=C tr -dc 'A-Z0-9' < /dev/urandom | head -c4)
    create_code "FILMIND-${suffix}" 1
  done
fi

echo ""
echo "──────────────────────────────────────────────"
echo "=== done ==="
echo "• Codes carry metadata.cohort=$COHORT → they appear in /admin/promo-codes automatically."
echo "• Hand the code(s) to film-industry contacts; they redeem on the Pitchey billing page."
echo "• Do NOT redeem the codes yourself — redemptions are owner/Karl-driven only."
