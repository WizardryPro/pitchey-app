#!/usr/bin/env bash
# SessionStart hook: inject recent CI failures into Claude's context
set -euo pipefail

# Silent exit if gh CLI not available or not in a repo
command -v gh &>/dev/null || exit 0
gh auth status &>/dev/null 2>&1 || exit 0

# Fetch recent failed runs (last 24h, max 3)
RUNS=$(gh run list --status failure --limit 3 \
  --json databaseId,name,createdAt,headBranch,conclusion \
  --jq '[.[] | select(
    (now - (.createdAt | fromdateiso8601)) < 86400
  )]' 2>/dev/null) || exit 0

COUNT=$(echo "$RUNS" | jq 'length' 2>/dev/null) || exit 0
[ "$COUNT" -eq 0 ] && exit 0

# Cap at 2 runs to keep context reasonable
[ "$COUNT" -gt 2 ] && COUNT=2

echo "=== CI/CD STATUS: ${COUNT} recent failure(s) in last 24h ==="
echo ""

for i in $(seq 0 $((COUNT - 1))); do
  RUN_ID=$(echo "$RUNS" | jq -r ".[$i].databaseId")
  RUN_NAME=$(echo "$RUNS" | jq -r ".[$i].name")
  BRANCH=$(echo "$RUNS" | jq -r ".[$i].headBranch")
  CREATED=$(echo "$RUNS" | jq -r ".[$i].createdAt")

  echo "[$(( i + 1 ))] Workflow: ${RUN_NAME} | Branch: ${BRANCH} | ${CREATED} | Run #${RUN_ID}"

  # Get failed job logs (much smaller than full --log)
  LOGS=$(gh run view "$RUN_ID" --log-failed 2>/dev/null | tail -80) || LOGS="(logs unavailable)"

  if [ -n "$LOGS" ]; then
    echo "--- Failed job logs (last 80 lines) ---"
    echo "$LOGS"
  fi
  echo ""
done
