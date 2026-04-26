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
 * Usage:
 *   node scripts/smoke-test.mjs                  # full run against prod
 *   BASE_URL=http://localhost:5173 node ...      # against local dev
 *   node scripts/smoke-test.mjs --filter=watcher # only routes matching "watcher"
 *
 * Exit codes: 0 = all pass, 1 = one or more routes failed, 2 = script crashed.
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'https://pitchey-5o8.pages.dev';
const FILTER = process.argv.find(a => a.startsWith('--filter='))?.split('=')[1] || '';

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

// Login once per user type and cache the resulting cookies/storage so the 40+
// route tests can share the auth session. This avoids tripping the API's
// login rate-limiter (~5 attempts / 15 min), which previously 429'd most runs.
const storageStateByUser = new Map();

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
  const state = await ctx.storageState();
  await ctx.close();
  storageStateByUser.set(userType, state);
  return state;
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
    if (isPortalRoute) {
      await page.locator('header').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    } else {
      await page.waitForTimeout(2_500);
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
  if (filteredRoutes.length === 0) {
    console.error(`No routes match filter "${FILTER}"`);
    process.exit(2);
  }

  console.log(`Smoke test → ${BASE_URL}`);
  console.log(`Routes: ${filteredRoutes.length} × 2 viewports = ${filteredRoutes.length * 2} checks\n`);

  const browser = await chromium.launch();
  const results = [];
  const started = Date.now();

  for (const route of filteredRoutes) {
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

  await browser.close();

  const passed = results.filter((r) => r.errors.length === 0).length;
  const failed = results.length - passed;
  const duration = ((Date.now() - started) / 1000).toFixed(1);

  console.log('\n' + '─'.repeat(60));
  console.log(`Result: ${passed}/${results.length} passed in ${duration}s`);
  console.log('─'.repeat(60));

  if (failed > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => x.errors.length > 0)) {
      const tag = r.as ? `as ${r.as}` : 'anon';
      console.log(`\n  ✗ ${r.route} [${r.viewport}, ${tag}]`);
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
