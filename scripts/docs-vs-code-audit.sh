#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

pass() {
  echo "✅ $1"
}

fail() {
  echo "❌ $1"
  FAILURES=$((FAILURES + 1))
}

echo "Running docs-vs-code drift audit..."

# 1) Better Auth adapter still commented out in worker-integrated.ts
if grep -nE "^[[:space:]]*//[[:space:]]*this\\.authAdapter[[:space:]]*=[[:space:]]*createAuthAdapter\\(env\\);" \
  "$ROOT_DIR/src/worker-integrated.ts" >/dev/null; then
  pass "Better Auth adapter remains commented out in src/worker-integrated.ts."
else
  fail "Expected commented Better Auth adapter line was not found in src/worker-integrated.ts."
fi

# 2) FRONTEND_URL in deployed config matches CLAUDE.md claim
WRANGLER_FRONTEND_URL="$(
  sed -nE "s/^FRONTEND_URL[[:space:]]*=[[:space:]]*['\"]?([^'\"[:space:]]+)['\"]?.*$/\\1/p" \
    "$ROOT_DIR/wrangler.toml" | head -n1
)"

if [[ -z "$WRANGLER_FRONTEND_URL" ]]; then
  fail "Could not read FRONTEND_URL from wrangler.toml."
elif grep -F "$WRANGLER_FRONTEND_URL" "$ROOT_DIR/CLAUDE.md" >/dev/null; then
  pass "wrangler.toml FRONTEND_URL ($WRANGLER_FRONTEND_URL) is documented in CLAUDE.md."
else
  fail "FRONTEND_URL mismatch: wrangler.toml has $WRANGLER_FRONTEND_URL but CLAUDE.md does not."
fi

# 3) Every concrete .pages.dev URL in source/config resolves to HTTP 2xx/3xx.
# Redirects (3xx) are intentionally accepted — canonicalization and HTTPS
# upgrade redirects are legitimate and shouldn't fail the audit. curl uses
# -L to follow redirects, but we still accept bare 3xx in case a URL is
# reached with a redirect-loop or other terminal-3xx condition.
URL_SOURCES=(
  "$ROOT_DIR/src"
  "$ROOT_DIR/frontend/src"
  "$ROOT_DIR/.github/workflows"
  "$ROOT_DIR/wrangler.toml"
  "$ROOT_DIR/.env.example"
  "$ROOT_DIR/.env.production.example"
)

mapfile -t PAGES_URLS < <(
  # Exclude src/workflows/ — parked never-deployed worker per issue #60.
  # Its URLs aren't expected to resolve and changes there are blocked by CLAUDE.md carve-out.
  grep -RhoE --exclude-dir=workflows "https://([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9])\\.pages\\.dev" "${URL_SOURCES[@]}" 2>/dev/null | sort -u
)

if [[ "${#PAGES_URLS[@]}" -eq 0 ]]; then
  fail "No .pages.dev URLs were found in configured source locations."
else
  echo "Checking ${#PAGES_URLS[@]} .pages.dev URL(s)..."
  for url in "${PAGES_URLS[@]}"; do
    status="$(curl -sS -L -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" || true)"
    if [[ -z "$status" ]]; then
      status="000"
    fi
    if [[ "$status" =~ ^[23] ]]; then
      pass "$url returned HTTP $status."
    else
      fail "$url returned HTTP $status (expected 2xx/3xx)."
    fi
  done
fi

if [[ "$FAILURES" -gt 0 ]]; then
  echo
  echo "Drift audit failed with $FAILURES issue(s)."
  exit 1
fi

echo
echo "Drift audit passed."
