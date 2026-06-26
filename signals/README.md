# `signals/` — the artifact layer

This folder is the **shared findings layer** for read-only audit loops. A *signal*
is a single, durable, machine- and human-readable finding emitted by an audit loop.
Signals are the only thing those loops are allowed to produce (plus a one-line
append to `/work-log.md`).

> **Separation of concerns:** `signals/` is intentionally **physically separate from
> the auto-memory** (`~/.claude/projects/.../memory/`). Loops write noise-prone
> candidate findings here; memory holds curated context a human (and the main session)
> rely on. **No loop may ever write to memory.** Reading memory for context is fine.

## What IS a signal

- A concrete, evidence-backed observation from a read-only audit: a type error, a
  lint cluster, a dead route, a swallowed-error site, etc.
- Something a human or a downstream loop might later act on.
- Verified-or-flagged: every signal carries a `status` of `confirmed` or `unverified`
  (see below). A finding is **never** confirmed by the same agent that discovered it.

## What is NOT a signal

- A code change, a fix, a PR, a migration — loops here are **read-only**. Signals
  describe; they do not act.
- A transient run log. One-line "loop ran at T" notes go in `/work-log.md`, not here.
- Curated, load-bearing project knowledge — that belongs in the auto-memory, written
  by a human or the main session, never by a loop.
- Thousands of near-identical lint hits. Aggregate high-volume, low-individual-value
  findings into a single trend signal (see the `audit-type-errors` skill convention).

## File naming

```
signals/<YYYY-MM-DD>-<short-slug>.md
```

e.g. `signals/2026-06-25-typecheck-worker-env-any.md`

## Schema

```markdown
---
id: sig-<YYYY-MM-DD>-<nnn>      # stable id, zero-padded counter within the day
date: <YYYY-MM-DD>              # absolute date, never "today"
severity: low | medium | high
source: <loop/skill name, e.g. audit-type-errors>
status: unverified | confirmed  # confirmed ONLY by the read-only verifier step
---

**Finding:** <one-line summary>

**Evidence:**
<command output excerpt, with file:line references>

**Verifier verdict:** <real finding | false positive | needs-human> — <one line why>

## Timeline
- <YYYY-MM-DD> — first seen
- <YYYY-MM-DD> — still present (re-confirmed) / resolved / re-opened
```

## Status semantics

| status | meaning |
|---|---|
| `unverified` | the finding agent emitted it; the read-only verifier has NOT confirmed it (or marked it `needs-human`). Do not act on it. |
| `confirmed` | a **separate read-only verifier agent** judged it a real finding. Safe to triage. |

## Repeat occurrences

If a later run re-finds an existing signal, **append a dated line to that signal's
`## Timeline`** rather than creating a duplicate file. Match on the underlying
file:line + rule/code, not on the slug.

## Pitchey-specific triage note

This repo carries multiple parallel handler trees (Era 0–6). A type error in an
**orphan** file (not wired through `src/worker-integrated.ts`) or in a **PROTECTED**
parked path (`src/workflows/` #60, `src/workers/crawl4ai-worker.ts` +
`src/services/console-analysis-crawler.ts` #61) is **not** worth fixing — it should be
verified as `false positive` / `needs-human`, never surfaced as a ready fix. See
`STACK.md` → "Orphan / parallel-handler reality".
