#!/usr/bin/env bash
#
# Stripe live mode go-live script.
#
# Prompts for sk_live_ key (no echo), then:
#   1. Creates live webhook destination (8 events) if missing
#   2. Creates/updates default live Customer Portal config
#   3. wrangler secret put STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
#   4. Optionally wrangler deploy
#
# The key value lives in the script's env for one run and is unset on exit.
# It is never written to disk, echoed, or persisted in shell history (read -rs).
#
# Idempotent: if a webhook for our URL already exists, the script reuses it
# and warns that the signing secret can't be retrieved (Stripe shows it only
# at creation). Re-run with the existing webhook deleted to get a fresh secret.

set -euo pipefail

WEBHOOK_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev/api/webhooks/stripe"
PORTAL_RETURN_URL="https://pitchey-5o8.pages.dev/billing"
EVENTS=(
  checkout.session.completed
  customer.subscription.created
  customer.subscription.updated
  customer.subscription.deleted
  invoice.paid
  invoice.payment_failed
  charge.refunded
  charge.dispute.created
)

cleanup() {
  unset STRIPE_API_KEY WHSEC
}
trap cleanup EXIT

echo "=== Stripe live mode go-live ==="
echo ""

# 1. Prompt for sk_live (no echo, no shell history).
read -rsp "Paste sk_live_ key (input hidden): " STRIPE_API_KEY
echo ""
if [[ -z "$STRIPE_API_KEY" ]]; then
  echo "✗ Empty key — aborting."
  exit 1
fi
if [[ ! "$STRIPE_API_KEY" =~ ^sk_live_ ]]; then
  echo "✗ Key must start with 'sk_live_'. Got: ${STRIPE_API_KEY:0:8}…"
  exit 1
fi
export STRIPE_API_KEY
echo "→ key accepted (sk_live_…${STRIPE_API_KEY: -4})"
echo ""

# 2. Find or create live webhook destination.
echo "→ checking live webhook endpoints…"
existing_webhook=$(stripe webhook_endpoints list --live | jq -r --arg url "$WEBHOOK_URL" '.data[] | select(.url==$url) | .id' | head -1)

if [[ -n "$existing_webhook" ]]; then
  echo "  ⚠  webhook for $WEBHOOK_URL already exists: $existing_webhook"
  echo "     Stripe only shows the signing secret at creation time."
  echo "     To get a fresh secret, delete it first:"
  echo "       stripe webhook_endpoints delete $existing_webhook --live"
  echo "     and re-run this script."
  WEBHOOK_ID="$existing_webhook"
  WHSEC=""
else
  echo "→ creating live webhook destination (8 events)…"
  event_args=()
  for e in "${EVENTS[@]}"; do event_args+=(-d "enabled_events[]=$e"); done

  webhook_json=$(stripe webhook_endpoints create --live \
    --url="$WEBHOOK_URL" \
    --description="Pitchey production webhook (LIVE)" \
    "${event_args[@]}")
  WEBHOOK_ID=$(echo "$webhook_json" | jq -r .id)
  WHSEC=$(echo "$webhook_json" | jq -r .secret)
  if [[ -z "$WEBHOOK_ID" || "$WEBHOOK_ID" == "null" ]]; then
    echo "✗ Webhook creation failed. Response:"
    echo "$webhook_json" | head -20
    exit 1
  fi
  echo "  ✓ created $WEBHOOK_ID (signing secret captured)"
fi
echo ""

# 3. Find or create the default live Customer Portal config.
echo "→ checking live Customer Portal config…"
portal_default=$(stripe billing_portal configurations list --live | jq -r '.data[] | select(.is_default==true) | .id' | head -1)

portal_args=(
  -d "business_profile[headline]=Manage your Pitchey subscription"
  -d "features[invoice_history][enabled]=true"
  -d "features[payment_method_update][enabled]=true"
  -d "features[subscription_cancel][enabled]=true"
  -d "features[subscription_cancel][mode]=at_period_end"
  -d "features[customer_update][enabled]=true"
  -d "features[customer_update][allowed_updates][0]=email"
  -d "default_return_url=$PORTAL_RETURN_URL"
)

if [[ -n "$portal_default" ]]; then
  echo "  default portal config exists: $portal_default — updating features"
  stripe billing_portal configurations update --live "$portal_default" "${portal_args[@]}" > /dev/null
  PORTAL_ID="$portal_default"
else
  echo "→ creating default Customer Portal config…"
  portal_json=$(stripe billing_portal configurations create --live "${portal_args[@]}")
  PORTAL_ID=$(echo "$portal_json" | jq -r .id)
fi
echo "  ✓ portal config $PORTAL_ID"
echo ""

# 4. Set Worker secrets via wrangler.
echo "→ setting Worker secrets via wrangler (live values)…"
printf '%s' "$STRIPE_API_KEY" | npx wrangler secret put STRIPE_SECRET_KEY 2>&1 | tail -2
if [[ -n "$WHSEC" ]]; then
  printf '%s' "$WHSEC" | npx wrangler secret put STRIPE_WEBHOOK_SECRET 2>&1 | tail -2
else
  echo "  ⚠ Skipping STRIPE_WEBHOOK_SECRET (webhook signing secret unavailable)."
  echo "    Set manually after recreating webhook:"
  echo "      wrangler secret put STRIPE_WEBHOOK_SECRET"
fi
echo ""

# 5. Deploy. Default Y because skipping leaves the worker with live secrets
#    but stale (test-mode) price IDs in code — every subscribe attempt would
#    400 with "No such price 'price_1Tbks…'" until the next deploy.
echo "⚠  Worker has live secrets now. The code in HEAD has live price IDs."
echo "   If you skip this deploy, the live worker will keep running with the"
echo "   PREVIOUS bundle (test-mode price IDs) → every subscribe will fail."
read -rp "Deploy worker now? [Y/n] " confirm
if [[ ! "$confirm" =~ ^[nN]$ ]]; then
  echo ""
  npx wrangler deploy 2>&1 | tail -8
else
  echo ""
  echo "⚠ Deploy skipped — worker is in a broken state."
  echo "  Run \`npx wrangler deploy\` ASAP to ship the live price IDs."
fi

echo ""
echo "=== done ==="
echo "  webhook:  $WEBHOOK_ID"
echo "  portal:   $PORTAL_ID"
[[ -n "$WHSEC" ]] && echo "  secrets set: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"
