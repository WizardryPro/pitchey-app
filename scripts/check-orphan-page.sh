#!/usr/bin/env bash
# Per-file orphan-page check for the Pitchey frontend.
#
# Reads a Claude Code PostToolUse JSON payload on stdin (with .tool_input.file_path).
# If the touched file is a frontend page that's neither imported nor wired into a
# <Route> in App.tsx, prints a JSON {systemMessage: "..."} to stdout for the
# Claude Code UI. Non-blocking — always exits 0.
#
# Allowlist: frontend/.orphan-pages-allowlist (lines must be `path # comment`,
# comment required; blank lines and `# ...` lines are ignored).

set -uo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Read stdin; tolerate non-JSON or missing field.
file_path="$(jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[[ -z "$file_path" ]] && exit 0

# Make path relative to repo root.
rel_path="${file_path#"$REPO_ROOT/"}"

# Only frontend pages — not components, hooks, contexts, utils.
case "$rel_path" in
  frontend/src/pages/*.tsx) ;;
  frontend/src/portals/*/pages/*.tsx) ;;
  *) exit 0 ;;
esac

# Skip test files even if they live under pages/.
[[ "$rel_path" == *__tests__* ]] && exit 0
[[ "$rel_path" == *.test.tsx ]] && exit 0

# Allowlist check — `path # comment` format, comment required.
allowlist="$REPO_ROOT/frontend/.orphan-pages-allowlist"
if [[ -f "$allowlist" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([^[:space:]]+)[[:space:]]+#[[:space:]]+.+ ]]; then
      [[ "${BASH_REMATCH[1]}" == "$rel_path" ]] && exit 0
    fi
  done < "$allowlist"
fi

basename="$(basename "$rel_path" .tsx)"
app_tsx="$REPO_ROOT/frontend/src/App.tsx"
[[ ! -f "$app_tsx" ]] && exit 0

imported=false
routed=false
# Resolve the LOCAL BINDING the page is imported as, since pages are commonly aliased —
# e.g. `const Marketplace = lazyRetry(() => import('./pages/MarketplaceEnhanced'))` routes
# as `<Marketplace />`, not `<MarketplaceEnhanced />`. Without this, every aliased page
# import false-positives as "imported but no <Route> uses it".
import_line="$(grep -E "import[^;]*['\"][^'\"]*\\b${basename}(\\.tsx?)?['\"]" "$app_tsx" | head -1)"
binding="$basename"
if [[ -n "$import_line" ]]; then
  imported=true
  if [[ "$import_line" =~ const[[:space:]]+([A-Za-z0-9_]+)[[:space:]]*= ]]; then
    binding="${BASH_REMATCH[1]}"          # const Alias = lazy(() => import('…'))
  elif [[ "$import_line" =~ import[[:space:]]+([A-Za-z0-9_]+)[[:space:]]+from ]]; then
    binding="${BASH_REMATCH[1]}"          # import Alias from '…'
  fi
fi
# Routed: `<Binding` followed by space, `/`, or `>` — guards against partial-name false-positives.
if grep -qE "<${binding}[[:space:]/>]" "$app_tsx"; then
  routed=true
fi

if $imported && $routed; then
  exit 0
fi

if $imported && ! $routed; then
  status="imported but no <Route> uses it"
elif ! $imported && $routed; then
  status="routed but never imported (broken JSX?)"
else
  status="neither imported nor routed"
fi

msg="⚠️  Orphan check: ${rel_path} — ${status}.
   Verified against: frontend/src/App.tsx
   To park this file, add a line to frontend/.orphan-pages-allowlist:
     ${rel_path} # parked: <reason or issue #>"

jq -n --arg m "$msg" '{systemMessage: $m}'
exit 0
