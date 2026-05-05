/**
 * OTel traces envelope proxy — Pillar 1.6
 *
 * Forwards OTLP-HTTP envelopes from the frontend RUM SDK to Axiom, attaching
 * the AXIOM_TOKEN secret server-side (secret cannot be exposed to the browser).
 *
 * Default dataset is `pitchey-traces-rum`; override via env.AXIOM_RUM_TRACES_DATASET.
 * See docs/otel-handler-wrap-decision-2026-05-05.md.
 */

import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';

const AXIOM_TRACES_URL = 'https://api.axiom.co/v1/traces';

export async function otelTracesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Mirrors createAxiomLogger: when the secret is absent (local dev, misconfigured deploy)
  // accept-and-drop rather than 503. Frontend RUM should never make a user-visible failure.
  if (!env.AXIOM_TOKEN) {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const dataset = env.AXIOM_RUM_TRACES_DATASET ?? 'pitchey-traces-rum';
  const contentType = request.headers.get('content-type') ?? 'application/json';

  // arrayBuffer() — not text() — preserves binary protobuf payloads.
  // The Sentry envelope tunnel was silently corrupting binary uploads via .text() until 2026-04-17.
  const body = await request.arrayBuffer();

  const upstream = await fetch(AXIOM_TRACES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.AXIOM_TOKEN}`,
      'X-Axiom-Dataset': dataset,
      'Content-Type': contentType,
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
