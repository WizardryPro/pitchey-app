#!/bin/bash
# Agent coordination signals via filesystem
# Usage: agent-signal.sh <action> <worktree> [message]

SIGNAL_DIR="/tmp/pitchey-agents"
mkdir -p "$SIGNAL_DIR"

ACTION="$1"
WORKTREE="$2"
MESSAGE="$3"

case "$ACTION" in
  done)
    # Builder finished — signal reviewer
    echo "{\"worktree\":\"$WORKTREE\",\"status\":\"done\",\"message\":\"$MESSAGE\",\"timestamp\":\"$(date -Iseconds)\",\"branch\":\"$(git -C /opt/enterprise/$WORKTREE rev-parse --abbrev-ref HEAD 2>/dev/null)\",\"commit\":\"$(git -C /opt/enterprise/$WORKTREE rev-parse --short HEAD 2>/dev/null)\"}" > "$SIGNAL_DIR/$WORKTREE.signal"
    echo "Signal: $WORKTREE done → ready for review"
    ;;
  check)
    # Check if any worktree has pending signals
    for f in "$SIGNAL_DIR"/*.signal; do
      [ -f "$f" ] && cat "$f" && echo ""
    done
    ;;
  consume)
    # Reviewer picks up and clears signal
    if [ -f "$SIGNAL_DIR/$WORKTREE.signal" ]; then
      cat "$SIGNAL_DIR/$WORKTREE.signal"
      rm "$SIGNAL_DIR/$WORKTREE.signal"
    else
      echo "No pending signal for $WORKTREE"
    fi
    ;;
  clear)
    rm -f "$SIGNAL_DIR"/*.signal
    echo "All signals cleared"
    ;;
  *)
    echo "Usage: agent-signal.sh {done|check|consume|clear} <worktree> [message]"
    exit 1
    ;;
esac
