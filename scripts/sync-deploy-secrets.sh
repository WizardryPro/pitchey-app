#!/usr/bin/env bash
#
# sync-deploy-secrets.sh — make the GitHub Actions deploy secrets safe before a
# real CI deploy on `main`.
#
# The main-push deploy (ci-cd.yml "Sync Worker secrets") pushes 5 secrets from
# GitHub to the live Worker via `wrangler secret put`. If any GitHub value is
# STALE, that deploy overwrites a healthy live secret and breaks the service
# (we hit exactly this with RESEND). GitHub secrets are write-only, so we can't
# read them to compare — instead this validates each value in your local vault
# (.secrets/vault.env) against the REAL service, and only syncs the ones that
# pass to GitHub. Values are never printed.
#
# Usage:
#   scripts/sync-deploy-secrets.sh            # dry-run: validate + show what WOULD sync
#   scripts/sync-deploy-secrets.sh --apply    # actually `gh secret set` the validated ones (confirms first)
#
# Mapping (vault key -> GitHub secret name): DATABASE_URL->NEON_DATABASE_URL,
# JWT_SECRET->JWT_SECRET, UPSTASH_REDIS_REST_URL/TOKEN (as a pair), AXIOM_TOKEN.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="$REPO_ROOT/.secrets/vault.env"
APPLY=0; [[ "${1:-}" == "--apply" ]] && APPLY=1

g=$'\033[32m'; r=$'\033[31m'; y=$'\033[33m'; d=$'\033[2m'; x=$'\033[0m'
die() { echo "${r}ERROR:${x} $*" >&2; exit 1; }
[[ -f "$VAULT" ]] || die "$VAULT not found — run scripts/secrets-vault.sh fill first."
command -v gh >/dev/null || die "gh CLI required."

vget() { grep -E "^$1=" "$VAULT" 2>/dev/null | tail -1 | cut -d= -f2- ; }

# Results: name|github_name|verdict(ok/bad/empty)|reason
declare -a PLAN

check_db() {
  local v; v="$(vget DATABASE_URL)"
  [[ -z "$v" ]] && { PLAN+=("DATABASE_URL|NEON_DATABASE_URL|empty|not in vault"); return; }
  if command -v psql >/dev/null && psql "$v" -tAc "select 1" >/dev/null 2>&1; then
    PLAN+=("DATABASE_URL|NEON_DATABASE_URL|ok|connects")
  else
    PLAN+=("DATABASE_URL|NEON_DATABASE_URL|bad|psql could not connect")
  fi
}

check_jwt() {
  local v; v="$(vget JWT_SECRET)"
  # A signing secret can't be tested against a service; trust a non-trivial value.
  if [[ -n "$v" && ${#v} -ge 32 ]]; then PLAN+=("JWT_SECRET|JWT_SECRET|ok|present (${#v} chars)")
  else PLAN+=("JWT_SECRET|JWT_SECRET|${v:+bad}${v:-empty}|too short / missing"); fi
}

check_upstash() {
  local u t url code; u="$(vget UPSTASH_REDIS_REST_URL)"; t="$(vget UPSTASH_REDIS_REST_TOKEN)"
  if [[ -z "$u" || -z "$t" ]]; then
    PLAN+=("UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_URL|empty|url or token missing")
    PLAN+=("UPSTASH_REDIS_REST_TOKEN|UPSTASH_REDIS_REST_TOKEN|empty|url or token missing"); return
  fi
  url="$u"; [[ "$url" != http* ]] && url="https://$url"
  code="$(curl -s -m 8 -o /dev/null -w '%{http_code}' "$url/ping" -H "Authorization: Bearer $t" 2>/dev/null || true)"
  if [[ "$code" == "200" ]]; then
    PLAN+=("UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_URL|ok|/ping 200")
    PLAN+=("UPSTASH_REDIS_REST_TOKEN|UPSTASH_REDIS_REST_TOKEN|ok|/ping 200")
  else
    PLAN+=("UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_URL|bad|/ping HTTP $code (URL/token swapped or wrong?)")
    PLAN+=("UPSTASH_REDIS_REST_TOKEN|UPSTASH_REDIS_REST_TOKEN|bad|/ping HTTP $code")
  fi
}

check_axiom() {
  local v code; v="$(vget AXIOM_TOKEN)"
  [[ -z "$v" ]] && { PLAN+=("AXIOM_TOKEN|AXIOM_TOKEN|empty|not in vault"); return; }
  code="$(curl -s -m 8 -o /dev/null -w '%{http_code}' https://api.axiom.co/v1/datasets -H "Authorization: Bearer $v" 2>/dev/null || true)"
  if [[ "$code" == "200" ]]; then PLAN+=("AXIOM_TOKEN|AXIOM_TOKEN|ok|/datasets 200")
  else PLAN+=("AXIOM_TOKEN|AXIOM_TOKEN|bad|/datasets HTTP $code"); fi
}

echo "Validating vault values against live services ${d}(no values printed)${x}…"
check_db; check_jwt; check_upstash; check_axiom

printf '\n  %-26s -> %-26s %s\n' "VAULT KEY" "GITHUB SECRET" "VERDICT"
printf '  %-26s    %-26s %s\n' "---------" "-------------" "-------"
declare -a TO_SYNC
for row in "${PLAN[@]}"; do
  IFS='|' read -r vk gk verdict reason <<<"$row"
  case "$verdict" in
    ok)   printf '  %-26s -> %-26s %bok%b   %s\n' "$vk" "$gk" "$g" "$x" "${d}$reason${x}"; TO_SYNC+=("$vk|$gk") ;;
    bad)  printf '  %-26s -> %-26s %bBAD%b  %s\n' "$vk" "$gk" "$r" "$x" "${y}$reason — will NOT sync${x}" ;;
    *)    printf '  %-26s -> %-26s %bempty%b %s\n' "$vk" "$gk" "$y" "$x" "${d}$reason${x}" ;;
  esac
done

echo
if [[ ${#TO_SYNC[@]} -eq 0 ]]; then echo "${y}Nothing validated — fix .secrets/vault.env (scripts/secrets-vault.sh fill) and re-run.${x}"; exit 0; fi

if [[ $APPLY -eq 0 ]]; then
  echo "${d}Dry-run. Re-run with --apply to push the ${#TO_SYNC[@]} validated value(s) to GitHub.${x}"
  echo "${y}Note:${x} any BAD rows above mean that GitHub secret may be stale — fix the vault or set it"
  echo "      manually, or a main-push deploy could break that service."
  exit 0
fi

echo "${y}About to set ${#TO_SYNC[@]} GitHub Actions secret(s):${x}"
for p in "${TO_SYNC[@]}"; do echo "  - ${p#*|}"; done
printf 'Type YES to proceed: '; read -r ok; [[ "$ok" == "YES" ]] || die "Aborted."
for p in "${TO_SYNC[@]}"; do
  vk="${p%%|*}"; gk="${p#*|}"
  printf 'Setting %s … ' "$gk"
  if printf '%s' "$(vget "$vk")" | gh secret set "$gk" >/dev/null 2>&1; then echo "${g}ok${x}"; else echo "${r}FAILED${x}"; fi
done
echo "Done. ${d}A future main-push deploy will now sync these validated values.${x}"
