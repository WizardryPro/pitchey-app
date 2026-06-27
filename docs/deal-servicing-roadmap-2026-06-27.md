# Deal-Servicing Roadmap (R2.3) — Pitchey

> **Status: SCOPE ONLY.** This document scopes the deal-servicing build. It does **not** authorize starting it.
> Per `evolution-roadmap-2026-06-26.md` (R2.3) and `project_moat_inventory`, the build below is
> **liquidity-gated** — see §5. Generated 2026-06-27, grounded against live repo state (not memory).

## 0. Why this exists, and why it doesn't start yet

R2.3 is the "next strategic build after moat #7 lands." Moat #7 (structured investor thesis) **has landed**
(migration 116 live, matching engine live, verified end-to-end 2026-06-26). So the schema prerequisite is met.

But the **governing lens of the entire moat review is disintermediation** (`project_moat_inventory`, deep-research
`wf_8a3c39a4-82b`): Pitchey sits in the highest-leakage quadrant (heterogeneous, high-variance, long-comms, complex
deals = film). The peer-reviewed finding is that *better intro-quality without on-platform deal-servicing value
accelerates off-platform leakage*. The defense against that is exactly the build scoped here — **but building it
onto sparse, pre-launch liquidity produces an empty, abandoned escrow flow that signals "broken," not "premium."**

So this roadmap's first job is to make the **trigger** explicit and measurable (§5), so the build starts the day
liquidity is real and not one sprint before.

## 1. Current state — what already ships (do not rebuild)

The deal *record* and *conversation* layers are **live in production**. Verified in `src/worker-integrated.ts` +
`src/handlers/`:

| Layer | Status | Where |
|---|---|---|
| Deal record (`production_deals`: type, state machine, option/purchase/backend/dev-fee/territory/notes) | **LIVE** | insert path fixed mig 111 |
| Producer proposes → Creator Deal Inbox → accept/counter/reject (#6) | **LIVE** | `creator-deals.ts`, `production-deals.ts` |
| Both-sided **outcome capture** (closed_on/off_platform / dead + mutual confirm) — P1 | **LIVE** | mig 114, `deal-outcome.ts` |
| **Reputation loop** (gold on mutually-confirmed honored deal) — P2 | **LIVE** | `creator-reputation.ts` Path B |
| Structured **negotiation thread** `deal_messages` (message/counter + €proposal) — P3 | **LIVE** | mig 115, `deal-messages.ts` |
| Deal-sheet **view** (`getProductionContract` → contract JSON) | **LIVE but a view** | `production-deals.ts:145` — a rendered summary, **not** a signed instrument |

**The disintermediation thread is intentionally PAUSED at P3.** P1–P3 capture *that a deal happened and what it
was*, even when money moves off-platform. They are the cheap, pre-liquidity-safe half of the moat. ✅ Done.

## 2. The gap — what "deal-servicing" actually means

Everything above is **system-of-record + messaging**. None of it touches money or produces a binding artifact.
Deal-servicing = giving parties a reason to **transact on-platform** rather than just record that they transacted
elsewhere. Verified orphan / schema-only today:

- `escrow_accounts` — schema-only since migration 003. **Zero handlers wired.**
- `contracts` / `contract_signatures` — schema-only since migration 004. **Zero handlers wired.**
  (Orphan `src/handlers/contracts.ts` exists but is **not** the live `/api/creator/contracts` route — that uses
  `creator-dashboard.ts:creatorContractsHandler`. Do not revive the orphan.)
- **No Stripe Connect.** The only `connect` hit in the worker is an incidental Stripe health-check string.
- **No money movement, no take-rate.** Subscriptions are the only revenue. Investments are intent-only.

This gap *is* the long-term moat (the thing that makes leaving expensive). It is also the most dangerous thing to
ship early.

## 3. The build — P5, decomposed (LIQUIDITY-GATED — see §5 before starting)

Sequenced so each slice is independently shippable and each earlier slice de-risks the next. Reuse the live
`production_deals` / `deal_messages` spine throughout — **do not** introduce a parallel deal object, **do not**
revive orphaned `contracts.ts` or the parked `src/workflows/` (#60) / `crawl4ai` (#61).

### P5.0 — Binding deal-sheet + e-signature (the cheapest real lock-in)
- **What:** promote `getProductionContract`'s JSON deal-sheet from a *view* into a **signable instrument**.
  Port the **Standard-NDA sign engine to Neon** (it already does click-to-sign + content-hash sealing for NDAs —
  same primitive, new document type). Persist into a real `deal_signatures` table keyed to `production_deals.id`
  (do **not** reuse the orphan `contract_signatures` schema; write a fresh migration matching the live spine).
- **Why first:** no payments, no Connect, no PCI surface. Pure switching-cost: a co-signed, hash-sealed deal sheet
  living on Pitchey is a reason to come back. Reuses an engine that already exists and is trusted (provenance #4).
- **Outcome capture already exists** (P1) — sign-on-platform feeds the *same* mutual-confirm → reputation loop.

### P5.1 — Stripe Connect onboarding (rails, no flow yet)
- **What:** connected-account onboarding for the **paying side** (production/investor). Express accounts.
  Store `stripe_connect_account_id`; gate "ready to transact" on `charges_enabled`/`payouts_enabled`.
- **Why before money:** onboarding/KYC is the slowest, highest-drop-off step. Land it as its own slice so the
  payment slice isn't also debugging KYC. **No `application_fee` yet** — prove onboarding completes first.
- **Hard dependency:** a billing/account decision (who is the platform of record; EUR→GBP adaptive-pricing issue
  already tracked in `project_stripe_live` applies here too).

### P5.2 — Milestone-gated payment (option fee first, the simplest money)
- **What:** the **option payment** (smallest, most common first transaction) moves on-platform: production funds an
  option → held → released to creator on a milestone the deal already models. Milestones already exist conceptually
  in the deal state machine; wire the *first* one to a real transfer.
- **Take-rate:** `application_fee_amount` on the transfer is **the first real take-rate the platform has ever had.**
  Start small and visible; do not bury it.
- **Escrow:** use Stripe's hold/capture or a separate-charges-and-transfers pattern. **Do not** revive the
  `escrow_accounts` table as a ledger you reconcile by hand — let Stripe be the ledger.

### P5.3 — Full milestone payout schedule
- Generalize P5.2 from "option fee" to the deal's full milestone set (development fee, purchase tranches, backend).
  Only meaningful once P5.2 has real volume.

### P4 (reputation decay) — deferred, post-launch, destructive
Tracked separately in `project_moat_inventory` (P4). Reverses the promote-only invariant; **nothing to decay
pre-launch** (1 demo gold creator, 0 honored deals). Do not bundle into P5. Revisit when a real gold cohort exists.

## 4. Explicit non-goals (the DO-NOT-BUILD list, deal-servicing edition)

- ❌ Revive `escrow_accounts` / `contracts` / `contract_signatures` migration schemas as the data model — they
  predate the live `production_deals` spine and will fork it. New migrations, keyed to the live spine, only.
- ❌ Revive `src/handlers/contracts.ts` or `src/workflows/investment-*` (#60) — parked by decision, not pending.
- ❌ Hand-rolled escrow ledger. Stripe is the money source-of-truth.
- ❌ A second deal object / a "deals v2." Extend `production_deals` + `deal_messages`.
- ❌ Take-rate before liquidity. A fee on zero deals is friction with no offsetting value — pure leakage incentive.

## 5. The liquidity gate (the actual trigger — measure before building)

**Do not start P5.0 until these are observed.** Per `project_moat_inventory` Open Questions 1 & 2, liquidity must
be *proven*, not assumed, because #3 (de-charge NDA) was declined — the cold-start push relies on #1/#5/saved-search.

Proposed concrete triggers (tune with Karl; these are the scope's recommendation, not a decision):

| Signal | Why it's the gate | Source |
|---|---|---|
| **≥ N verified buyers signing NDAs / week**, trend non-decreasing | proves the demand side is live, not seeded | NDA-graph density (Open Q2) |
| **≥ M `production_deals` reaching a terminal outcome / month** | proves deals actually *close*, not just open | `production_deals.outcome` (P1 data) |
| **≥ X% of closed deals marked `closed_off_platform`** | this is the leakage P5 is designed to capture — high = strong ROI | `deal_outcome` enum |
| Mutual-confirm rate healthy | proves both sides report back (P2 working) | outcome_confirmed_by_* |

The fourth row is the sharpest: **off-platform-close rate is the direct evidence that deal-servicing would pay for
itself.** If deals are closing off-platform at volume, P5.0 (binding sign) → P5.2 (option payment) is justified and
should start. If they're not closing at all, the bottleneck is liquidity (Band-0/Band-2 demand-side work), not
servicing — and P5 would ship onto a vacuum.

**Instrumentation to add *now* (cheap, pre-gate):** a unit-economics tile (Five-Pillars P2, already TODO) reading
the four signals above off the live `production_deals` outcome columns. This is the only deal-servicing-adjacent
*code* worth writing pre-liquidity — it's the dashboard that tells you when to start the rest.

## 6. Recommended next action

1. **Land the gate instrument, not the build.** Add the §5 four-signal tile to the admin/unit-economics surface
   (reads existing mig-114 columns; no new schema). This makes the trigger observable.
2. **Hold P5.0–P5.3 until §5 fires.** When it does, P5.0 (binding e-sign, reusing the NDA sign engine) is the
   first slice — lowest risk, no payment surface, real switching cost.
3. **Karl decision needed before any P5 money slice:** platform-of-record / Connect account model + take-rate %
   (and the EUR→GBP adaptive-pricing question from `project_stripe_live`).

---
*Grounding: verified live route wiring + handlers in `src/worker-integrated.ts`, `src/handlers/deal-outcome.ts`,
`deal-messages.ts`, `production-deals.ts`; escrow/contracts confirmed schema-only (migrations 003/004) with zero
worker imports; no Stripe Connect present. Strategy anchored on `project_moat_inventory` governing lens.*
