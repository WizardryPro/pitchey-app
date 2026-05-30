#!/usr/bin/env bash
#
# Set the GitHub Actions secrets used by CI alerting:
#   - SLACK_WEBHOOK       : Slack incoming-webhook URL (obs-error-sweep + simple-health-check)
#   - CLOUDFLARE_OBS_TOKEN: Cloudflare API token with `Account → Account Analytics → Read`
#                           (lets the daily obs-error-sweep query Workers Observability)
#
# Values are read with no echo and piped straight to `gh secret set` (never stored in
# shell history or on disk). Re-run any time to rotate. Requires the GitHub CLI (`gh`)
# authenticated with repo admin access.
#
# Usage:  ./scripts/set-ci-secrets.sh
set -euo pipefail

REPO="WizardryPro/pitchey-app"

command -v gh >/dev/null 2>&1 || { echo "✗ GitHub CLI (gh) not found — install it first."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "✗ gh not authenticated — run: gh auth login"; exit 1; }

echo "Setting CI secrets on ${REPO} (leave a prompt blank to skip that secret)."
echo

# --- Slack incoming webhook -------------------------------------------------
# Create one at: https://api.slack.com/messaging/webhooks  (looks like
# https://hooks.slack.com/services/T000/B000/xxxx)
read -rsp "Slack incoming webhook URL: " SLACK_WEBHOOK; echo
if [ -n "${SLACK_WEBHOOK:-}" ]; then
  printf '%s' "$SLACK_WEBHOOK" | gh secret set SLACK_WEBHOOK --repo "$REPO"
  echo "  ✓ SLACK_WEBHOOK set"
else
  echo "  – skipped SLACK_WEBHOOK"
fi
echo

# --- Cloudflare Observability read token ------------------------------------
# Create at: Cloudflare dashboard → My Profile → API Tokens → Create Token →
#   "Create Custom Token" → Permissions: Account → Account Analytics → Read →
#   Account Resources: your account → Continue → Create. Copy the token value.
read -rsp "Cloudflare Observability API token (Account Analytics: Read): " CLOUDFLARE_OBS_TOKEN; echo
if [ -n "${CLOUDFLARE_OBS_TOKEN:-}" ]; then
  printf '%s' "$CLOUDFLARE_OBS_TOKEN" | gh secret set CLOUDFLARE_OBS_TOKEN --repo "$REPO"
  echo "  ✓ CLOUDFLARE_OBS_TOKEN set"
else
  echo "  – skipped CLOUDFLARE_OBS_TOKEN"
fi
echo

echo "Done. Verify the observability sweep with:"
echo "  gh workflow run obs-error-sweep.yml --ref main"
echo "  gh run watch \$(gh run list --workflow=obs-error-sweep.yml --limit 1 --json databaseId -q '.[0].databaseId')"
