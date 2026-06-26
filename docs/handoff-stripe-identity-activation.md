# Handoff — Activate Stripe Identity (Karl, ~2 min)

**Why:** Creator "Silver" verification (the verified-person badge) is fully built and
deployed (PR #323). The only thing blocking it in production is a one-time account toggle
that **only the Stripe account owner can do** — there is no API for it (it's accepting the
Identity Terms of Service).

**Steps (live mode):**
1. Log in to the Stripe Dashboard as the account owner.
2. Make sure the mode switch (top-right) is on **live**, not test.
3. Go to **Settings → Identity** (or search "Identity" in the dashboard search bar).
4. Click **Activate / Get started** and accept the Stripe Identity Terms of Service.

**That's it.** No code change, no redeploy, no webhook change needed afterward — our
integration (`/api/identity/start` → Stripe-hosted flow → retrieve-on-return) starts
working the moment activation completes. The flow lives in creator settings →
Identity Verification card.

**How to confirm it worked:** log in as a creator, open Settings → Identity, click
"Verify my identity." If it opens Stripe's hosted verification page (not an error), it's
live.

_Reference: PR #323, migration 110. Routes `POST /api/identity/start` + `/api/identity/refresh`
(`startIdentityVerification` / `refreshIdentityVerification`, inline in
`src/worker-integrated.ts`). Retrieve-on-return by design (no webhook) so it can't affect
the live billing webhook config._
