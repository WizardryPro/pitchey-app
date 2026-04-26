/**
 * SPA Fallback — serves index.html for non-API, non-asset routes.
 *
 * Named `_middleware.ts` (not `[[catchall]].ts`) to avoid a wrangler
 * Pages Functions bundler bug: the bundler translates `[[name]].ts`
 * filenames to `routePath: "/:name*"` in v6 path-to-regexp syntax, but
 * the same bundle ships path-to-regexp v8 which rejects that syntax at
 * runtime (CF error 1101). See docs/sessions/2026-04-21-URGENT-status.md.
 *
 * Middleware at `/` receives all requests. `/api/*` requests are passed
 * through via `context.next()` so `api/_middleware.ts` can handle them.
 */
// Paths handled by their own Pages Functions (OG meta-tag injection for social
// unfurls). Must be passed through with context.next(); otherwise this middleware
// short-circuits to ASSETS and the dedicated function never runs.
const SOCIAL_UNFURL_PATHS = [
  /^\/portfolio\/s\/[^/]+\/?$/,
  /^\/slates\/s\/[^/]+\/?$/,
  /^\/og\/portfolio\/[^/]+\/?$/,
  /^\/og\/slate\/[^/]+\/?$/,
];

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  if (SOCIAL_UNFURL_PATHS.some(re => re.test(url.pathname))) {
    return context.next();
  }

  try {
    const response = await context.env.ASSETS.fetch(context.request);
    if (response.status !== 404) {
      return response;
    }
  } catch {
    // Asset fetch failed — fall through to SPA
  }

  const indexUrl = new URL(context.request.url);
  indexUrl.pathname = '/index.html';
  return context.env.ASSETS.fetch(new Request(indexUrl.toString(), context.request));
};
