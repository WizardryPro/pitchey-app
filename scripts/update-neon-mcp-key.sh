#!/usr/bin/env bash
# Rotate the Neon MCP API key in .mcp.json.
# Prompts for a new napi_ key (no echo), validates it against the Neon API,
# updates the neon server's Authorization header, and clears mcp-remote's auth cache.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_JSON="$REPO_ROOT/.mcp.json"
AUTH_CACHE="$HOME/.mcp-auth"

if [[ ! -f "$MCP_JSON" ]]; then
  echo "ERROR: $MCP_JSON not found" >&2
  exit 1
fi

printf 'Paste new Neon API key (napi_...): '
read -rs NEON_KEY
echo
NEON_KEY="${NEON_KEY//[[:space:]]/}"

if [[ -z "$NEON_KEY" ]]; then
  echo "ERROR: no key entered" >&2
  exit 1
fi
if [[ "$NEON_KEY" != napi_* ]]; then
  echo "ERROR: key should start with 'napi_'" >&2
  exit 1
fi

echo "Validating key against Neon API..."
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $NEON_KEY" \
  https://console.neon.tech/api/v2/projects)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Neon API rejected the key (HTTP $HTTP_CODE). Aborting, no changes made." >&2
  exit 1
fi
echo "Key valid (HTTP 200)."

cp "$MCP_JSON" "$MCP_JSON.bak"
echo "Backed up to $MCP_JSON.bak"

NEON_KEY="$NEON_KEY" python3 - "$MCP_JSON" <<'PY'
import json, os, sys

path = sys.argv[1]
key = os.environ["NEON_KEY"]
with open(path) as f:
    data = json.load(f)

neon = data.get("mcpServers", {}).get("neon")
if not neon:
    sys.exit("ERROR: no 'neon' server in mcpServers")

args = neon.get("args", [])
try:
    i = args.index("--header")
except ValueError:
    sys.exit("ERROR: no --header arg on neon server")

args[i + 1] = f"Authorization: Bearer {key}"

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print("Updated neon Authorization header in", path)
PY

if [[ -d "$AUTH_CACHE" ]]; then
  rm -rf "$AUTH_CACHE"
  echo "Cleared mcp-remote auth cache ($AUTH_CACHE)"
fi

echo
echo "Done. Next: in Claude Code run /mcp and reconnect 'neon'."
echo "If it sticks, delete the backup: rm $MCP_JSON.bak"
