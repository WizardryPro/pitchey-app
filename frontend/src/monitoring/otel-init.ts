/**
 * OpenTelemetry frontend RUM init — Pillar 1.6
 *
 * Loaded lazily after first paint. Exports OTLP-HTTP envelopes to the worker
 * envelope proxy at /api/_otel/v1/traces (which attaches AXIOM_TOKEN server-side).
 *
 * Complementary to Sentry: errors → Sentry, traces → Axiom via OTel.
 * Trace propagation headers (traceparent + sentry-trace) flow to the backend
 * so the same request shows up in both places, correlated by trace_id.
 *
 * See docs/otel-handler-wrap-decision-2026-05-05.md.
 */

import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';

let initialized = false;

export function initOtel(): void {
  if (initialized) return;
  initialized = true;

  if (import.meta.env.VITE_OTEL_DISABLED === 'true') return;

  try {
    const isProd = import.meta.env.PROD;
    const sampleRate = isProd ? 0.1 : 1.0;
    const release = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown';

    const provider = new WebTracerProvider({
      // String literals over ATTR_* constants from @opentelemetry/semantic-conventions/incubating —
      // the incubating subpath has churned across 1.x/2.x in ways that have broken downstream builds.
      // The literal keys are stable across versions; the named constants are convenience that costs portability.
      resource: resourceFromAttributes({
        'service.name': 'pitchey-frontend',
        'service.version': release,
        'deployment.environment.name': import.meta.env.MODE,
      }),
      sampler: new TraceIdRatioBasedSampler(sampleRate),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({ url: '/api/_otel/v1/traces' }),
          {
            maxExportBatchSize: 50,
            scheduledDelayMillis: 5000,
            maxQueueSize: 200,
          },
        ),
      ],
    });

    provider.register({
      contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new FetchInstrumentation({
          // Mirrors Sentry tracePropagationTargets — same-origin /api/* through the Pages
          // proxy plus direct-to-Worker calls. Browser-side OTel will inject `traceparent`
          // on requests matching these patterns; the backend already accepts the header
          // (CORS allowlist in src/utils/response.ts:102).
          propagateTraceHeaderCorsUrls: [
            /^\/api\//,
            /pitchey-api-prod\.ndlovucavelle\.workers\.dev/,
          ],
          clearTimingResources: true,
        }),
      ],
    });
  } catch (err) {
    // RUM init must never break the app; drop to console and continue.
    console.warn('[otel] init failed', err);
    initialized = false;
  }
}
