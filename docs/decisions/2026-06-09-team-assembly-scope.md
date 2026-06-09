# Decision: scope of "Team Assembly" — 2026-06-09

**Status:** Proposed (decision doc, no code)
**Owner:** product
**Trigger:** stakeholder reaction that Team Assembly "is trying to be something else" —
drifting into a production-management workflow rather than a pitch marketplace.

---

## 1. What Team Assembly does today

It's a tab inside the **production pitch-view workspace**
(`frontend/src/portals/production/pages/ProductionPitchView.tsx:1118`), gated behind
`canSeeWorkspace && workspaceUnlocked` (so it only appears for a producer who owns or has
unlocked the workspace on a pitch). Titled **"Team Assembly"** (or **"Your Team Plan"** in
evaluation mode). It has two distinct blocks:

1. **Collaborators** — auto-populated chips: the company owner + any creators who redeemed
   a company **join code** ([[project_company_team_join_codes]]). Nobody types these in;
   they come from real seat membership.
2. **Creative roster** — manual slots for **Director, Producer, Cinematographer (DP),
   Production Designer, Editor, Composer** (and Line Producer). Each is "add a name",
   with a `pending → confirmed` status, editable only when `canEditWorkspace`.

So one block is **real, wired data** (seat membership from join codes) and the other is a
**free-text planning surface** (type in who you want in each chair). The roster doesn't
invite anyone, doesn't attach to the pitch's public record, and doesn't drive any
downstream behaviour — it's a notepad with role labels.

## 2. The tension

Pitchey's current job is a **pitch marketplace**: creators publish pitches, investors and
producers discover and engage them. The creative roster is the first feature that points
at a *different* product — **assembling and tracking a production crew**. That's a
legitimate future direction, but mid-build it muddies the value proposition:

- It reads as "project-management for getting a film made," which raises expectations
  (invite the DP? track availability? contracts?) the product doesn't meet.
- It's half-wired: the Collaborators block is real; the roster is a static form. Users
  can't tell which parts "do something."
- It competes for attention with the pitch itself — the thing the marketplace is actually
  about.

## 3. Options

### A) Cut it for now (hide the roster)
Hide the "Creative roster" block (keep the auto-populated Collaborators, which *is* real
and tied to join codes). Revisit post-launch.
- **Pros:** removes the confusing half-feature immediately; zero data model change; keeps
  the genuinely-wired collaborators view; smallest surface to support at launch.
- **Cons:** loses a (rough) signal some producers may have liked; throws away the UI work
  rather than repurposing it.

### B) Minimise to pitch metadata (recommended)
Reframe the roster from "assemble a crew" to **"attach key creative names to this pitch"** —
i.e. optional metadata on the pitch (e.g. "Attached: Director — Jane Doe"), shown on the
pitch record, with **no** workflow framing (no statuses, no invites, no workspace).
- **Pros:** keeps the one genuinely pitch-relevant idea (a pitch is more fundable with
  names attached) while dropping the production-management drift; turns a notepad into
  real, displayable pitch data; small, contained scope.
- **Cons:** needs a small data model addition (attached-creatives on the pitch) and a
  display surface; requires deciding visibility (public vs NDA-gated) — a modest, but
  non-zero, build.

### C) Keep building toward a production workflow
Commit to crew assembly as a real feature: invitations, availability, confirmation states,
maybe contracts.
- **Pros:** if this is the real long-term bet, sunk-cost now compounds later.
- **Cons:** **explicitly out of scope for the current launch.** It's a second product
  (production management) bolted onto a marketplace, with a large surface (invites,
  notifications, calendars, legal) and the exact "trying to be something else" risk the
  stakeholder named. High cost, unvalidated demand.

## 4. Recommendation

**Lean B, fall back to A.** The stakeholder signal is that the feature is *premature and
confusing*, not that the underlying idea is wrong — so the move is to **keep the
pitch-relevant kernel and shed the workflow framing**, not to keep building the workflow
(C). If B's small metadata build can't be fit before launch, do **A** now (hide the roster,
keep the real Collaborators block) and reconsider B/C post-launch with actual demand
signal. Do **not** ship C for launch.

Concretely, "minimise" (B) means:
- Replace the roster's `pending/confirmed` status chips and per-role workspace editing with
  a flat, optional **"Attached creatives"** list on the pitch (role → name), editable by
  the pitch owner.
- Surface it read-only on the pitch view as metadata (decide public vs NDA-gated).
- Drop the "Team Assembly / Team Plan" workflow language entirely; keep the auto-populated
  Collaborators block as-is (it's real and already correct).
