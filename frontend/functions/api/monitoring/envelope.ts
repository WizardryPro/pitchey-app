/**
 * Sentry Tunnel — Cloudflare Pages Function
 *
 * Proxies Sentry envelope requests through our own domain so events aren't
 * blocked by ad/privacy blockers that block *.ingest.sentry.io at the
 * network level. The browser sends envelopes to this same-origin endpoint,
 * which forwards them to the real Sentry ingest URL.
 *
 * Sentry SDK config: `tunnel: '/api/monitoring/envelope'` in Sentry.init()
 *
 * Security: we parse the envelope header to extract the DSN and reject
 * anything that isn't our known Sentry host + project, so this endpoint
 * can't be abused as an open proxy.
 */

// Allow-list for abuse prevention — must match the VITE_SENTRY_DSN the
// frontend is configured with.
const SENTRY_HOST = 'o4510137537396736.ingest.de.sentry.io';
const KNOWN_PROJECT_IDS = new Set(['4510138308755536']);

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Read as ArrayBuffer to preserve exact bytes. Replay segments contain binary
    // rrweb data that would be corrupted by `request.text()` text-decoding
    // (previously 400'd upstream with "missing newline after header or payload"
    // because of lossy decode — 2026-04-17 fix).
    const envelopeBytes = await request.arrayBuffer();
    const envelopeView = new Uint8Array(envelopeBytes);

    // Header is JSON on the first line — parse just that slice, forward raw bytes.
    const firstNewline = envelopeView.indexOf(0x0a);
    if (firstNewline === -1) {
      return new Response('Malformed envelope', { status: 400 });
    }

    const headerText = new TextDecoder().decode(envelopeView.subarray(0, firstNewline));
    const header = JSON.parse(headerText);
    if (!header.dsn || typeof header.dsn !== 'string') {
      return new Response('Missing dsn', { status: 400 });
    }

    const dsnUrl = new URL(header.dsn);
    if (dsnUrl.hostname !== SENTRY_HOST) {
      return new Response('Invalid sentry host', { status: 400 });
    }

    const projectId = dsnUrl.pathname.replace(/^\//, '');
    if (!KNOWN_PROJECT_IDS.has(projectId)) {
      return new Response('Invalid sentry project', { status: 400 });
    }

    const upstream = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;

    const upstreamResponse = await fetch(upstream, {
      method: 'POST',
      body: envelopeBytes,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        'content-type':
          upstreamResponse.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'tunnel error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
