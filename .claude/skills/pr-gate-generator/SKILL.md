---
name: pr-gate-generator
description: Generate a verification-gate block for a risky pull request — a numbered set of checks (G1, G2, …) that must each pass before merge, each mapped to a concrete CI check or manual verification step. Use this whenever the user is opening a PR for something risky (auth changes, schema migrations, payment paths, dependency removals, security fixes) and wants merge-gating discipline, or asks for "verification gates", "PR gates", "G1-G5 style checks", "what needs to pass before I merge this", or "a gate block for this PR". Especially relevant for solo-founder workflows where there's no second reviewer, so the gates are the safety net.
---

# PR Verification-Gate Generator

## Why gates exist

When you're the only engineer, there's no second pair of eyes on a risky merge. A gate block
replaces the reviewer with an explicit, checkable contract: a numbered list of conditions that
must *each* hold before the PR merges. Gates turn "I think this is fine" into "here are the
five things that prove it's fine, and here's how each was verified." They're most valuable on
changes where a silent regression is expensive — auth, migrations, payments, dep removals,
CSP/CORS, security fixes.

A gate is not a TODO and not a vibe. Each gate is a falsifiable claim plus the mechanism that
falsifies it. If you can't say *how* a gate is checked, it isn't a gate yet.

## Anatomy of a good gate

Each gate has three parts:

- **The claim** — a single specific thing that must be true. "Auth still works" is too broad.
  "An unauthenticated request to a protected route returns 401, not 200" is a gate.
- **The check** — how it's verified. Prefer automated (a CI job, a test, a script) over manual.
  If manual, the steps must be exact enough that someone else could run them identically.
- **The evidence** — what output proves it passed. A green CI check name, a test ID, a curl
  response, a screenshot. "Looks good" is not evidence.

Number them G1, G2, … in rough order of blast radius — the gate whose failure would be most
catastrophic goes first.

## How to build the gate block

1. **Identify what the PR actually risks.** Read the diff or the user's description. Ask: what
   breaks silently if this is wrong? What's the worst regression that wouldn't show up as an
   obvious crash? Those failure modes are what gates defend against — one gate per distinct
   failure mode, not one per file changed.

2. **Prefer the strongest available check per gate.** The hierarchy: existing CI job > new
   automated test > script run in the PR > exact manual repro steps. Push each gate as far up
   that hierarchy as the situation allows. If a gate can only be manual, say so explicitly and
   write the steps so they're reproducible, not gestural.

3. **Cover the rollback.** For migrations, dep removals, and infra changes, one gate should
   always be "this can be reverted cleanly" — proven, not assumed. A change you can't safely
   undo is a different risk category and the user should know that up front.

4. **Keep it to the gates that matter.** Three sharp gates beat eight ceremonial ones. If a
   gate would pass regardless of whether the change is correct, it's noise — cut it. Every gate
   should be capable of *failing* in a way that catches a real mistake.

## Output format

Produce this block, ready to paste into the PR description:

```
## Verification Gates
This PR does not merge until every gate below is green.

**G1 — <claim>**
- Check: <how it's verified — CI job name / test / script / manual steps>
- Evidence: <what proves it passed>
- Status: ☐ pending

**G2 — <claim>**
- Check: …
- Evidence: …
- Status: ☐ pending

… (as many as the risk warrants, ordered by blast radius)

### Rollback
- <how this change is reverted if a gate fails post-merge, or if a problem surfaces later>
```

## Worked example

For an auth-adapter removal (ripping out a vestigial auth library), reasonable gates:

- **G1 — Protected routes still reject unauthenticated requests.** Check: integration test
  hitting a protected route with no session cookie expects 401. Evidence: CI job `auth-e2e` green.
- **G2 — Existing sessions remain valid across the change.** Check: script that creates a
  session pre-deploy, reads it post-deploy. Evidence: script exit 0, session resolves.
- **G3 — No references to the removed library remain.** Check: `grep -r "better-auth" src/`
  returns nothing. Evidence: CI grep step green / empty output.
- **G4 — Bundle builds and deploys to preview.** Check: wrangler build + preview deploy.
  Evidence: preview URL responds 200 on a known route.
- **G5 — Login → consume-gated action round-trips.** Check: manual or e2e — log in, perform a
  gated action, confirm it succeeds. Evidence: e2e job green or recorded repro.
- **Rollback:** revert the PR; the adapter change is code-only, no schema migration, so revert
  restores prior behavior with no data implications.

Note how each gate could actually fail and catch a specific regression. That's the test of a
real gate versus a ceremonial one.

## Notes

- Match gate count to risk. A one-line copy fix needs no gate block. A payment path or a
  migration might warrant six.
- If the repo has named CI jobs already, map gates onto those exact job names so "green" is
  unambiguous.
- Gates feeding off a migration should reference the specific migration file and the specific
  invariant (row counts preserved, no orphaned FKs, trigger whitelist intact).
