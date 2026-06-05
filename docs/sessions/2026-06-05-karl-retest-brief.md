# Re-test brief — Production portal (for Karl)

**Date:** 2026-06-05 · **Site:** https://pitchey-5o8.pages.dev
**Why:** Everything you reported is fixed and live, plus there's a lot of new production tooling. Please walk these flows and flag anything that feels off. If something's wrong, a screenshot of the page + the `/debug` route (see bottom) tells us almost everything.

**Login:** `stellar.production@demo.com` / `Demo123` (production). Tip: a hard refresh (Ctrl/Cmd+Shift+R) once, so you're on the latest build.

---

## 1. The bugs you reported — please confirm they're fixed

- [ ] **Follow / Like / Share on a pitch.** Open any pitch (e.g. *At Ever Las*). In the header: **Like** (heart) and **Share** should work; next to the creator's name, **Follow** should toggle to **Following**. ✅ expected: all three respond.
- [ ] **Edit a pitch.** Open one of *your own* pitches → the **Edit** button (top-right) should open the editor without the error you hit before.
- [ ] **NDA.** As a production company you can request/sign NDAs; once signed, the full script + materials unlock. (NDAs are now for investors + producers only — creators/watchers won't see a "Request NDA" button.)

## 2. New — the production "workspace" (the big one)

Open a pitch → the tabs **Overview · Feasibility · Team · Notes**:

- [ ] **Feasibility** — completeness of the pitch + a production checklist you can tick off.
- [ ] **Team** — assemble key roles (Director, Producer, DP, …) with names + status (Open/Considering/Confirmed). Hit **Save Team Configuration**.
- [ ] **Notes** — add categorized notes; the **Share** toggle on a note sends it to the creator.
- [ ] You should see an **Editor** (blue) vs **View only** (grey) chip at the top of each tab telling you your access.

**Two modes to notice:**
- On a **creator's** pitch (e.g. *At Ever Las*) it says *"Private workspace — only you can see these notes"* — your private evaluation space.
- On a **production-company** pitch, the company team shares ONE workspace, and a producer who only signed an NDA sees it **read-only**.

## 3. New — "Your Slate" on the dashboard

- [ ] Go to the **Production dashboard** (home). Under the join-code card you'll see **Your Slate** — a funnel: **Evaluating → Reviewing → Packaging → Ready**.
- [ ] Each project card shows its readiness (completeness, checklist %, confirmed roles, NDA). As you fill in a pitch's Feasibility/Team, it should move along the funnel.
- [ ] Click a card → it opens that pitch's workspace.

## 4. New — invite creators to your company (join codes)

- [ ] On the dashboard, the **Invite Creators (Join Code)** card has a code. A creator who enters it (on their dashboard) becomes a seated member of your company and can co-edit your pitches' Team/Notes. (`alex.creator@demo.com` is already a member of your team if you want to test the shared view.)

---

## How to report anything weird
- Screenshot the page.
- Visit **https://pitchey-5o8.pages.dev/debug** and screenshot it too — it shows your session/portal/build so we can reproduce exactly.
- Note which account + which pitch.

Thanks Karl 🙏
