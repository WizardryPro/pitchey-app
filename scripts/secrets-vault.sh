#!/usr/bin/env bash
#
# secrets-vault.sh — manage the local production-secret value backup (Cloud-5).
#
# The 12 Cloudflare Worker secrets are WRITE-ONLY (you can't read them back from
# CF). This script keeps a gitignored value backup at .secrets/vault.env and can
# push it back to the worker for disaster recovery. Values are never printed.
#
# Usage:
#   scripts/secrets-vault.sh status        # (default) what's in the vault vs CF — no values shown
#   scripts/secrets-vault.sh fill          # prompt (no-echo) for any empty secrets, save to vault
#   scripts/secrets-vault.sh fill NAME     # (re)enter one secret
#   scripts/secrets-vault.sh push          # push ALL filled vault values to the worker (confirms first)
#   scripts/secrets-vault.sh push NAME     # push one
#   scripts/secrets-vault.sh verify        # compare vault keys vs `wrangler secret list` (names only)
#
# See docs/SECRETS_INVENTORY.md for where to re-obtain each value.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="$REPO_ROOT/.secrets/vault.env"
TEMPLATE="$REPO_ROOT/docs/secrets-vault.template.env"

# Canonical list of the 12 production worker secrets.
SECRETS=(
  DATABASE_URL STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY FROM_EMAIL
  UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN TURNSTILE_SECRET_KEY
  AXIOM_TOKEN COMPANIES_HOUSE_API_KEY JWT_SECRET BETTER_AUTH_SECRET
)

c_green=$'\033[32m'; c_red=$'\033[31m'; c_yellow=$'\033[33m'; c_dim=$'\033[2m'; c_off=$'\033[0m'

die() { echo "${c_red}ERROR:${c_off} $*" >&2; exit 1; }

ensure_vault() {
  if [[ ! -f "$VAULT" ]]; then
    mkdir -p "$(dirname "$VAULT")"
    if [[ -f "$TEMPLATE" ]]; then cp "$TEMPLATE" "$VAULT"; else : > "$VAULT"; fi
    echo "${c_yellow}Created $VAULT from template.${c_off}"
  fi
  # Safety: never let the vault be tracked by git.
  if git -C "$REPO_ROOT" check-ignore "$VAULT" >/dev/null 2>&1; then :; else
    die "$VAULT is NOT gitignored — refusing to write secrets. Add .secrets/ to .gitignore."
  fi
}

# Read one secret's value from the vault (empty string if unset). Never printed by callers.
vault_get() {
  local key="$1"
  [[ -f "$VAULT" ]] || { echo ""; return; }
  local line; line="$(grep -E "^${key}=" "$VAULT" | tail -1 || true)"
  printf '%s' "${line#*=}"
}

# Set/replace one secret's value in the vault, preserving file structure.
vault_set() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$VAULT"; then
    # Replace the existing line (value may contain anything; use awk to avoid sed escaping).
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' "$VAULT" > "$tmp"
  else
    cat "$VAULT" > "$tmp"; printf '%s=%s\n' "$key" "$val" >> "$tmp"
  fi
  mv "$tmp" "$VAULT"
  chmod 600 "$VAULT" 2>/dev/null || true
}

cf_secret_names() {
  command -v npx >/dev/null 2>&1 || return 1
  npx wrangler secret list 2>/dev/null | python3 -c '
import sys, json, re
m = re.search(r"\[.*\]", sys.stdin.read(), re.S)
print("\n".join(s["name"] for s in json.loads(m.group(0))) if m else "")
' 2>/dev/null || return 1
}

cmd_status() {
  ensure_vault
  echo "Vault: $VAULT  ${c_dim}(gitignored)${c_off}"
  local cf_names; cf_names="$(cf_secret_names || true)"
  local have_cf=0; [[ -n "$cf_names" ]] && have_cf=1
  printf '\n  %-26s %-12s %-10s\n' "SECRET" "IN VAULT" "IN CF"
  printf '  %-26s %-12s %-10s\n' "------" "--------" "-----"
  local filled=0
  for k in "${SECRETS[@]}"; do
    local v; v="$(vault_get "$k")"
    local in_vault="${c_red}empty${c_off}"; [[ -n "$v" ]] && { in_vault="${c_green}set${c_off}"; filled=$((filled+1)); }
    local in_cf="${c_dim}?${c_off}"
    if [[ $have_cf -eq 1 ]]; then
      if grep -qx "$k" <<<"$cf_names"; then in_cf="${c_green}yes${c_off}"; else in_cf="${c_red}NO${c_off}"; fi
    fi
    printf '  %-26s %-21b %-10b\n' "$k" "$in_vault" "$in_cf"
  done
  echo
  echo "  Vault: ${filled}/${#SECRETS[@]} filled.  ${c_dim}Run 'fill' to add the rest; 'push' to restore to the worker.${c_off}"
  [[ $have_cf -eq 0 ]] && echo "  ${c_yellow}(CF column unknown — wrangler not logged in / unavailable.)${c_off}"
}

cmd_fill() {
  ensure_vault
  local only="${1:-}"
  for k in "${SECRETS[@]}"; do
    [[ -n "$only" && "$k" != "$only" ]] && continue
    local cur; cur="$(vault_get "$k")"
    if [[ -n "$cur" && -z "$only" ]]; then continue; fi   # skip already-filled unless targeted
    printf 'Enter %s %s: ' "$k" "$([[ -n "$cur" ]] && echo '(leave blank to keep current)')"
    local val; IFS= read -rs val; echo
    [[ -z "$val" ]] && { echo "  ${c_dim}skipped${c_off}"; continue; }
    vault_set "$k" "$val"
    echo "  ${c_green}saved${c_off}"
  done
  echo "Done. ${c_dim}Values stored in $VAULT (gitignored).${c_off}"
}

cmd_push() {
  ensure_vault
  command -v npx >/dev/null 2>&1 || die "npx/wrangler not available."
  local only="${1:-}"
  local to_push=()
  for k in "${SECRETS[@]}"; do
    [[ -n "$only" && "$k" != "$only" ]] && continue
    [[ -n "$(vault_get "$k")" ]] && to_push+=("$k")
  done
  [[ ${#to_push[@]} -eq 0 ]] && die "Nothing to push (no filled values${only:+ for $only})."
  echo "${c_yellow}About to push these secrets to the LIVE worker (pitchey-api-prod):${c_off}"
  printf '  - %s\n' "${to_push[@]}"
  printf 'Type YES to proceed: '; local ok; read -r ok
  [[ "$ok" == "YES" ]] || die "Aborted."
  for k in "${to_push[@]}"; do
    printf 'Pushing %s ... ' "$k"
    if printf '%s' "$(vault_get "$k")" | npx wrangler secret put "$k" >/dev/null 2>&1; then
      echo "${c_green}ok${c_off}"
    else
      echo "${c_red}FAILED${c_off}"
    fi
  done
  echo "Done. ${c_dim}Verify with: curl -s .../api/health${c_off}"
}

cmd_verify() {
  ensure_vault
  local cf_names; cf_names="$(cf_secret_names)" || die "Could not read 'wrangler secret list' (logged in?)."
  echo "Comparing vault vs Cloudflare (names only):"
  local missing_cf=() extra_cf=()
  for k in "${SECRETS[@]}"; do grep -qx "$k" <<<"$cf_names" || missing_cf+=("$k"); done
  while IFS= read -r n; do
    [[ -z "$n" ]] && continue
    printf '%s\n' "${SECRETS[@]}" | grep -qx "$n" || extra_cf+=("$n")
  done <<<"$cf_names"
  if [[ ${#missing_cf[@]} -gt 0 ]]; then echo "  ${c_red}In inventory but NOT set in CF:${c_off} ${missing_cf[*]}"; else echo "  ${c_green}All 12 inventory secrets are set in CF.${c_off}"; fi
  [[ ${#extra_cf[@]} -gt 0 ]] && echo "  ${c_yellow}Set in CF but not in inventory:${c_off} ${extra_cf[*]}"
}

case "${1:-status}" in
  status) cmd_status ;;
  fill)   cmd_fill "${2:-}" ;;
  push)   cmd_push "${2:-}" ;;
  verify) cmd_verify ;;
  -h|--help|help) sed -n '2,20p' "$0" ;;
  *) die "Unknown command '$1'. Try: status | fill | push | verify" ;;
esac
