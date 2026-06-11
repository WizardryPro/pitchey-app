#!/usr/bin/env node
/**
 * Production smoke test — hits audit routes, asserts absence of known-bad patterns.
 *
 * Runs on a 30-min cron in CI + on every PR. Catches the kind of drift we've been
 * fixing manually:
 *   - Duplicate chrome (billing/settings/profile regressions)
 *   - Credit pill stuck loading (outage surfacing as "— Credits")
 *   - Login fallback leaking generic errors to users
 *   - API 5xx on page load
 *   - Console errors from the app (not third-party noise)
 *
 * Also runs ACTION-level checks (see ACTION_CHECKS below) that exercise the
 * core revenue/engagement paths per portal — create-pitch draft, NDA request,
 * rate a pitch, like/save, Stripe checkout-URL generation — and assert on a
 * concrete success signal (HTTP 200 + expected response shape), so CI fails
 * when a BUTTON breaks, not just when a page fails to load. These run at the
 * API layer through Playwright's authenticated request context (same auth the
 * UI uses), which is far less flaky than DOM-clicking and still proves the
 * exact endpoint the UI calls is alive and well-shaped.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                  # full run (routes + actions) against prod
 *   BASE_URL=http://localhost:5173 node ...      # against local dev
 *   node scripts/smoke-test.mjs --filter=watcher # only routes matching "watcher"
 *   node scripts/smoke-test.mjs --actions-only   # skip route-load tests, run actions only
 *   node scripts/smoke-test.mjs --skip-actions   # legacy behaviour: route-load tests only
 *
 * Exit codes: 0 = all pass, 1 = one or more routes/actions failed, 2 = script crashed.
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'https://pitchey-5o8.pages.dev';
const FILTER = process.argv.find(a => a.startsWith('--filter='))?.split('=')[1] || '';
const ACTIONS_ONLY = process.argv.includes('--actions-only');
const SKIP_ACTIONS = process.argv.includes('--skip-actions');

const DEMO_ACCOUNTS = {
  creator: { email: 'alex.creator@demo.com', password: 'Demo123', loginPath: '/api/auth/creator/login' },
  investor: { email: 'sarah.investor@demo.com', password: 'Demo123', loginPath: '/api/auth/investor/login' },
  production: { email: 'stellar.production@demo.com', password: 'Demo123', loginPath: '/api/auth/production/login' },
  watcher: { email: 'jamie.watcher@demo.com', password: 'Demo123', loginPath: '/api/auth/login' },
};

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

// Audit routes — the ones we've verified by hand this session.
const ROUTES = [
  { path: '/', as: null },
  { path: '/marketplace', as: null },

  { path: '/creator/dashboard', as: 'creator' },
  { path: '/creator/pitches', as: 'creator' },
  { path: '/creator/billing', as: 'creator' },
  { path: '/creator/ndas', as: 'creator' },
  { path: '/creator/analytics', as: 'creator' },
  { path: '/creator/messages', as: 'creator' },

  { path: '/investor/dashboard', as: 'investor' },
  { path: '/investor/browse', as: 'investor' },
  { path: '/investor/portfolio', as: 'investor' },
  { path: '/investor/billing', as: 'investor' },

  { path: '/production/dashboard', as: 'production' },
  { path: '/production/pitches', as: 'production' },
  { path: '/production/projects', as: 'production' },
  { path: '/production/submissions', as: 'production' },
  { path: '/production/analytics', as: 'production' },
  { path: '/production/ndas', as: 'production' },
  { path: '/production/billing', as: 'production' },

  { path: '/watcher/dashboard', as: 'watcher' },
  { path: '/watcher/library', as: 'watcher' },
  { path: '/watcher/billing', as: 'watcher' },
];

// Text that, if present, indicates a regression we've fixed before.
// Keep this list tight — each entry should be a specific, unambiguous signal.
const BAD_TEXT_PATTERNS = [
  { text: 'User data not received from server', why: 'login fallback error leaking to UI (store did not propagate real server error)' },
];

// Console error messages to ignore (third-party / known-noisy).
const CONSOLE_NOISE = [
  /^Failed to load resource.*favicon/i,
  // Auth client probes /api/auth/session on every page — on public pages this
  // returns 401, which the browser logs as a failed resource load. Expected.
  /^Failed to load resource.*status of 401/i,
  // 429 cascades during the test run itself — we're hitting 36 routes in ~2min,
  // which is denser than any real user and trips burst limiters on auth
  // endpoints. Real users would never hit this; suppressing to avoid flakes.
  /^Failed to load resource.*status of 429/i,
  // Chrome CSP warning for apps that use innerHTML without Trusted Types —
  // browser-level security policy message, not an app bug.
  /TrustedHTML/i,
  /Sentry/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
];

// Transient lazy-chunk load failures. During a CF Pages deploy window, a request
// for a code-split chunk can briefly resolve to the SPA's index.html (wrong MIME)
// or 404 while the edge swaps bundle hashes — producing these console errors even
// though the chunk hash is valid moments later. Real users self-heal via lazyRetry
// (frontend/src/App.tsx), which reloads once to pick up the fresh hashes. The smoke
// harness mirrors that: on seeing one of these, reload once and re-evaluate, so only
// a *persistent* failure (a genuinely broken deploy) trips the gate.
const CHUNK_LOAD_NOISE = [
  /Failed to load module script/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \S+ failed/i,
  /ChunkLoadError/i,
];

// Login once per user type and cache the resulting cookies/storage so the 40+
// route tests can share the auth session. This avoids tripping the API's
// login rate-limiter (~5 attempts / 15 min), which previously 429'd most runs.
const storageStateByUser = new Map();
// Caches the `user` object returned by login (id, userType, …) so action checks
// can resolve the acting user's id without a follow-up /api/users/profile call
// (which can 500 in some envs). Populated by getStorageStateFor.
const loginUserByType = new Map();

async function getStorageStateFor(browser, userType) {
  if (!userType) return undefined;
  const cached = storageStateByUser.get(userType);
  if (cached) return cached;

  const acct = DEMO_ACCOUNTS[userType];
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE_URL}${acct.loginPath}`, {
    data: { email: acct.email, password: acct.password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    await ctx.close();
    throw new Error(`Login as ${userType} → HTTP ${res.status()}`);
  }
  const body = await res.json();
  if (!body.success || !body.user) {
    await ctx.close();
    throw new Error(`Login as ${userType} → success=false`);
  }
  loginUserByType.set(userType, body.user);
  const state = await ctx.storageState();
  await ctx.close();
  storageStateByUser.set(userType, state);
  return state;
}

// ───────────────────────────────────────────────────────────────────────────
// ACTION-LEVEL CHECKS
//
// Each check drives a core per-portal ACTION at the API layer through an
// authenticated Playwright request context (the same cookie the UI sends), so
// a broken button / failed submit FAILS CI loudly — unlike the route-load
// tests above, which only prove the page paints. Every check asserts a
// concrete success signal (HTTP 200/201 + expected response shape), not the
// mere absence of a console error.
//
// PROD-WRITE POLICY (launch is imminent — Stripe is LIVE):
//   • No real payments. The Stripe check asserts the checkout-session URL is
//     returned and NEVER navigates to it (no card is ever submitted → no charge).
//   • Writes are idempotent or self-healing where they touch prod:
//       - like / save        → INSERT … ON CONFLICT DO NOTHING  (re-runnable, no dup)
//       - rate a pitch        → INSERT … ON CONFLICT DO UPDATE   (overwrites same row)
//       - NDA request         → de-duped server-side; after the first run it
//                               returns ALREADY_EXISTS (no further credit burn).
//                               We accept BOTH "fresh request" and ALREADY_EXISTS
//                               as proof the route + auth + credit gate are alive.
//       - create-pitch draft  → inserts a status='draft', visibility='private'
//                               row (NOT published, never appears in marketplace).
//                               This is the one net-new write per run; we tag the
//                               title with a SMOKE-TEST marker so it's greppable
//                               and cleanable. We do NOT publish.
//   Each writing check is annotated "// WRITES TO PROD" below.
//
// Auth: reuses the cached storageState (cookie) from getStorageStateFor so we
// never exceed the login rate-limiter. requestContextFor() hands back a
// Playwright APIRequestContext already carrying that cookie + the production
// Origin header (so CORS-gated handlers behave exactly as they do for the UI).
// ───────────────────────────────────────────────────────────────────────────

const requestContextByUser = new Map();

async function requestContextFor(browser, userType) {
  const cached = requestContextByUser.get(userType);
  if (cached) return cached;
  const storageState = await getStorageStateFor(browser, userType);
  // A BrowserContext-bound APIRequestContext: carries the auth cookie from
  // storageState and the production Origin (CORS) on every request. We expose
  // ctx.request (.get/.post/.delete/.dispose) directly to the action checks.
  const browserCtx = await browser.newContext({
    storageState,
    extraHTTPHeaders: { Origin: BASE_URL, 'Content-Type': 'application/json' },
  });
  requestContextByUser.set(userType, browserCtx.request);
  return browserCtx.request;
}

// Find a published pitch the given user can act on (not their own, for raters).
// Cached across checks so we hit /api/pitches once. excludeOwnerId lets the
// rate/NDA checks skip a pitch owned by the acting user (self-review is blocked).
let _publishedPitchesCache = null;
async function getPublishedPitches(ctx) {
  if (_publishedPitchesCache) return _publishedPitchesCache;
  const res = await ctx.get(`${BASE_URL}/api/pitches?limit=20&status=published`);
  if (!res.ok()) throw new Error(`GET /api/pitches → HTTP ${res.status()}`);
  const body = await res.json();
  const list = Array.isArray(body.data) ? body.data : (body.data?.pitches ?? []);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('GET /api/pitches returned no published pitches to act on');
  }
  _publishedPitchesCache = list;
  return list;
}

async function pickActionablePitch(ctx, excludeOwnerId) {
  const list = await getPublishedPitches(ctx);
  const pick = excludeOwnerId != null
    ? list.find((p) => String(p.user_id) !== String(excludeOwnerId))
    : list[0];
  if (!pick) throw new Error('No published pitch available that is not owned by the acting user');
  return pick;
}

// Shared create-pitch DRAFT check used by both the creator and production
// portals. WRITES TO PROD: inserts a status='draft', visibility='private' row
// (never published → never surfaces in marketplace), then DELETEs it again so a
// successful run leaves zero residue. If the delete fails we don't fail the
// check — the marker title (SMOKE-TEST DRAFT …) makes any stragglers greppable.
async function createDraftCheck(ctx, { genre, format }) {
  const marker = `SMOKE-TEST DRAFT ${new Date().toISOString()}`;
  const res = await ctx.post(`${BASE_URL}/api/pitches`, {
    data: {
      title: marker,
      logline: 'Automated smoke-test draft — safe to delete. Verifies createPitch endpoint.',
      genre,
      format,
    },
  });
  if (!res.ok()) throw new Error(`HTTP ${res.status()} — ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const pitch = body?.data?.pitch;
  if (!pitch?.id) throw new Error(`no pitch.id in response: ${JSON.stringify(body).slice(0, 200)}`);
  if (pitch.status !== 'draft') throw new Error(`expected status=draft, got "${pitch.status}"`);
  // Clean up the draft we just created (owner-scoped DELETE). Best-effort.
  await ctx.delete(`${BASE_URL}/api/pitches/${pitch.id}`).catch(() => {});
}

// An action check is { name, as, run(ctx, browser) }. run() throws on failure;
// returning normally = pass. `as` selects which authed context to use.
const ACTION_CHECKS = [
  // ── CREATOR ──────────────────────────────────────────────────────────────
  {
    name: 'creator: credits balance resolves to a real number (not "—")',
    as: 'creator',
    async run(ctx) {
      const res = await ctx.get(`${BASE_URL}/api/payments/credits/balance`);
      if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
      const body = await res.json();
      const credits = body?.data?.credits ?? body?.data?.balance?.credits;
      if (typeof credits !== 'number' || Number.isNaN(credits)) {
        throw new Error(`credits not numeric: ${JSON.stringify(body?.data)}`);
      }
    },
  },
  {
    name: 'creator: create-pitch saves a DRAFT', // WRITES TO PROD (draft only, never published; deleted on success)
    as: 'creator',
    run: (ctx) => createDraftCheck(ctx, { genre: 'Drama', format: 'Feature Film' }),
  },
  {
    name: 'creator: Stripe checkout URL is generated (NO charge)',
    as: 'creator',
    async run(ctx) {
      // Generates a Stripe Checkout Session and asserts the hosted-checkout URL.
      // We NEVER navigate to it — no card is submitted, so no charge occurs.
      const res = await ctx.post(`${BASE_URL}/api/payments/subscribe`, {
        data: { tier: 'creator', billingInterval: 'monthly' },
      });
      if (!res.ok()) throw new Error(`HTTP ${res.status()} — ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      const url = body?.data?.url;
      if (typeof url !== 'string' || !/^https:\/\/checkout\.stripe\.com\//.test(url)) {
        throw new Error(`no Stripe checkout URL returned: ${JSON.stringify(body?.data)}`);
      }
    },
  },

  // ── INVESTOR ─────────────────────────────────────────────────────────────
  {
    name: 'investor: NDA request endpoint is alive', // WRITES TO PROD (idempotent: de-duped + costs 10cr first time only)
    as: 'investor',
    async run(ctx) {
      const pitch = await pickActionablePitch(ctx, /* excludeOwnerId */ null);
      const res = await ctx.post(`${BASE_URL}/api/ndas/request`, {
        data: { pitchId: String(pitch.id), reason: 'Smoke-test NDA request (automated).' },
      });
      const body = await res.json().catch(() => ({}));
      // Accept: fresh success (201/200 success=true) OR ALREADY_EXISTS (re-run,
      // no extra credit burn). Anything else — 5xx, unexpected error code, or a
      // route 404 — is a genuine break.
      const ok = body?.success === true;
      const alreadyExists =
        body?.error?.code === 'ALREADY_EXISTS' ||
        /already exists/i.test(body?.error?.message || body?.message || '');
      if (!ok && !alreadyExists) {
        throw new Error(`HTTP ${res.status()} — ${JSON.stringify(body).slice(0, 200)}`);
      }
    },
  },
  {
    name: 'investor: rate a pitch (structured-feedback path)', // WRITES TO PROD (idempotent: ON CONFLICT DO UPDATE)
    as: 'investor',
    async run(ctx) {
      // Resolve the acting user's id from the cached login so we never rate our
      // own pitch (server 403s self-review). Login already exposed user.id.
      const myId = loginUserByType.get('investor')?.id ?? null;
      const pitch = await pickActionablePitch(ctx, myId);
      const res = await ctx.post(`${BASE_URL}/api/pitches/${pitch.id}/rate`, {
        data: { rating: 7 },
      });
      if (!res.ok()) throw new Error(`HTTP ${res.status()} — ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      if (body?.success !== true || body?.data?.rating !== 7) {
        throw new Error(`rate did not echo rating=7: ${JSON.stringify(body).slice(0, 200)}`);
      }
    },
  },

  // ── PRODUCTION ───────────────────────────────────────────────────────────
  {
    name: 'production: create-pitch saves a DRAFT', // WRITES TO PROD (draft only, never published; deleted on success)
    as: 'production',
    run: (ctx) => createDraftCheck(ctx, { genre: 'Thriller', format: 'TV Series' }),
  },

  // ── WATCHER ──────────────────────────────────────────────────────────────
  {
    name: 'watcher: like a pitch (then unlike to stay idempotent)', // WRITES TO PROD (ON CONFLICT DO NOTHING + cleanup)
    as: 'watcher',
    async run(ctx) {
      const pitch = await pickActionablePitch(ctx, null);
      const res = await ctx.post(`${BASE_URL}/api/pitches/${pitch.id}/like`);
      if (!res.ok()) throw new Error(`like HTTP ${res.status()} — ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      if (body?.success !== true || body?.data?.liked !== true) {
        throw new Error(`like did not return liked=true: ${JSON.stringify(body).slice(0, 200)}`);
      }
      // Clean up so we don't accumulate state / leave a like the watcher didn't intend.
      await ctx.delete(`${BASE_URL}/api/pitches/${pitch.id}/like`).catch(() => {});
    },
  },
  {
    name: 'watcher: save a pitch (then unsave to stay idempotent)', // WRITES TO PROD (ON CONFLICT DO NOTHING + cleanup)
    as: 'watcher',
    async run(ctx) {
      const pitch = await pickActionablePitch(ctx, null);
      const res = await ctx.post(`${BASE_URL}/api/pitches/${pitch.id}/save`);
      if (!res.ok()) throw new Error(`save HTTP ${res.status()} — ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      if (body?.success !== true || body?.data?.saved !== true) {
        throw new Error(`save did not return saved=true: ${JSON.stringify(body).slice(0, 200)}`);
      }
      await ctx.delete(`${BASE_URL}/api/pitches/${pitch.id}/save`).catch(() => {});
    },
  },

  // ── ANY VIEWER — regression guard for the 2026-05-31 views/track 500 ───────
  {
    name: 'viewer: pitch-detail view tracking survives the double-fire (no 5xx)', // WRITES TO PROD (idempotent: one view row per user+pitch via ON CONFLICT upsert)
    as: 'investor',
    async run(ctx) {
      const pitch = await pickActionablePitch(ctx, null);
      // PitchDetail fires POST /api/views/track twice on mount. Before the
      // ON CONFLICT fix (commit 6af12159), the losing concurrent insert 500'd
      // on the (user_id, pitch_id) unique index — invisible to users (background
      // call) but a real prod error. Fire two concurrently; assert NEITHER 5xxes.
      const fire = () => ctx.post(`${BASE_URL}/api/views/track`, { data: { pitchId: String(pitch.id) } });
      const [r1, r2] = await Promise.all([fire(), fire()]);
      for (const r of [r1, r2]) {
        if (r.status() >= 500) {
          throw new Error(`views/track ${r.status()} — ${(await r.text()).slice(0, 200)}`);
        }
      }
    },
  },
];

// Run a single action check with a one-shot retry to absorb cold-start / transient
// flakes, while still failing loudly on a genuinely broken action.
async function runActionCheck(browser, check) {
  const errors = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ctx = await requestContextFor(browser, check.as);
      await check.run(ctx, browser);
      return { name: check.name, as: check.as, errors: [] };
    } catch (err) {
      if (attempt === 2) {
        errors.push(err.message);
      } else {
        // brief backoff before the single retry
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return { name: check.name, as: check.as, errors };
}

async function runRouteTest(browser, route, viewportName, storageState) {
  const viewport = VIEWPORTS[viewportName];
  const context = await browser.newContext({
    viewport,
    // mobile viewport needs touch/mobile emulation to match real render
    isMobile: viewportName === 'mobile',
    hasTouch: viewportName === 'mobile',
    storageState,
  });

  const errors = [];
  const consoleErrors = [];
  const networkErrors = [];

  context.on('page', (page) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!CONSOLE_NOISE.some((re) => re.test(text))) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('response', (res) => {
      const status = res.status();
      const url = res.url();
      // 5xx from our own API = real problem. 4xx is often expected (e.g., unauthenticated probes).
      if (status >= 500 && !url.includes('favicon') && !url.includes('chrome-extension')) {
        networkErrors.push(`${status} ${new URL(url).pathname}`);
      }
    });
  });

  try {
    const page = await context.newPage();
    const resp = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    if (!resp) {
      errors.push('No response from navigation');
    } else if (!resp.ok()) {
      errors.push(`HTTP ${resp.status()} on navigation`);
    }

    // For portal routes, wait explicitly for the layout's <header> to appear (up to 10s)
    // before running assertions. This absorbs cold-deploy lazy-chunk load latency and the
    // lazyRetry-reload edge case (App.tsx) that can briefly push render time past a fixed
    // 2.5s wait. Falls through silently on timeout — the banner assertion below will then
    // correctly trip with "No banner landmark" if the header genuinely never rendered.
    // Non-portal routes (homepage, marketplace) keep the fixed beat.
    const isPortalRoute = /\/(creator|investor|production|watcher|admin)\//.test(route.path);
    const waitForRender = async () => {
      if (isPortalRoute) {
        await page.locator('header').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      } else {
        await page.waitForTimeout(2_500);
      }
    };
    await waitForRender();

    // Deploy-window self-heal: if a transient lazy-chunk load error showed up (CF Pages
    // serving index.html / 404 for a chunk mid-deploy), reload once and re-evaluate —
    // mirroring lazyRetry in App.tsx. We discard the pre-reload errors and judge only the
    // post-reload state, so a genuinely broken deploy (error persists) still trips the gate.
    if (consoleErrors.some((t) => CHUNK_LOAD_NOISE.some((re) => re.test(t)))) {
      consoleErrors.length = 0;
      networkErrors.length = 0;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      await waitForRender();
    }

    // Assertion 1: no "known-bad" text anywhere on the page
    for (const { text, why } of BAD_TEXT_PATTERNS) {
      const count = await page.locator(`text=${JSON.stringify(text)}`).count();
      if (count > 0) errors.push(`Bad pattern "${text}" × ${count} — ${why}`);
    }

    // Assertion 2: portal routes have exactly 1 banner landmark (double-chrome regression).
    // Uses accessibility tree — implicit role="banner" from <header> as top-level landmark.
    if (isPortalRoute) {
      const banners = await page.getByRole('banner').count();
      if (banners > 1) {
        errors.push(`${banners} banner landmarks (double-chrome regression)`);
      } else if (banners === 0) {
        errors.push('No banner landmark (MinimalHeader missing?)');
      }
    }

    // Assertion 3: for authenticated routes, credits pill should resolve to a number, not stay in "—" loading state.
    // Polls up to 3.5s on top of the 2.5s baseline above (6s total). Creator dashboard fans out more parallel
    // requests than any other portal page; on cold-starts the balance fetch can finish >2.5s after DOM-ready.
    // A genuine balance outage still trips this — the pill stays "—" past the full 6s deadline.
    if (route.as) {
      const creditsBtn = page.locator('header button:has-text("Credits"), header button:has-text("credits")').first();
      const POLL_DEADLINE_MS = 3_500;
      const pollStarted = Date.now();
      let creditsText = null;
      while (Date.now() - pollStarted < POLL_DEADLINE_MS) {
        creditsText = await creditsBtn.textContent().catch(() => null);
        if (!creditsText || !/^—/.test(creditsText.trim())) break;
        await page.waitForTimeout(200);
      }
      if (creditsText && /^—/.test(creditsText.trim())) {
        errors.push(`Credits pill still "—" after 6s: "${creditsText.trim()}" (balance endpoint broken or outage)`);
      }
    }

    // Fold accumulated errors
    if (consoleErrors.length > 0) {
      errors.push(
        `Console errors × ${consoleErrors.length}: ${consoleErrors.slice(0, 3).map((s) => s.slice(0, 120)).join(' | ')}`,
      );
    }
    if (networkErrors.length > 0) {
      errors.push(`5xx network × ${networkErrors.length}: ${networkErrors.slice(0, 3).join(' | ')}`);
    }
  } catch (err) {
    errors.push(`Exception: ${err.message}`);
  } finally {
    await context.close();
  }

  return { route: route.path, as: route.as, viewport: viewportName, errors };
}

async function main() {
  const filteredRoutes = FILTER ? ROUTES.filter((r) => r.path.includes(FILTER)) : ROUTES;
  if (!ACTIONS_ONLY && filteredRoutes.length === 0) {
    console.error(`No routes match filter "${FILTER}"`);
    process.exit(2);
  }

  // Actions run on a full run; skipped when --skip-actions, or when a --filter is
  // active (filter targets route-load tests — keep its run fast and predictable).
  const runRoutes = !ACTIONS_ONLY;
  const runActions = !SKIP_ACTIONS && !FILTER;

  console.log(`Smoke test → ${BASE_URL}`);
  if (runRoutes) {
    console.log(`Routes: ${filteredRoutes.length} × 2 viewports = ${filteredRoutes.length * 2} checks`);
  }
  if (runActions) {
    console.log(`Actions: ${ACTION_CHECKS.length} action-level checks`);
  }
  console.log('');

  const browser = await chromium.launch();
  const results = [];
  const actionResults = [];
  const started = Date.now();

  // Inject a real pitch-detail route. The static ROUTES list never visited
  // /pitch/:id, so the whole pitch-detail page — and the /api/views/track call
  // that 500'd on 2026-05-31 — went unexercised. Resolve a published pitch and
  // let the existing per-route 5xx + console listeners cover feedback,
  // engagement, comments, rating, consumption-status and follow-stats too.
  // Skipped under --filter to keep filtered runs predictable.
  const routesToRun = [...filteredRoutes];
  if (runRoutes && !FILTER) {
    try {
      const ctx = await requestContextFor(browser, 'investor');
      const pitch = await pickActionablePitch(ctx, null);
      routesToRun.push({ path: `/pitch/${pitch.id}`, as: 'investor' });
      console.log(`(+ pitch-detail route /pitch/${pitch.id})\n`);
    } catch (err) {
      console.log(`(skipped pitch-detail route — could not resolve a pitch: ${err.message})\n`);
    }
  }

  for (const route of (runRoutes ? routesToRun : [])) {
    let storageState;
    try {
      storageState = await getStorageStateFor(browser, route.as);
    } catch (err) {
      // Record login failure against both viewports for this route and skip the actual navigation.
      for (const viewportName of Object.keys(VIEWPORTS)) {
        process.stdout.write(`  [${viewportName.padEnd(7)}] ${route.path.padEnd(32)} ✗\n`);
        results.push({ route: route.path, as: route.as, viewport: viewportName, errors: [err.message] });
      }
      continue;
    }
    for (const viewportName of Object.keys(VIEWPORTS)) {
      process.stdout.write(`  [${viewportName.padEnd(7)}] ${route.path.padEnd(32)} `);
      const result = await runRouteTest(browser, route, viewportName, storageState);
      process.stdout.write(result.errors.length === 0 ? '✓\n' : '✗\n');
      results.push(result);
      // Small gap between tests to avoid tripping burst rate-limiters on auth
      // + analytics endpoints. 36 routes × 300ms adds ~11s to the total run.
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (runActions) {
    if (runRoutes) console.log('');
    console.log('Action-level checks:');
    for (const check of ACTION_CHECKS) {
      process.stdout.write(`  [${check.as.padEnd(10)}] ${check.name.padEnd(56)} `);
      const result = await runActionCheck(browser, check);
      process.stdout.write(result.errors.length === 0 ? '✓\n' : '✗\n');
      actionResults.push(result);
      await new Promise((r) => setTimeout(r, 300));
    }
    // Close any request contexts we opened for the action checks.
    for (const ctx of requestContextByUser.values()) {
      await ctx.dispose().catch(() => {});
    }
  }

  await browser.close();

  const routePassed = results.filter((r) => r.errors.length === 0).length;
  const routeFailed = results.length - routePassed;
  const actionPassed = actionResults.filter((r) => r.errors.length === 0).length;
  const actionFailed = actionResults.length - actionPassed;
  const totalFailed = routeFailed + actionFailed;
  const duration = ((Date.now() - started) / 1000).toFixed(1);

  console.log('\n' + '─'.repeat(60));
  if (runRoutes) console.log(`Routes:  ${routePassed}/${results.length} passed`);
  if (runActions) console.log(`Actions: ${actionPassed}/${actionResults.length} passed`);
  console.log(`Total:   ${routePassed + actionPassed}/${results.length + actionResults.length} passed in ${duration}s`);
  console.log('─'.repeat(60));

  if (totalFailed > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => x.errors.length > 0)) {
      const tag = r.as ? `as ${r.as}` : 'anon';
      console.log(`\n  ✗ ROUTE ${r.route} [${r.viewport}, ${tag}]`);
      for (const err of r.errors) console.log(`      • ${err}`);
    }
    for (const r of actionResults.filter((x) => x.errors.length > 0)) {
      console.log(`\n  ✗ ACTION [${r.as}] ${r.name}`);
      for (const err of r.errors) console.log(`      • ${err}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(2);
});
