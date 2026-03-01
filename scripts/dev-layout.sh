#!/usr/bin/env bash
# Multi-agent dev layout for Pitchey
# Usage: ./scripts/dev-layout.sh [session-name]
#
# Layout:
#   ┌──────────────────────┬─────────────────┐
#   │                      │  claude (CLI)   │
#   │   nvim .  (editor)   │                 │
#   │                      ├─────────────────┤
#   │   Space a c = inline │  terminal       │
#   │   Claude in editor   │  (servers/tests)│
#   └──────────────────────┴─────────────────┘
#        Ctrl+a y = Claude popup overlay
#
# Pane 1: nvim .          (Space a c for inline Claude)
# Pane 2: claude          (standalone CLI agent)
# Pane 3: terminal        (servers, tests, logs)

set -euo pipefail

SESSION="${1:-pitchey}"
PROJECT="/opt/enterprise/site-a"

# If already inside this session, warn and exit
if [ "${TMUX:-}" ] && tmux display-message -p '#S' 2>/dev/null | grep -qx "$SESSION"; then
    echo "Already inside session '$SESSION'"
    exit 0
fi

# Kill existing session if it exists (fresh start)
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session — use fixed geometry so splits work without a terminal
tmux new-session -d -s "$SESSION" -c "$PROJECT" -x 200 -y 50

# Pane 1 (left, 60%): Neovim
tmux send-keys -t "$SESSION" "nvim ." Enter

# Split right for Claude agent (40% width = 80 cols of 200)
tmux split-window -h -t "$SESSION" -c "$PROJECT" -l 80

# Pane 2 (top-right): standalone Claude CLI
tmux send-keys -t "$SESSION" "claude" Enter

# Split bottom-right for terminal (50% of right column = 25 rows)
tmux split-window -v -t "$SESSION" -c "$PROJECT" -l 25

# Pane 3 (bottom-right): plain terminal
tmux send-keys -t "$SESSION" "# Terminal — run servers, tests, logs here" Enter

# Focus back on nvim pane
tmux select-pane -t "$SESSION:.1"

# Attach (tmux auto-resizes to real terminal dimensions)
if [ "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
else
    tmux attach-session -t "$SESSION"
fi
