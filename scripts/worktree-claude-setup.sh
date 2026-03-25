#!/usr/bin/env bash
# worktree-claude-setup.sh — Link a new worktree's Claude memory to the canonical store
#
# Usage: ./scripts/worktree-claude-setup.sh [worktree-path]
#   If no path given, detects all worktrees and links any that are missing.

set -euo pipefail

CANONICAL="/home/dev/.claude/projects/-opt-enterprise-site-a/memory"
PROJECTS_DIR="/home/dev/.claude/projects"

link_worktree() {
    local wt_path="$1"
    # Convert path to Claude's project key format: leading slash → dash, slashes → dashes
    local key
    key=$(echo "$wt_path" | sed 's|^/|-|; s|/|-|g')
    local target="$PROJECTS_DIR/$key/memory"

    # Skip if it's the canonical source
    if [[ "$target" == "$CANONICAL" ]]; then
        return
    fi

    # Create the project dir if it doesn't exist yet
    mkdir -p "$PROJECTS_DIR/$key"

    if [[ -L "$target" ]]; then
        echo "  ✓ $key already linked"
    elif [[ -d "$target" ]]; then
        if [[ -z "$(ls -A "$target" 2>/dev/null)" ]]; then
            rmdir "$target"
            ln -sfn "$CANONICAL" "$target"
            echo "  → $key linked (was empty dir)"
        else
            echo "  ⚠ $key has its own memory — skipping (merge manually if needed)"
        fi
    else
        ln -sfn "$CANONICAL" "$target"
        echo "  → $key linked"
    fi
}

if [[ -n "${1:-}" ]]; then
    # Link a specific worktree path
    link_worktree "$(realpath "$1")"
else
    # Auto-detect all worktrees from the main repo
    main_repo="/opt/enterprise/site-a"
    echo "Linking Claude memory for all worktrees..."
    git -C "$main_repo" worktree list --porcelain | grep '^worktree ' | awk '{print $2}' | while read -r wt; do
        link_worktree "$wt"
    done
    # Also link the parent /opt/enterprise path
    link_worktree "/opt/enterprise"
    echo "Done."
fi
