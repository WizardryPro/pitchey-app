#!/usr/bin/env bash
# Session-start summary of orphaned frontend pages.
#
# Walks frontend/src/pages/*.tsx and frontend/src/portals/*/pages/*.tsx, checks
# each against frontend/src/App.tsx for both an import and a <Route> usage, and
# emits a one-line {systemMessage: "..."} JSON if any are orphaned (after
# excluding .orphan-pages-allowlist entries). Silent if zero orphans.

set -uo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

app_tsx="$REPO_ROOT/frontend/src/App.tsx"
[[ ! -f "$app_tsx" ]] && exit 0

# Collect candidate pages.
mapfile -t pages < <(
  find "$REPO_ROOT/frontend/src/pages" -maxdepth 1 -name '*.tsx' -not -name '*.test.tsx' 2>/dev/null
  find "$REPO_ROOT/frontend/src/portals" -path '*/pages/*' -name '*.tsx' \
       -not -path '*__tests__*' -not -name '*.test.tsx' 2>/dev/null
)
[[ ${#pages[@]} -eq 0 ]] && exit 0

# Load allowlist into associative array.
declare -A allowlist=()
allowlist_file="$REPO_ROOT/frontend/.orphan-pages-allowlist"
if [[ -f "$allowlist_file" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([^[:space:]]+)[[:space:]]+#[[:space:]]+.+ ]]; then
      allowlist["${BASH_REMATCH[1]}"]=1
    fi
  done < "$allowlist_file"
fi

orphans=()
for page in "${pages[@]}"; do
  rel="${page#"$REPO_ROOT/"}"
  [[ -n "${allowlist[$rel]:-}" ]] && continue
  basename="$(basename "$page" .tsx)"
  imported=false
  routed=false
  grep -qE "import[^;]*['\"][^'\"]*\\b${basename}(\\.tsx?)?['\"]" "$app_tsx" && imported=true
  grep -qE "<${basename}[[:space:]/>]" "$app_tsx" && routed=true
  if ! $imported || ! $routed; then
    orphans+=("$basename")
  fi
done

[[ ${#orphans[@]} -eq 0 ]] && exit 0

count=${#orphans[@]}
# Cap displayed names at 8 to keep the message short.
if (( count > 8 )); then
  display=("${orphans[@]:0:8}")
  list="$(IFS=', '; echo "${display[*]}"), +$((count - 8)) more"
else
  list="$(IFS=', '; echo "${orphans[*]}")"
fi

msg="ℹ️  ${count} orphan page(s) in frontend/src/{pages,portals/*/pages} — imported and/or routed in App.tsx is missing: ${list}. Add to frontend/.orphan-pages-allowlist (with required # comment) to mark as parked."

jq -n --arg m "$msg" '{systemMessage: $m}'
exit 0
