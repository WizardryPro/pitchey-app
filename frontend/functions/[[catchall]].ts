/**
 * SPA Fallback — serves index.html for all non-API, non-asset routes.
 *
 * When Pages Functions are present, Cloudflare ignores _redirects.
 * This catch-all function replaces the `/* /index.html 200!` rule.
 * The `api/[[path]].ts` function has higher specificity and still
 * handles /api/* requests before this function runs.
 */
export const onRequest: PagesFunction = async (context) => {
  try {
    // Let Cloudflare try to serve the static asset first
    const response = await context.env.ASSETS.fetch(context.request);
    if (response.status !== 404) {
      return response;
    }
  } catch {
    // Asset fetch failed — fall through to SPA
  }

  // Serve index.html for all unmatched routes (SPA client-side routing)
  const url = new URL(context.request.url);
  url.pathname = '/index.html';
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
};
