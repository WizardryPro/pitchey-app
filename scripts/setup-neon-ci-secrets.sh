#!/usr/bin/env bash
#
# setup-neon-ci-secrets.sh — configure the GitHub Actions secrets that the
# Neon-backed CI workflows need:
#   - .github/workflows/integration-tests.yml  (backend integration tier)
#   - .github/workflows/neon-preview.yml        (per-PR preview env)
#
# It does three things:
#   1. DOCTOR  — reports which required repo secrets are present vs missing.
#   2. VALIDATE — checks your Neon API key + project id actually work (Neon API).
#   3. SET     — sets NEON_API_KEY + NEON_PROJECT_ID (idempotent, confirms overwrite).
#
# It only SETS the two Neon secrets. The rest (Cloudflare/JWT/Upstash/etc.) are
# reported but left to you — they're set elsewhere and rotating them here would be
# out of scope. Nothing is printed that would leak a secret value.
#
# Usage:
#   ./scripts/setup-neon-ci-secrets.sh                 # interactive (prompts for key)
#   NEON_API_KEY=napi_xxx ./scripts/setup-neon-ci-secrets.sh   # non-interactive key
#   ./scripts/setup-neon-ci-secrets.sh --doctor        # report only, set nothing
#
# Requires: gh (authenticated), curl.

set -euo pipefail

# pitchey-production. Override by exporting NEON_PROJECT_ID before running.
DEFAULT_PROJECT_ID="patient-surf-83998605"
NEON_API="https://console.neon.tech/api/v2"

# Secrets each workflow references (for the doctor report).
NEON_SECRETS=(NEON_API_KEY NEON_PROJECT_ID)
PREVIEW_EXTRA_SECRETS=(
  CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID JWT_SECRET
  UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN
  ENCRYPTION_KEY MFA_SECRET VITE_SENTRY_DSN
)

DOCTOR_ONLY=0
[[ "${1:-}" == "--doctor" ]] && DOCTOR_ONLY=1

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

# ── Preflight ────────────────────────────────────────────────────────────────
command -v gh   >/dev/null || { red "gh CLI not found. Install: https://cli.github.com/"; exit 1; }
command -v curl >/dev/null || { red "curl not found."; exit 1; }
gh auth status >/dev/null 2>&1 || { red "gh is not authenticated. Run: gh auth login"; exit 1; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
bold "Repo: ${REPO}"
echo

# ── 1. Doctor ────────────────────────────────────────────────────────────────
EXISTING="$(gh secret list --json name -q '.[].name' 2>/dev/null || true)"
has_secret() { grep -qx "$1" <<<"$EXISTING"; }

report() {
  local missing=0
  bold "Required by integration-tests.yml + neon-preview.yml:"
  for s in "${NEON_SECRETS[@]}"; do
    if has_secret "$s"; then green "  ✓ $s"; else red "  ✗ $s (MISSING)"; missing=1; fi
  done
  bold "Additionally required by neon-preview.yml only:"
  for s in "${PREVIEW_EXTRA_SECRETS[@]}"; do
    if has_secret "$s"; then green "  ✓ $s"; else yellow "  ✗ $s (missing — set separately)"; fi
  done
  return $missing
}
report || true
echo

if [[ "$DOCTOR_ONLY" == "1" ]]; then
  bold "Doctor-only mode: no changes made."
  exit 0
fi

# ── 2. Gather + validate Neon credentials ────────────────────────────────────
PROJECT_ID="${NEON_PROJECT_ID:-$DEFAULT_PROJECT_ID}"
bold "Neon project id: ${PROJECT_ID}  (override with NEON_PROJECT_ID=...)"

API_KEY="${NEON_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
  # No-echo prompt; never printed.
  read -rsp "Enter NEON_API_KEY (input hidden, leave blank to skip setting the key): " API_KEY
  echo
fi

if [[ -n "$API_KEY" ]]; then
  bold "Validating key + project against the Neon API..."
  http_code="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${API_KEY}" \
    "${NEON_API}/projects/${PROJECT_ID}")"
  case "$http_code" in
    200) green "  ✓ Neon API accepted the key and found project ${PROJECT_ID}." ;;
    401|403) red "  ✗ Neon API rejected the key (HTTP ${http_code}). Not setting it."; exit 1 ;;
    404) red "  ✗ Key works but project ${PROJECT_ID} not found (HTTP 404). Check NEON_PROJECT_ID."; exit 1 ;;
    *) yellow "  ! Unexpected HTTP ${http_code} from Neon. Proceeding, but verify manually." ;;
  esac
fi

# ── 3. Set secrets (idempotent, confirm overwrite) ───────────────────────────
set_secret() {
  local name="$1" value="$2"
  if has_secret "$name"; then
    read -rp "  $name already exists — overwrite? [y/N] " ans
    [[ "${ans:-N}" =~ ^[Yy]$ ]] || { yellow "  · skipped $name"; return; }
  fi
  printf '%s' "$value" | gh secret set "$name" --body -
  green "  ✓ set $name"
}

echo
bold "Setting Neon secrets:"
set_secret NEON_PROJECT_ID "$PROJECT_ID"
[[ -n "$API_KEY" ]] && set_secret NEON_API_KEY "$API_KEY" || yellow "  · NEON_API_KEY left unchanged (no value provided)"

echo
green "Done."
echo
yellow "Reminder: the Neon API key also lives in the LOCAL MCP config (.mcp.json)."
yellow "Rotating the GitHub secret here does NOT update that — run scripts/update-neon-mcp-key.sh"
yellow "too if you rotated the key."
