---
name: system-cartographer
description: Produce a bird's-eye architectural map of a codebase plus a grouped menu of strategic directions to pull next. Use this when the user wants to "step back and map the whole system", "see the big picture", "where's the moat / where are the gaps", "give me the data flow end to end", or is doing strategic planning that needs grounding in how the code actually works rather than memory or docs. Trigger on requests for system overviews, architecture maps, "what should I build next" at the strategy altitude, or any "zoom out and show me everything" framing. Built for Claude Code with subagents — spawns parallel exploration agents, then verifies the load-bearing claims against live code before synthesizing, because exploration summaries and the user's own memory/docs are routinely stale in opposite directions.
---

# System Cartographer

## Why this exists and what makes it hard

The goal is a map of a whole system at an altitude where the user can make strategic
decisions — not a file listing, not a feature checklist, but *one mental model* of how the
thing works plus a menu of directions worth pulling. The deliverable is two parts: a
bird's-eye view, and a grouped set of possibilities to choose from.

The trap that ruins this kind of map is **trusting summaries.** Exploration agents skim and
compress; they read whatever version of a file they happen to open and report it as current.
The user's own memory and docs drift from the code over months. Both go stale, and — this is
the key insight — they go stale in *opposite directions*: an agent may report a feature "fully
wired & live" that the user believes is blocked, while the user's notes claim something exists
that was ripped out. A strategy map is load-bearing; if a node is wrong, every direction that
hangs off it is wrong. So the spine of this skill is: explore broadly, then **verify the nodes
the strategy depends on against the actual code**, before synthesizing anything.

If you skip verification you will confidently produce a beautiful map on a false premise. That
is the single most expensive failure mode here.

## The workflow

### 1. Explore from orthogonal angles, in parallel

Spawn separate exploration subagents — one per angle — in the same turn so they run together.
Three angles cover most systems; pick the ones that fit:

- **Request / data flow end-to-end** — how a request physically moves: client → edge/proxy →
  router → data stores → realtime. Where state lives, what the hot paths are.
- **Domain model / entity graph** — the core nouns and the edges between them. What the system
  is *about* underneath the UI.
- **Feature surfaces and gaps** — what's exposed to each user type, what's wired vs. stubbed,
  where the thin spots are.

Give each agent a tight brief and ask it to report concrete `file:line` evidence for its main
claims, not just prose. You'll need those locations to verify.

### 2. Find the load-bearing nodes and distrust them

When the agents return, do not synthesize yet. Read across the three reports and identify the
**claims the strategy will hang on** — the "this is wired", "this is blocked", "this loop is
complete", "this pillar is missing" assertions. These are load-bearing because a strategic
direction is built on each one.

Flag any claim that:
- contradicts the user's stated memory/docs (drift in one direction or the other),
- contradicts another agent's report,
- asserts something is missing/blocked/dead (absence claims are the easiest to get wrong — an
  agent reports "no such route" because it didn't find it, not because it isn't there),
- would, if false, invert a strategic recommendation.

### 3. Verify against live code — directly, not via another summary

For each flagged claim, check the actual source. Grep for the route, open the file at the
reported line, confirm the call sites exist. This is fast and it is the whole point. State what
you found and which way it corrected things — verification that only ever confirms is
verification you didn't really do. Expect to correct *both* the agents and the user's memory;
the transcript that motivated this skill corrected stale claims in both directions, and that's
normal, not exceptional.

### 4. Synthesize to one mental model

Now write the bird's-eye view. The test of a good synthesis: it fits in the user's head as a
single model, and everything else (dashboards, tabs, features) reads as a lens onto that model
or a machine that feeds it. Lead with the model, then state what's genuinely healthy vs. thin —
grounded in what you verified, with the corrections called out explicitly so the user can update
their own mental map.

Distinguish *plumbing gaps* (code that's missing) from *other kinds of gap* (a launch problem, a
liquidity problem, a "we never built the surface that shows value" problem). Conflating these
sends the user to write code when the real gap is elsewhere.

### 5. Offer a grouped menu of directions, then ask

End by laying out the possibilities **grouped by theme** (e.g. growth/liquidity, deepening the
core advantage, trust, operability, hygiene) rather than a flat list — grouping is what makes a
menu choosable. Then stop and ask the user which thread to pull *and* at what altitude they want
the next output, before expanding. Don't pre-build all directions; the map's job is to make the
choice well-informed, not to make it for them.

## Output shape

```
## The whole system in one mental model
<the single model — what the system fundamentally is, how data physically moves>

## Healthy vs. thin (verified)
<what's solid, what's thin — with corrections to stale claims called out explicitly,
 separating plumbing gaps from launch/liquidity/value-surface gaps>

## Directions to pull (grouped)
### <theme A, e.g. liquidity>
- …
### <theme B, e.g. deepen the moat>
- …
<more themes as warranted>

→ Which thread do you want, and at what altitude?
```

## Notes

- The parallel explore + verify pattern is the core; the specific three angles are a default,
  not a rule. A data pipeline or an iOS app would want different angles.
- Verification is cheap relative to being wrong. When in doubt about a load-bearing node, check
  it — a single grep beats a confidently false strategy doc.
- Keep the map at strategy altitude. The user asked to step back; resist diving into any one
  subsystem until they pick a thread.
