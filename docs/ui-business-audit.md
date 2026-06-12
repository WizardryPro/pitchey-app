# Pitchey UI/UX Business Value Audit

## Quick Reference: All Routes & CTAs

### Audit Methodology

For each interactive element, evaluate:

| Criteria | Score 1-5 | Question |
|----------|-----------|----------|
| **Visibility** | _ | Is the CTA prominent and easy to find? |
| **Clarity** | _ | Does the user know what will happen when they click? |
| **Value Prop** | _ | Does it communicate benefit to the user? |
| **Placement** | _ | Is it in the logical place in the user journey? |
| **Conversion** | _ | Does it lead to a revenue/engagement action? |

---

## CRITICAL BUSINESS FLOWS TO AUDIT

### 1. Creator Monetization Flow
```
Creator signs up → Creates pitch → Uploads documents →
Sets NDA requirement → Investor discovers → Requests NDA →
Creator approves → Investor views protected content →
Investment negotiation → Deal closed
```

**Key CTAs to check:**
- [ ] "Create Your First Pitch" button - `/creator/dashboard`
- [ ] "Upload Documents" button - `/creator/pitch/new`
- [ ] "Require NDA" toggle - pitch creation form
- [ ] "Approve NDA" button - `/creator/ndas`
- [ ] "View Investment Offers" - dashboard

### 2. Investor Discovery Flow
```
Investor signs up → Browse marketplace → Save interesting pitches →
Request NDA → Sign NDA → Access protected docs →
Perform due diligence → Make investment offer
```

**Key CTAs to check:**
- [ ] "Browse Pitches" - `/investor/dashboard`
- [ ] "Save Pitch" heart icon - pitch cards
- [ ] "Request NDA Access" - pitch detail page
- [ ] "Sign NDA" - NDA modal
- [ ] "Make Offer" / "Express Interest" - pitch detail

### 3. Production Acquisition Flow
```
Production signs up → Browse submissions → Shortlist pitches →
Request NDA → Review protected materials →
Contact creator → Negotiate acquisition
```

**Key CTAs to check:**
- [ ] "View Submissions" - `/production/dashboard`
- [ ] "Shortlist" button - pitch cards
- [ ] "Request Full Access" - pitch detail
- [ ] "Contact Creator" - after NDA approval
- [ ] "Start Negotiation" - collaboration tools

### 4. Targeted Outreach via Identity & Thesis _(unlocked 2026-06-12)_

A pre-discovery trust/matching layer that sits *before* flows 1–3. Each role now has a
role-tailored profile at `/<portal>/settings/profile` that publishes the signals the
other side needs to qualify a match — so outreach is targeted instead of cold.

```
Investor publishes fund identity + investment thesis (genres/stage/cheque size)
   → Creator reads the thesis on the investor's public profile
   → Creator pitches the RIGHT investors (not a spray)
Creator publishes creative statement + portfolio
   → Investor / Production vet the creator's profile before engaging
   → higher-intent NDA requests feed flows 1–3
```

**Why it matters:** raises match quality on both sides of the marketplace, lifting the
conversion rate of the existing discovery → NDA → deal funnel. Before this, investor
settings had no identity beyond a username; investors were undifferentiated.

**Key CTAs to check:**
- [ ] "Edit Investor Profile" card - `/investor/settings`
- [ ] "Edit your full creator profile" launcher - `/creator/settings` Profile tab
- [ ] "Edit your full company profile" launcher - `/production/settings` Profile tab
- [ ] Investment Thesis field saves + shows on public investor profile
- [ ] Creator "About Your Work" + portfolio link save + show on public profile

### 5. Branded Slate Distribution _(unlocked 2026-06-12)_

Turns a Slate (curated pitch collection) into a polished, shareable marketing asset that a
creator or production can send *off-platform* to investors/buyers — an outbound funnel that
drives inbound discovery back into flows 2–3.

```
Creator/Production curates pitches into a Slate → adds a cover/banner image →
publishes → copies the public link (/slates/s/:id) →
shares externally (email / LinkedIn / deck) → recipient lands on a branded hero page →
clicks into individual pitches → enters the discovery → NDA funnel
```

**Why it matters:** the cover image makes the public slate (and its social unfurl) look like
an intentional, branded showcase rather than a bare list — the difference between a link
worth forwarding and one that isn't. This is the platform's main *outbound* sharing surface
(the portfolio share has no banner — it uses the creator avatar; the slate is the branded one).

**Key CTAs to check:**
- [ ] "Add cover image" / "Change cover image" - `/creator/slates/:id`
- [ ] "Publish" toggle - slate editor
- [ ] "Copy link" - slate editor (public link)
- [ ] Cover renders as hero banner on public `/slates/s/:id`

---

## ROUTE-BY-ROUTE AUDIT CHECKLIST

### PUBLIC PAGES

#### Homepage (/)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| "Browse Pitches" | CTA | Drives discovery | ⬜ |
| "Sign Up Free" | CTA | User acquisition | ⬜ |
| "How It Works" | Link | Education/trust | ⬜ |
| Trending carousel | Cards | Engagement | ⬜ |
| Genre filter | Dropdown | Discovery UX | ⬜ |

**Questions:**
- Is the value proposition clear above the fold?
- Do trending pitches load quickly?
- Is there a clear path for each user type (creator/investor/production)?

#### Login Pages (/login/*)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Email input | Form | Authentication | ⬜ |
| Password input | Form | Authentication | ⬜ |
| "Sign In" button | CTA | Core action | ⬜ |
| "Forgot Password" | Link | Retention | ⬜ |
| "Sign Up" link | CTA | User acquisition | ⬜ |
| Remember me | Checkbox | Convenience | ⬜ |

**Questions:**
- Is error messaging helpful?
- Does the page load fast?
- Is social login available/needed?

---

### CREATOR PORTAL

#### Creator Dashboard (/creator/dashboard)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Stats cards (6) | Display | Motivation/progress | ⬜ |
| "Create New Pitch" | CTA | Core revenue action | ⬜ |
| "View All Pitches" | Link | Management | ⬜ |
| Quick Actions sidebar | CTAs | Feature discovery | ⬜ |
| NDA notifications | Alert | Engagement driver | ⬜ |
| Milestone progress | Display | Gamification | ⬜ |

**Critical Questions:**
- Is "Create New Pitch" the most prominent CTA?
- Are pending NDA requests visible?
- Does the stats refresh in real-time?

#### Create Pitch (/creator/pitch/new)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Title input | Form | Core data | ⬜ |
| Logline textarea | Form | Discovery/SEO | ⬜ |
| Genre dropdown | Select | Categorization | ⬜ |
| Format dropdown | Select | Filtering | ⬜ |
| Budget range | Select | Matching | ⬜ |
| Image upload | File | Engagement | ⬜ |
| Video upload | File | Premium feature | ⬜ |
| Document upload | File | NDA-protected content | ⬜ |
| "Require NDA" toggle | Switch | Protection/monetization | ⬜ |
| "Save Draft" | CTA | Retention | ⬜ |
| "Publish" | CTA | Core action | ⬜ |

**Critical Questions:**
- Is the NDA toggle prominent enough?
- Are file size limits clearly communicated?
- Is there auto-save?
- Can users preview before publishing?

#### NDA Management (/creator/ndas)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Pending tab | Tab | Urgency indicator | ⬜ |
| "Approve" button | CTA | Deal enabler | ⬜ |
| "Reject" button | CTA | Protection | ⬜ |
| Requester info | Display | Decision support | ⬜ |
| Company verification | Badge | Trust signal | ⬜ |

**Critical Questions:**
- Can creators see requester's track record?
- Is there bulk approve/reject?
- Are notifications working for new requests?

---

### INVESTOR PORTAL

#### Investor Dashboard (/investor/dashboard)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Portfolio summary | Cards | Overview | ⬜ |
| "Browse Opportunities" | CTA | Deal flow | ⬜ |
| Recommended pitches | Cards | AI matching | ⬜ |
| Saved pitches | List | Engagement | ⬜ |
| "Request NDA" | CTA | Deal progression | ⬜ |
| ROI metrics | Display | Performance tracking | ⬜ |

**Critical Questions:**
- Are recommendations personalized?
- Is the path to signing an NDA clear?
- Can investors track all their NDA statuses?

#### Pitch Detail View (/investor/pitch/:id)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Pitch title/logline | Display | First impression | ⬜ |
| Genre/Format badges | Tags | Filtering | ⬜ |
| "Request NDA" | CTA | Access flow | ⬜ |
| "Save" button | CTA | Engagement | ⬜ |
| Protected docs (blurred) | Display | Value tease | ⬜ |
| Creator profile link | Link | Trust building | ⬜ |
| Similar pitches | Cards | Discovery | ⬜ |

**Critical Questions:**
- Is protected content visibly "locked"?
- Is the NDA request flow frictionless?
- After NDA approval, does content unlock automatically?

---

### PRODUCTION PORTAL

#### Production Dashboard (/production/dashboard)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| New submissions count | Badge | Pipeline visibility | ⬜ |
| "Review Submissions" | CTA | Core workflow | ⬜ |
| Shortlist section | List | Decision pipeline | ⬜ |
| "Request Full Deck" | CTA | NDA flow | ⬜ |
| Active projects | Cards | Project management | ⬜ |

#### Submissions Review (/production/submissions)
| Element | Type | Business Value | Status |
|---------|------|----------------|--------|
| Filter dropdowns | Selects | Efficiency | ⬜ |
| "Shortlist" button | CTA | Pipeline action | ⬜ |
| "Reject" button | CTA | Pipeline action | ⬜ |
| Bulk actions | Checkboxes | Efficiency | ⬜ |
| Pitch preview modal | Modal | Quick review | ⬜ |

---

## COMMON UI PATTERNS TO CHECK

### Dropdowns
- [ ] Genre selector - Does it have all genres? Is "Other" available?
- [ ] Format selector - Is TV/Film/Short clear?
- [ ] Budget range - Are ranges realistic for the industry?
- [ ] Status filters - Do they match actual workflow states?

### Empty States
- [ ] No pitches yet - Does it guide to "Create First Pitch"?
- [ ] No NDA requests - Does it explain what NDAs are for?
- [ ] No investments - Does it guide to marketplace?
- [ ] No team members - Does it prompt to invite?

### Loading States
- [ ] Dashboard cards - Do they show skeleton loaders?
- [ ] File uploads - Is there a progress indicator?
- [ ] API calls - Is there feedback on slow requests?

### Error States
- [ ] Form validation - Are errors inline and helpful?
- [ ] API errors - Is there retry functionality?
- [ ] 404 pages - Do they help users navigate back?

### Notifications
- [ ] NDA request received - Real-time?
- [ ] NDA approved - Triggers unlock?
- [ ] New message - Badge/counter update?
- [ ] Investment interest - Email + in-app?

---

## REVENUE-CRITICAL ELEMENTS

### Subscription CTAs
- [ ] "Upgrade to Pro" - Visibility on free accounts
- [ ] Feature gates - Are premium features clearly marked?
- [ ] Pricing page - Is value proposition clear?

### Transaction Points
- [ ] Investment submission - Secure flow?
- [ ] Payment processing - Stripe integration working?
- [ ] Receipt generation - Automatic?

---

## MOBILE RESPONSIVENESS CHECK

Test each critical CTA on:
- [ ] iPhone SE (small)
- [ ] iPhone 14 (medium)
- [ ] iPad (tablet)
- [ ] Desktop (1920px)

Key issues to look for:
- CTAs too small to tap
- Dropdowns not mobile-friendly
- File upload not working on mobile
- Forms requiring horizontal scroll

---

## AUTOMATED TESTING RECOMMENDATIONS

### Playwright Tests to Add
```javascript
// Test critical user flows
test('Creator can create and publish pitch', async ({ page }) => {
  // Login → Dashboard → Create → Fill form → Publish → Verify
});

test('Investor can request NDA', async ({ page }) => {
  // Login → Browse → Select pitch → Request NDA → Verify pending
});

test('Creator can approve NDA', async ({ page }) => {
  // Login → Dashboard → NDAs → Approve → Verify investor can access
});
```

### Analytics Events to Track
```javascript
// Track these events in Axiom/Analytics
'pitch_created'
'pitch_published'
'nda_requested'
'nda_approved'
'nda_rejected'
'document_downloaded'
'investment_expressed'
'message_sent'
```

---

## ACTION ITEMS TEMPLATE

After audit, create tickets for:

| Priority | Issue | Route | Element | Fix |
|----------|-------|-------|---------|-----|
| P0 | [Critical] | | | |
| P1 | [High] | | | |
| P2 | [Medium] | | | |
| P3 | [Low] | | | |

---

## NEXT STEPS

1. **Manual walkthrough** - Go through each route as each user type
2. **Screenshot each CTA** - Document current state
3. **A/B test ideas** - List hypotheses for improvement
4. **Analytics review** - Check which CTAs have low click rates
5. **User feedback** - Collect pain points from real users
