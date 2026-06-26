---
name: morning-brief
description: Show what's on the plate today — lists the Claude Code prompts the audit loops generated, grouped by action (execute = ready fix, investigate = verify first). Reads the freshest prompts from the shared audit-signals branch. Use when the user opens a session and asks "what prompts do I have today", "what's on my plate", "morning brief", "what should I work on", or wants to see pending generated prompts.
---

# morning-brief

The read step of the audit pipeline. The audit + bridge loops generate prompts into the
`audit-signals` PR; this surfaces them so the user's morning is just *read and choose what
to launch*. **Read-only — it lists prompts, it does not run them.**

## Process

### 1. Get the freshest prompts

The `signal-to-prompt-bridge` loop writes prompts to the shared `audit-signals` branch
(not `main`). Pull that view without disturbing the working tree:

```bash
cd <repo>
git fetch origin audit-signals -q 2>/dev/null
# list prompts from the freshest source available
SRC=origin/audit-signals; git rev-parse --verify -q "$SRC" >/dev/null || SRC=origin/main
git ls-tree -r --name-only "$SRC" -- prompts/ | grep -E 'prompts/[0-9].*\.md$'
```
Read each prompt's front-matter with `git show $SRC:<path>` (do NOT check the branch out;
stay on the user's current branch). If neither branch has the prompts yet, fall back to
the local working tree's `prompts/`.

### 2. Group and summarize

For each prompt parse front-matter (`date`, `action`, `signal_status`, `band`, `gates`,
`source_signal`) and the `## Task:` line. Present, newest date first:

```
═══ PROMPTS ON YOUR PLATE — <date> ═══

▶ EXECUTE — ready fixes, run when you choose:
   • <task>  (band<b>/<gates>)  <filename>

🔍 INVESTIGATE — verify before any fix:
   • <task>  <filename>
```

Lead with EXECUTE (actionable now), then INVESTIGATE (needs a decision first). Keep it to
one line per prompt plus the task; the user drills into a file when they pick one.

### 3. Flag freshness + resolved items

- If `origin/audit-signals` doesn't exist yet, say so: the loops haven't pushed (or the
  bridge hasn't run) — fall back to listing `main`'s / the working tree's `prompts/`.
- Optionally note prompts whose `source_signal` finding is already resolved (e.g. the
  worker type error is gone on `main` — re-run the worker tsc gate to check) so the user
  isn't shown stale work. If unsure, list it and mark it "verify still needed".

## Rules

- **Read-only.** Never run a prompt, never check out `audit-signals` over the user's
  branch, never edit anything. The user chooses what to launch.
- Keep it scannable — this is a 10-second "what's on my plate", not a report.
- `execute` = the verifier confirmed it; `investigate` = it didn't (lead with the open
  question). Never present an `investigate` prompt as a ready fix.
