#!/usr/bin/env bash
# Resets the neondb_owner password on the Neon project owning the endpoint in
# our .env DATABASE_URL, then rewrites .env with the new credential. The old
# password keeps working until the reset operation finishes, so this is safe to
# run while the prod Worker is live (the Worker's DATABASE_URL secret is
# separate and must be updated independently via `wrangler secret put`).
#
# Usage:
#   NEON_API_KEY=... ./scripts/reset-neon-password.sh
set -euo pipefail

: "${NEON_API_KEY:?set NEON_API_KEY (https://console.neon.tech/app/settings/api-keys)}"

API="https://console.neon.tech/api/v2"
ROLE="neondb_owner"

ENV_URL=$(awk -F= '/^DATABASE_URL=/{sub(/^DATABASE_URL=/,""); print; exit}' .env)
[[ -n "$ENV_URL" ]] || { echo "DATABASE_URL not found in .env"; exit 1; }

# Endpoint id is the hostname segment before the first dot (e.g. ep-old-snow-abpr94lc-pooler).
# Strip the -pooler suffix when matching against the API, which uses the raw endpoint id.
HOST=$(echo "$ENV_URL" | sed -E 's|.*@([^:/?]+).*|\1|')
EP_RAW=${HOST%%.*}
EP_ID=${EP_RAW%-pooler}
echo "Endpoint id: $EP_ID"

auth() { curl -sS -H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json" "$@"; }

echo "Locating project that owns $EP_ID ..."
PROJECTS_RAW=$(auth "$API/projects")
PROJECTS=$(echo "$PROJECTS_RAW" | jq -r '.projects[]?.id')
if [[ -z "$PROJECTS" ]]; then
  echo "No projects returned. Raw response:"
  echo "$PROJECTS_RAW" | jq . 2>/dev/null || echo "$PROJECTS_RAW"
  echo
  echo "Common causes:"
  echo "  - API key invalid or revoked"
  echo "  - API key belongs to a different account/org than the project"
  echo "  - Project is under an org: try setting NEON_ORG_ID and re-run, or use a personal API key"
  exit 1
fi
PROJECT_ID=""
BRANCH_ID=""
for p in $PROJECTS; do
  match=$(auth "$API/projects/$p/endpoints" | jq -r --arg ep "$EP_ID" '.endpoints[]? | select(.id==$ep) | .branch_id')
  if [[ -n "$match" ]]; then
    PROJECT_ID=$p
    BRANCH_ID=$match
    break
  fi
done

[[ -n "$PROJECT_ID" && -n "$BRANCH_ID" ]] || { echo "Could not find project/branch for endpoint $EP_ID"; exit 1; }
echo "Project: $PROJECT_ID  Branch: $BRANCH_ID"

echo "Resetting password for role $ROLE ..."
RESP=$(auth -X POST "$API/projects/$PROJECT_ID/branches/$BRANCH_ID/roles/$ROLE/reset_password")
NEW_PW=$(echo "$RESP" | jq -r '.role.password // empty')
[[ -n "$NEW_PW" ]] || { echo "Password missing in response:"; echo "$RESP"; exit 1; }

# Rebuild DATABASE_URL, keeping the original host / db / query string.
REST=$(echo "$ENV_URL" | sed -E 's|^[^@]+@(.*)$|\1|')
NEW_URL="postgresql://$ROLE:$NEW_PW@$REST"

cp .env ".env.bak.$(date +%Y%m%d-%H%M%S)"
awk -v new="DATABASE_URL=$NEW_URL" '
  /^DATABASE_URL=/ { print new; next }
  { print }
' .env > .env.tmp && mv .env.tmp .env

echo "Updated .env. Verifying connection ..."
psql "$NEW_URL" -c "SELECT 1 AS ok;" >/dev/null
echo "OK."
echo
echo "Reminder: the prod Worker uses its own DATABASE_URL secret. If you want"
echo "the Worker to use this new password too, run:"
echo "  npx wrangler secret put DATABASE_URL   # paste: $NEW_URL"
