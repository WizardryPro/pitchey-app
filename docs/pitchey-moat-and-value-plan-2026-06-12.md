# Pitchey — Moat & Value-Workflow Plan

_Produced 2026-06-12 by a grounded multi-agent analysis (7 strategic-lens analysts + a red-team skeptic + a synthesis pass, each reading the live codebase). This is a strategy reference, not a task list — execute pillar-by-pillar. Every claim was checked against real files/tables; citations are inline._

---

## The thesis (read this first)

**Pitchey's only durable moat is the cross-role engagement + NDA-intent graph** — the accumulated, role-typed behaviour of *real verified* investors and producers viewing, saving, signing NDAs on, and rating specific creators' pitches.

The red-team dismantled nearly everything else we might call a "moat," and it was right:

- **Heat Score formula** = ~120 lines of legible SQL, re-derivable from public badge behaviour; at current volume the Bayesian prior dominates, so scores are mostly noise.
- **"Investment thesis"** = a relabelled `bio` TEXT column. **There is no structured genre/stage/cheque schema** (verified — no such columns in migrations). Several "just JOIN the thesis fields" ideas are built on a fiction.
- **NDA flow** = a boolean on a row. **Platform Standard NDA** = a one-time legal cost any competitor pays once.
- **Verification** = third-party API wrappers. **AI** = pass-through Claude calls with no proprietary model/eval/feedback loop.
- **Breadth** (4 portals, compare, slates, boards) = surface area a focused incumbent cherry-picks.

So the strategy is **not to defend the features** — it's to convert latent assets into a *realized, compounding graph*:

1. Force liquidity to flow **push, not pull**, so the graph actually accumulates transactions.
2. Promote the highest-intent edge (**NDA-signing**) and role-weighted attention from a display scalar into **routing and reputation** that sharpen every cycle.
3. Capture each interaction as a **labelled edge** no day-one competitor can replicate.

**The moat is time-plus-liquidity, not code.** A competitor copies any single mechanic in a day; they cannot copy the record of which verified buyers committed to which projects at what rate — because that requires having had both sides transact.

---

## Four pillars

### Pillar 1 — Realized Liquidity (push, not pull)
The substrate exists (Opportunities board, follows, heat, NDA flow) but liquidity is **one-directional pull**: a producer posts a mandate into a void (`createCallHandler` INSERTs with **zero notify**), a creator publishes into silence. Convert every demand/supply event into a *matched, delivered* notification so the graph accumulates real transactions instead of waiting for the counterparty to browse. **Liquidity is the prerequisite for every other pillar** — without it the data graph stays sparse and heat is prior-dominated noise.
> _Defensible because:_ not the fan-out code (trivial) but the resulting **transaction density** — the accumulated record of which verified buyers responded to which mandates at what rate. It's also the chicken-and-egg an incumbent's existing creator base would *still* have to bootstrap on the buy side.

### Pillar 2 — The Cross-Role Intent Graph (heat + NDA-signing + revealed behaviour)
`heat_role_weights` and the NDA-signing edge (the costliest, least-fakeable action) are captured but spent only on a display scalar and access-gating. Promote them to a **routing and reputation layer**: per-investor taste vectors from revealed NDA/save behaviour; NDA item-item co-occurrence ("investors who went protected on this also signed…"); segmented heat (Hot-among-Producers); dwell-weighted quality. Each cycle deposits a new labelled edge that sharpens the next.
> _Defensible because:_ this is the **one genuine network-effects data asset the red-team concedes**. Copyable schema, un-copyable behaviour. Compounds: more usage → better matches → more NDAs → denser graph.

### Pillar 3 — Trust Provenance & Verified Reputation
In a market whose entire fear is **idea theft**, the disclosing side (creators) currently has **no trust artifact** — `verification_tier` is populated only from `company_verifications`, so creators render a perpetually-grey badge. And there is **no priority-of-idea provenance at all**. Build content-hash provenance at publish ("sealed on date"), a creator verification track, public verify-by-token NDA certificates, and reputation derived from the NDA graph (NDAs honoured, verified counterparties, disputes).
> _Defensible because:_ the template and API wrappers are one-time costs, but a creator with a catalogue hash-sealed since date X, and a producer with 30 honoured-NDA records and zero disputes, hold reputation **that only exists because of platform history** — non-transferable, growing, and the exact thing that makes Pitchey THE venue rather than a listing site.

### Pillar 4 — End-to-End Deal Continuity
Discovery→NDA is deep, but the deal itself half-lives off-platform across three disconnected, asymmetric tables (`production_deals` has no creator-side route to respond; `investment_deals` is investor-only-mutable; the only e-sign code is orphaned on the wrong DB driver). Close the loop: a creator deal inbox (accept/counter/reject), a canonical deal object with an append-only event log, click-to-sign deal sheets (porting the proven Standard-NDA sign engine onto Neon), and a bridge from the accepted-collaboration workspace into a signed deal.
> _Defensible because:_ each completed on-platform deal is **both** a switching cost (negotiation history + signed record live only here) **and** a new outcome label for Pillar 2's "what gets funded" graph. The deal room becomes the URL both sides return to at the exact moment money/rights commit.

---

## Top priorities (ranked by leverage = impact ÷ effort)

| # | Move | Pillar | Impact / Effort | Builds on |
|---|------|--------|-----------------|-----------|
| 1 | **Notify thesis/genre-matched creators when an open call is posted** — close the demand→supply loop | Liquidity | high / **S** | `calls.ts` `createCallHandler` (INSERTs, zero notify) + existing `notify()` (line 311) + `open_calls.seeking_*` + heat ranking |
| 2 | **"Who viewed your protected deck" analytics tier** — ship the Creator+ upsell the config already promises | Intent Graph | high / M | `pitch_views.viewer_id` + `view_duration` (already populated), `likerBreakdown`, `subscription_tier` |
| 3 | **Stop charging creators 10 credits to *request* an NDA** — re-capture at the tier | Liquidity | high / **S** | NDA-request charge `worker-integrated.ts:8340` + the prior docs-free precedent |
| 4 | **Content-hash provenance stamp at publish** ("Pitchey Priority Record") + public `/verify/p/:hash` | Trust | high / M | `renderedHash` in `signature_data`, live `createPitch`/`updatePitch`, append-only `pitch_provenance` chain |
| 5 | **Tokenized, tracked slate shares + a real conversion CTA** on the public landing | Liquidity | high / M | `portfolio_share_links` pattern + slate public handler + OG pipeline + `postLoginRedirect.ts` |
| 6 | **Creator Deal Inbox** — accept/counter/reject on `production_deals` | Deal Continuity | high / M | `production_deals` + `createProductionDeal` + `deal_proposed` notification (no `/api/creator/deals` exists today) |
| 7 | **Build the *real* structured thesis schema, then the thesis↔pitch match score** | Intent Graph | high / M | new `preferred_genres[]`/`stage`/`cheque_min/max`/`regions` on investor profile (backfill from `open_calls.seeking_*`), then a match fn |
| 8 | **"Your Pitchey" value dashboard** — make accumulated stored value legible | Trust | med / **S** | `slates.view_count`, `portfolio_share_links.view_count`, `ndas`, `pitches.heat_score`, `verification_tier`, `pitch_follows` |

---

## Sequenced plan

### NOW (weeks) — unblock liquidity + ship the zero-cost wins
- **#1** Notify matched creators on open-call post — fire-and-forget `notify()` fan-out in `createCallHandler`, top-N by heat.
- **#3** Remove the 10-credit NDA-request charge; add a usage-meter line so the entry subscription stops feeling worthless after one action.
- **#8** "Your Pitchey" value dashboard — read-only totals over existing tables; makes built lock-in *felt*.
- Segment heat into per-audience columns (`heat_investor`/`heat_production`) — same CTEs filtered by `user_type`; expose `/api/pitches/hot?audience=investor`.
- Add a "Rising / worth a look" rail to investor + production dashboards driven by heat deltas — routes role-weighted heat back to the buy side to prime cold-start.

### NEXT (this quarter) — convert captured signals into routing, monetization, trust
- **#2** "Who viewed your protected deck" analytics tier — enforce the `subscription_tier` gate on per-viewer detail.
- **#4** Content-hash provenance stamp + public `/verify/p/:hash`.
- **#5** Tokenized tracked slate shares + role-aware conversion CTA on the public landing.
- **#6** Creator Deal Inbox (accept/counter/reject on `production_deals`).
- **#7** Structured thesis schema **first**, then the thesis↔pitch match rails.
- **Creator verification track** — reuse the company-verification auto-check engine so the grey creator badge can finally be earned (closes a visibly broken promise).
- Open referral invites to creators + surface the existing 5-credit bonus in dashboard UI; make the reward double-sided (machinery already exists, just gated/unsurfaced).
- Liquidity instrumentation: emit `call_filled` + `pitch_first_demand` events to the surviving Analytics Engine datasets (no new bindings).

### LATER — deepen the graph into deal-flow product, portable reputation, buy-side monetization
- Per-investor **taste vector** (declared structured thesis + revealed NDA/save/feedback) replacing the global-heat-list "recommendations" stub; recompute on the heat cadence.
- **NDA item-item co-occurrence** rail + match-score shown to the creator in the NDA approval inbox (promotes the highest-intent edge from gate to signal; approve/reject feeds back as a label).
- Canonical **deal object** + append-only `deal_events`; port the Standard-NDA click-to-sign engine onto Neon for deal-sheet/LOI e-sign (**do NOT revive orphaned `contracts.ts`** — wrong DB driver); bridge accepted-collaboration workspace → deal → `production_pipeline`.
- **Reputation** from the NDA + verification graph (NDAs honoured, verified counterparties, 0 disputes) + a breach/dispute channel that degrades a resolved-against signer's tier — turns the NDA from paper into an enforced, reputation-bearing contract.
- Public verify-by-token NDA certificate + **"What Gets Funded"** benchmark (genre×budget×format → feedback term-frequency + interest conversion + deal closure), once deal outcomes exist at volume.
- **Buy-side "Deal Flow" subscription** for investors/production — thesis-matched + heat-rising alerts and early access. Monetizes the capital-rich side by selling *advantage* while browsing/signing stay free to protect liquidity.

---

## The value-workflows that deepen the moat

1. **Mandate-to-match round trip** _(producer/investor + creator, S)_ — Producer posts an open call → `createCallHandler` fans out `notify()` to top heat-ranked genre/budget-matched creators → creator submits an existing pitch → poster notified (already works) → shortlist → NDA → workspace → (later) deal. Turns the Opportunities board from a static listings page into the liquidity flywheel.
2. **Upgrade pulled by buyer attention (not pushed by paywall)** _(creator, M)_ — Creator publishes free → pitch gains role-weighted heat, a Gold investor signs the NDA and opens the deck → free tier shows only "a verified investor viewed your deck" → the Creator+ upsell fires *here* to unlock **who** + dwell time → creator upgrades, messages the warm lead. Value-based pricing at the moment of demonstrated demand, on data already captured.
3. **Seal-then-share: provenance before disclosure** _(creator, M)_ — Publish → auto-seal to `pitch_provenance` (SHA-256 + timestamp + `prev_hash` chain) → "Sealed on [date]" badge → share branded slate/portfolio externally with confidence → NDA certificate embeds the same `content_hash` → creator can later prove via `/verify/p/:hash` the material existed before disclosure. Removes the core theft fear at the moment of exposure.
4. **Branded slate → tracked share → attributed signup** _(sharer + new-user recipient, M)_ — Curate + cover → publish → Copy link mints a tracked token labelled "Netflix dev" → branded OG card (already built) → recipient hits a role-aware CTA bar → "Sign in to request NDA access" → registers → signup attributed → creator sees "Netflix opened your slate 3×, 1 signup." Closes the loop the platform half-built: the OG card earns the click, now the click converts *and* is measured.
5. **Producer proposes → creator counters → both sign → into production** _(creator + production, M)_ — Producer signs NDA → views deck → `POST /api/production/deals` → creator responds in the **new** Deal Inbox → counter → accept → both click-to-sign the deal sheet → "Move into production" seeds `production_pipeline` + milestones. Today this breaks the instant a producer proposes (no creator surface); closing it keeps the money moment on-platform.
6. **Co-NDA discovery rail for the buy side** _(investor + production, M)_ — "Industry peers who went protected on this also requested NDAs on…" (item-item over the `ndas` graph, anonymized per existing privacy tiers). Surfaces high-intent adjacent deal-flow from the least-fakeable signal; each new NDA enriches the graph for everyone.

---

## Do NOT build (tempting non-moats)

- ✗ **A cleverer Heat Score formula / ML ranker** — the formula is re-derivable and prior-dominated at current volume. The moat is the engagement *data*, not the math. Only improve via dwell-weighting + role-segmentation.
- ✗ **A second/"better" lawyer NDA template** — one-time fixed cost. Invest in the verifiable *record* and reputation/dispute layer.
- ✗ **Match rails on the relabelled-bio "thesis"** — there is no structured schema (verified). Build the schema first or the feature is theatre.
- ✗ **AI as a differentiator** (fine-tunes, a proprietary "pitch scorer", more pass-throughs) — no proprietary model/eval/loop. Only build AI where it captures a feedback loop *into* the graph.
- ✗ **More breadth for completeness** (a 5th portal, new boards, another compare variant) — feature count is the opposite of a moat and reads as unfocused.
- ✗ **Pay-to-rank / generic "boost"** — erodes the buy-side trust that is the actual asset. Any paid placement must require Gold verification AND above-median heat.
- ✗ **Reviving orphaned `contracts.ts` e-sign or the parked `workflows`/`crawl4ai` workers** — port the proven Standard-NDA sign *pattern* onto Neon; respect the parked-feature decisions in CLAUDE.md.
- ✗ **User-hostile lock-in** (withholding data export) — GDPR/trust liability and fragile. Ship takeout freely; the moat is the living relationship/reputation/heat graph users *can't* take.

---

## Metrics — is the moat deepening?

- **Open-call fill rate** — % of posted calls getting ≥1 quality submission within 72h (the direct test of #1; was ~0 inbound velocity before).
- **Median time-to-first-NDA-request** on a new pitch, by genre×budget band (the `pitch_first_demand` event; surfaces illiquid corners).
- **NDA-graph density growth** — new signed NDAs/week and distinct verified-counterparty pairs/week (the core moat signal after de-charging #3).
- **Cross-side match→action rate** — of creators notified by match, % that submit; of investors shown matched pitches, % that open/sign.
- **Creator+ upgrade conversion at the "who-viewed-your-deck" moment** + downstream renewal (value-based-pricing health).
- **Slate share → open → signup** by tracked token and inviting role (viral coefficient per role).
- **Repeat-NDA-signer rate** — % of verified buyers who sign a 2nd/3rd NDA (stickiness → deal-flow, not one-shot browsing).
- **% provenance-sealed pitches** and **% of deals reaching click-to-sign on-platform** (are the trust + deal pillars pulling high-value moments onto Pitchey vs leaking to email).

---

## Open questions (resolve before betting big)

1. **Cold-start reality:** is there enough two-sided volume today for *any* data-graph move to escape noise? Honest sequencing answer: **#1/#3/#5 (liquidity + de-charging + distribution) must visibly move NDA-graph density BEFORE** investing in taste vectors / "what gets funded" — else Pillar 2 ships onto sparse data and looks broken.
2. **What is the actual buy-side population?** The whole thesis rests on real verified investors/producers transacting. If the acquisition loop mainly seeds *supply*, the graph stays one-sided. Count active verified buyers signing NDAs/week before betting on the buy-side Deal Flow subscription.
3. **Revenue hole from #3:** does removing the NDA-request charge outrun what the Creator+ tier (#2) backfills? Sequence the tier value to be live *at or before* the de-charge; model the credit re-baseline.
4. **Legal weight of click-to-sign** without real PDF rendering (Workers limitation): is on-demand-HTML + hash defensible for an option/LOI, or does deal e-sign need DocuSign-class integration (what the parked workflows worker assumed and never shipped)?
5. **Provenance: moat vs liability** — a "Sealed on date" badge proves a hash existed in our DB, *not* notarized priority. Frame it so it reassures creators without making a false legal promise.
6. **Incumbent timing (the red-team's biggest risk):** can #1–#6 demonstrably realize liquidity before Coverfly/InkTip or a studio portal bolts on deal-room features with an existing creator base? Argues for ruthless focus on the liquidity + intent-graph pillars and explicit deferral of the do-not-build list.

---

## Immediate read for the next session

The two **S-effort, high-impact** moves are also the most internally consistent with decisions already on record (docs free, messaging free): **#1 (notify on open-call post)** and **#3 (de-charge NDA requests)**. Both are small diffs against known files, both directly grow the one asset that is actually a moat, and #8 (value dashboard) is a pure read that makes the lock-in we *already* shipped legible. That's a coherent first sprint. Everything past it is gated on Open Question 1 — prove liquidity moved before building the graph products on top.

_Method note: this plan came from a 9-agent grounded workflow (`pitchey-moat-plan`); raw per-lens + red-team output retained in the session task artifact `ww5tlsa1i.output`._
