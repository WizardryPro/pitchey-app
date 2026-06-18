// Thin client that drives the REAL worker `fetch()` over an in-memory Env.
// No network for the worker boundary itself — we construct Request objects and
// hand them straight to the exported handler, exactly as the runtime would.
//
// A cookie jar is carried across calls so login → authenticated-request flows
// work end-to-end (the live `pitchey-session` cookie path).

import worker from '../../src/worker-integrated';
import { buildTestEnv, makeCtx } from './env';
import type { Env } from '../../src/worker-integrated';

export interface TestClientOptions {
  baseUrl?: string;
  env?: Partial<Env>;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown; // object → JSON; string/FormData passed through
  cookies?: boolean; // default true: send + capture the jar
}

export class TestClient {
  readonly env: Env;
  private readonly baseUrl: string;
  private readonly ctx = makeCtx();
  private jar = new Map<string, string>();

  constructor(opts: TestClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://test.pitchey.local';
    this.env = buildTestEnv(opts.env);
  }

  get cookieHeader(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private captureSetCookie(res: Response) {
    // Cloudflare/undici expose getSetCookie() for multiple Set-Cookie headers.
    const anyHeaders = res.headers as any;
    const cookies: string[] = typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);
    for (const c of cookies) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (value === '' || /deleted|expired/i.test(value)) this.jar.delete(name);
        else this.jar.set(name, value);
      }
    }
  }

  async request(path: string, opts: RequestOptions = {}): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const headers = new Headers(opts.headers ?? {});
    const useCookies = opts.cookies !== false;
    if (useCookies && this.jar.size) headers.set('cookie', this.cookieHeader);

    let body: BodyInit | undefined;
    if (opts.body !== undefined && opts.body !== null) {
      if (typeof opts.body === 'string' || opts.body instanceof FormData) {
        body = opts.body as BodyInit;
      } else {
        body = JSON.stringify(opts.body);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      }
    }

    const req = new Request(url, { method: opts.method ?? 'GET', headers, body });
    const res = await worker.fetch(req, this.env, this.ctx);
    if (useCookies) this.captureSetCookie(res);
    return res;
  }

  get(path: string, opts: RequestOptions = {}) { return this.request(path, { ...opts, method: 'GET' }); }
  post(path: string, body?: unknown, opts: RequestOptions = {}) { return this.request(path, { ...opts, method: 'POST', body }); }
  put(path: string, body?: unknown, opts: RequestOptions = {}) { return this.request(path, { ...opts, method: 'PUT', body }); }
  patch(path: string, body?: unknown, opts: RequestOptions = {}) { return this.request(path, { ...opts, method: 'PATCH', body }); }
  delete(path: string, opts: RequestOptions = {}) { return this.request(path, { ...opts, method: 'DELETE' }); }

  /** Log in via the live portal login path and capture the session cookie. */
  async login(email: string, password: string, portal = 'creator'): Promise<Response> {
    return this.post(`/api/auth/${portal}/login`, { email, password });
  }
}

export async function json<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`Expected JSON, got (${res.status}): ${text.slice(0, 300)}`); }
}
