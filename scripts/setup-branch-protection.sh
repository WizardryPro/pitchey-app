#!/usr/bin/env bash
#
# setup-branch-protection.sh — codifies main's required status checks as IaC.
#
# WHY: this session built an enforcing coverage gate, a backend integration tier, and
# 3 launch-hardening guards — but all were ADVISORY because `main` had NO branch
# protection (a red gate merged anyway). This makes the gates REQUIRED so a red gate
# blocks the merge. Keeping it in-repo means the required set is reviewable and can be
# re-applied if it drifts. (Identified as the #1 highest-leverage fix in
# docs/state-of-the-app-2026-06-19.md.)
#
# Required checks: only gates that run on EVERY PR and reliably pass on good PRs.
#   - "Code Coverage Quality Gate"  (quality-gates.yml — enforcing per-tier floors)
#   - "⚡ Worker Tests"              (ci-cd.yml — build + catch-swallow gate + backend tests)
#   - "🎨 Frontend Tests"           (ci-cd.yml — vitest)
#
# NOT required (deliberately):
#   - "integration" (integration-tests.yml) is path-filtered to src/** + test/integration/**,
#     so it doesn't run on every PR — requiring it would block unrelated (e.g. docs) PRs that
#     never trigger it. FOLLOW-UP: convert it to an always-run gate job that skip-passes when
#     irrelevant, then add it here.
#   - prod smoke / SonarCloud / security scorecard — flaky or informational.
#
# Choices: strict=false (no forced "branch up to date" rebases), enforce_admins=false
# (emergency override stays possible), no required reviews (solo merges still work).
#
# Usage: ./scripts/setup-branch-protection.sh   (needs gh authed with repo admin)

set -euo pipefail

REPO="${REPO:-WizardryPro/pitchey-app}"
BRANCH="${BRANCH:-main}"

command -v gh >/dev/null || { echo "gh CLI not found"; exit 1; }

read -r -d '' BODY <<'JSON' || true
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["Code Coverage Quality Gate", "⚡ Worker Tests", "🎨 Frontend Tests"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Applying branch protection to ${REPO}@${BRANCH}…"
echo "$BODY" | gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  -H "Accept: application/vnd.github+json" --input - >/dev/null

echo "✓ Required status checks on ${BRANCH}:"
gh api "repos/${REPO}/branches/${BRANCH}/protection/required_status_checks" \
  -q '.contexts[]' | sed 's/^/  - /'
