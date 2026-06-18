// Integration-test environment builder.
//
// Stands up a faithful-enough `Env` to drive the REAL worker `fetch()` against a
// REAL (throwaway Neon branch) database. Only the truly external/native bindings
// are stubbed: KV (Map-backed), R2 (Map-backed), queues (no-op). Everything that
// matters for the live SQL/router/handler path — DATABASE_URL, JWT_SECRET, the
// router itself — is real.
//
// DB URL comes from TEST_DATABASE_URL (CI: the per-PR Neon branch; local: a
// disposable branch you provision). We refuse to run against an URL that looks
// like production so a misconfigured env can never write to prod.

import type { Env } from '../../src/worker-integrated';

/** Minimal Map-backed KVNamespace good enough for session/cache/rate-limit use. */
export function makeKV(): KVNamespace {
  const store = new Map<string, { value: string; metadata?: unknown; expires?: number }>();
  const now = () => Date.now();
  const live = (k: string) => {
    const e = store.get(k);
    if (!e) return undefined;
    if (e.expires && e.expires < now()) { store.delete(k); return undefined; }
    return e;
  };
  const kv = {
    async get(key: string, opts?: any) {
      const e = live(key);
      if (!e) return null;
      const type = typeof opts === 'string' ? opts : opts?.type;
      return type === 'json' ? JSON.parse(e.value) : e.value;
    },
    async getWithMetadata(key: string, opts?: any) {
      const e = live(key);
      if (!e) return { value: null, metadata: null };
      const type = typeof opts === 'string' ? opts : opts?.type;
      return { value: type === 'json' ? JSON.parse(e.value) : e.value, metadata: e.metadata ?? null };
    },
    async put(key: string, value: string, opts?: any) {
      const expires = opts?.expirationTtl ? now() + opts.expirationTtl * 1000 : undefined;
      store.set(key, { value: String(value), metadata: opts?.metadata, expires });
    },
    async delete(key: string) { store.delete(key); },
    async list(opts?: any) {
      const prefix = opts?.prefix ?? '';
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null } as any;
    },
  };
  return kv as unknown as KVNamespace;
}

/** Minimal Map-backed R2 bucket — only the methods the worker actually calls. */
export function makeR2(): R2Bucket {
  const store = new Map<string, { body: ArrayBuffer; meta?: any }>();
  const bucket = {
    async put(key: string, value: ArrayBuffer | string, opts?: any) {
      const body = typeof value === 'string' ? new TextEncoder().encode(value).buffer : value;
      store.set(key, { body, meta: opts });
      return { key, size: (body as ArrayBuffer).byteLength } as any;
    },
    async get(key: string) {
      const e = store.get(key);
      if (!e) return null;
      return {
        key,
        body: e.body,
        async arrayBuffer() { return e.body; },
        async text() { return new TextDecoder().decode(e.body); },
        writeHttpMetadata() {},
        httpEtag: '"test"',
      } as any;
    },
    async delete(key: string) { store.delete(key); },
    async head(key: string) { return store.has(key) ? ({ key } as any) : null; },
    async list() { return { objects: [...store.keys()].map((key) => ({ key })), truncated: false } as any; },
  };
  return bucket as unknown as R2Bucket;
}

/** No-op queue. */
function makeQueue(): Queue {
  return { async send() {}, async sendBatch() {} } as unknown as Queue;
}

// Production compute endpoint(s) for the pitchey-production Neon project. Neon
// shares the ROLE PASSWORD across all branches of a project, so the password is
// NOT a safe discriminator — the per-compute *host* is. Every ephemeral test
// branch gets a distinct `ep-*` endpoint; the prod primary is fixed below. This
// is a hostname (not a secret — you can't connect without the password) and it is
// the safety mechanism: it must stay hardcoded so it can't be forgotten.
//
// If prod's primary compute endpoint is ever recreated, add the new `ep-*` id here.
const PROD_ENDPOINT_HOSTS = [
  'ep-old-snow-abpr94lc', // pitchey-production default branch (br-wild-dew-ab2lm8ln)
];

function assertNotProd(url: string) {
  let host = '';
  try { host = new URL(url).hostname; }
  catch { throw new Error('TEST_DATABASE_URL is not a valid URL.'); }

  // 1) Hard denylist: never the production compute endpoint (pooled or direct).
  for (const prod of PROD_ENDPOINT_HOSTS) {
    if (host.includes(prod)) {
      throw new Error(
        `Refusing to run integration tests against the PRODUCTION database (host ${host} ` +
        `matches prod endpoint ${prod}). Point TEST_DATABASE_URL at a disposable Neon branch.`,
      );
    }
  }
  // 2) Defense-in-depth: never the same URL the app uses as its real DB.
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL — use a disposable branch.');
  }
}

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Provision a disposable Neon branch and export its ' +
      'pooled connection string as TEST_DATABASE_URL before running integration tests.',
    );
  }
  assertNotProd(url);
  return url;
}

/** Build a test Env wired to the throwaway DB + in-memory bindings. */
export function buildTestEnv(overrides: Partial<Env> = {}): Env {
  const kv = makeKV();
  const env = {
    DATABASE_URL: getTestDatabaseUrl(),
    JWT_SECRET: 'integration-test-secret-not-for-production',
    BETTER_AUTH_SECRET: 'integration-test-secret-not-for-production',
    FRONTEND_URL: 'http://localhost:5173',
    ENVIRONMENT: 'development' as const,
    // KV namespaces — all share one Map-backed stub unless overridden.
    KV: kv,
    CACHE: makeKV(),
    SESSIONS_KV: makeKV(),
    RATE_LIMIT_KV: makeKV(),
    SESSION_STORE: makeKV(),
    MONITORING_KV: makeKV(),
    // R2 buckets.
    MEDIA_STORAGE: makeR2(),
    NDA_STORAGE: makeR2(),
    PITCH_STORAGE: makeR2(),
    // Queues (no-op — email/notification fire-and-forget).
    EMAIL_QUEUE: makeQueue(),
    NOTIFICATION_QUEUE: makeQueue(),
    // External services intentionally omitted (Stripe/Resend/Redis/Sentry/Turnstile)
    // so handlers exercise their degraded/absent-key branches rather than hitting
    // real APIs. Turnstile is disabled by absence of TURNSTILE_SECRET_KEY.
    ...overrides,
  } as unknown as Env;
  return env;
}

/** A throwaway ExecutionContext — waitUntil swallows fire-and-forget telemetry. */
export function makeCtx(): ExecutionContext {
  return {
    waitUntil(_p: Promise<unknown>) {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
}
