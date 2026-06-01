import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke-regression suite — the silent-failure class.
 *
 * Every bug this file guards against shipped to production WITHOUT throwing an
 * error (so Sentry/Axiom never saw them) and WITHOUT breaking a unit test (jsdom
 * has no layout, and component tests mock the server, so per-user state and
 * round-trips can't be exercised). They were each found only by driving the real
 * app. This suite is that drive, automated.
 *
 *   1. Edit persistence   — Save round-trips to the DB (form → Save → reload → still there)
 *   2. Like hydration     — per-user like state survives a reload (not reset to empty)
 *   3. Save hydration      — per-user bookmark state survives a reload
 *   4. Save reachability   — the edit form's Save button is reachable at a small
 *                            viewport (regression guard for the PortalLayout
 *                            inner-scroll clip that hid the Save button)
 *   5. Gating              — an anonymous viewer sees no document download links
 *
 * Runs against local dev (default baseURL http://localhost:5173) where
 * TURNSTILE_ENABLED is false so the login submit-gate is open. The playwright.config
 * webServer block boots `npm run dev` + `wrangler dev` automatically.
 */

const PORTAL_LOGIN = {
  creator: '/login/creator',
  investor: '/login/investor',
  production: '/login/production',
} as const;

type Portal = keyof typeof PORTAL_LOGIN;

async function login(page: Page, portal: Portal): Promise<void> {
  // NOTE: route is /login/<portal>, NOT /<portal>/login — the older auth.setup.ts
  // had this backwards, which is why its .auth/*-login-failed.png artifacts exist.
  await page.goto(PORTAL_LOGIN[portal]);
  // The normal "Sign in" submit is gated behind Turnstile (disabled with no token
  // in headless). The "Use Demo <Portal> Account" button auto-submits demo creds
  // and isn't gated; with the local/CI worker's TURNSTILE_ENABLED=false the empty
  // token is accepted. (These tests are local/CI only — never against prod, where
  // Turnstile is enforced.)
  await page.getByRole('button', { name: /Use Demo .*Account/i }).click();
  await page.waitForURL(`**/${portal}/dashboard`, { timeout: 20000 });
}

// A stable published demo pitch owned by alex.creator (so the investor is a
// non-owner and Like/Save render). Override with SMOKE_PITCH_ID if seed data shifts.
const PITCH_ID = process.env.SMOKE_PITCH_ID || '229';

/** Open the creator edit page for a pitch directly (auth cookie is set post-login). */
async function openEdit(page: Page, id = PITCH_ID): Promise<void> {
  await page.goto(`/creator/pitch/${id}/edit`);
  await expect(page.getByRole('heading', { name: /Edit Pitch/i })).toBeVisible({ timeout: 20000 });
}

/** Open a pitch detail page. Logged-in → PitchDetail; guest → PublicPitchView. */
async function openPitch(page: Page, id = PITCH_ID): Promise<void> {
  await page.goto(`/pitch/${id}`);
  await page.waitForLoadState('networkidle');
}

test.describe('smoke-regression: silent-failure guards', () => {
  test('1. creator pitch edit persists to the DB (round-trip)', async ({ page }) => {
    await login(page, 'creator');
    await openEdit(page);

    // Capture the current value so we can restore it — this runs on every PR
    // against a shared demo pitch; the test must leave it as it found it.
    const original = await page.getByRole('textbox', { name: /Short Synopsis/i }).inputValue();
    const marker = `E2E persistence ${Date.now()}`;

    await page.getByRole('textbox', { name: /Short Synopsis/i }).fill(marker);
    await page.getByRole('button', { name: /Save Changes/i }).click();
    // Success path redirects to the pitch list.
    await page.waitForURL(/\/creator\/pitches/, { timeout: 20000 });

    // Re-open the edit page fresh — the value must come back from the server.
    await openEdit(page);
    await expect(page.getByRole('textbox', { name: /Short Synopsis/i })).toHaveValue(marker);

    // Restore the original value so the demo pitch isn't left mutated.
    await page.getByRole('textbox', { name: /Short Synopsis/i }).fill(original);
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForURL(/\/creator\/pitches/, { timeout: 20000 });
  });

  test('2. like state survives a reload (server hydration)', async ({ page }) => {
    await login(page, 'investor');
    await openPitch(page);

    const liked = page.getByRole('button', { name: /^Liked$/ });
    const like = page.getByRole('button', { name: /^Like$/ });

    if (await like.isVisible().catch(() => false)) await like.click();
    await expect(liked).toBeVisible();

    await page.reload();
    // Regression guard: before the isLiked-hydration fix this reset to "Like".
    await expect(liked).toBeVisible();

    // Cleanup — leave the pitch unliked.
    await liked.click();
    await expect(like).toBeVisible();
  });

  test('3. save/bookmark state survives a reload (server hydration)', async ({ page }) => {
    await login(page, 'investor');
    await openPitch(page);

    const saved = page.getByRole('button', { name: /^Saved$/ });
    const save = page.getByRole('button', { name: /^Save$/ });

    if (await save.isVisible().catch(() => false)) await save.click();
    await expect(saved).toBeVisible();

    await page.reload();
    // Regression guard: before the isSaved-hydration fix this reset to "Save".
    await expect(saved).toBeVisible();

    await saved.click();
    await expect(save).toBeVisible();
  });

  test('4. edit-page Save button is reachable at a small viewport', async ({ page }) => {
    // Small viewport is where the PortalLayout inner-scroll clip hid the bottom of
    // long forms — the Save button became unreachable. Window-scroll must reach it.
    await page.setViewportSize({ width: 1024, height: 640 });
    await login(page, 'creator');
    await openEdit(page);

    const save = page.getByRole('button', { name: /Save Changes/i });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
  });

  test('5. anonymous viewer sees no document download links', async ({ page }) => {
    // Gating guard: PitchDocuments (script/deck/treatment download links) must not
    // render for an unauthenticated, non-NDA viewer. Image files must never appear
    // as download rows at all.
    await openPitch(page); // no login → anonymous

    // The Media & Assets download list links to /api/media/file/*. None should be
    // visible to anon. (Cover image renders as an <img>, which is allowed.)
    const downloadLinks = page.locator('a[href*="/api/media/file/"]:visible');
    await expect(downloadLinks).toHaveCount(0);
  });
});
