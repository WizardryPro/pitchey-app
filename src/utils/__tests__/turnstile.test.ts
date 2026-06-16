/**
 * Tests for src/utils/turnstile.ts
 *
 * verifyTurnstileToken has three distinct behavioural paths:
 *   1. secretKey absent  → skip verification, return success:true (dev/local environments)
 *   2. secretKey present, token absent → return success:false
 *   3. secretKey + token present → call Cloudflare endpoint, propagate result
 *
 * fetch() is stubbed with vi.stubGlobal / vi.fn() — no real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyTurnstileToken } from '../turnstile';

// ---------------------------------------------------------------------------
// fetch stub helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ success: true, 'error-codes': [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )));
}

function mockFetchFailure(codes: string[] = ['invalid-input-response']) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ success: false, 'error-codes': codes }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )));
}

function mockFetchNetworkError() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network unreachable'); }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Path 1: no secretKey configured → graceful degradation
// ---------------------------------------------------------------------------

describe('verifyTurnstileToken — no secretKey (dev mode)', () => {
  it('returns success:true when secretKey is undefined', async () => {
    const result = await verifyTurnstileToken('any-token', undefined);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns success:true when secretKey is empty string', async () => {
    const result = await verifyTurnstileToken('any-token', '');
    expect(result.success).toBe(true);
  });

  it('does NOT call fetch when secretKey absent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken('token', undefined);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns success even when token is also undefined (both absent)', async () => {
    const result = await verifyTurnstileToken(undefined, undefined);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Path 2: secretKey present, token absent
// ---------------------------------------------------------------------------

describe('verifyTurnstileToken — secretKey configured, token missing', () => {
  it('returns success:false when token is undefined', async () => {
    const result = await verifyTurnstileToken(undefined, 'my-secret');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/required/i);
  });

  it('returns success:false when token is empty string', async () => {
    const result = await verifyTurnstileToken('', 'my-secret');
    expect(result.success).toBe(false);
  });

  it('does NOT call fetch when token is undefined', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken(undefined, 'my-secret');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Path 3a: secretKey + token present, Cloudflare returns success
// ---------------------------------------------------------------------------

describe('verifyTurnstileToken — success from Cloudflare', () => {
  it('returns success:true when Cloudflare verifies the token', async () => {
    mockFetchSuccess();
    const result = await verifyTurnstileToken('valid-token', 'secret-key');
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('POSTs to the correct Cloudflare siteverify URL', async () => {
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ success: true, 'error-codes': [] }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken('tok', 'sec');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends secret and response fields in JSON body', async () => {
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ success: true, 'error-codes': [] }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken('my-token', 'my-secret');
    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.secret).toBe('my-secret');
    expect(body.response).toBe('my-token');
  });

  it('includes remoteip in body when provided', async () => {
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ success: true, 'error-codes': [] }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken('tok', 'sec', '1.2.3.4');
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.remoteip).toBe('1.2.3.4');
  });

  it('does NOT include remoteip when not provided', async () => {
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ success: true, 'error-codes': [] }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken('tok', 'sec');
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.remoteip).toBeUndefined();
  });

  it('sets Content-Type: application/json on the verify request', async () => {
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ success: true, 'error-codes': [] }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchSpy);
    await verifyTurnstileToken('tok', 'sec');
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Path 3b: secretKey + token present, Cloudflare returns failure
// ---------------------------------------------------------------------------

describe('verifyTurnstileToken — Cloudflare verification failure', () => {
  it('returns success:false when Cloudflare returns success:false', async () => {
    mockFetchFailure(['invalid-input-response']);
    const result = await verifyTurnstileToken('bad-token', 'secret');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('error message includes the error-codes from Cloudflare', async () => {
    mockFetchFailure(['timeout-or-duplicate', 'invalid-input-secret']);
    const result = await verifyTurnstileToken('bad-token', 'secret');
    expect(result.error).toContain('timeout-or-duplicate');
    expect(result.error).toContain('invalid-input-secret');
  });

  it('handles empty error-codes array gracefully', async () => {
    mockFetchFailure([]);
    const result = await verifyTurnstileToken('bad-token', 'secret');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unknown error');
  });

  it('returns success:false for common 600010 error code', async () => {
    mockFetchFailure(['600010']);
    const result = await verifyTurnstileToken('tok', 'sec');
    expect(result.success).toBe(false);
    expect(result.error).toContain('600010');
  });
});

// ---------------------------------------------------------------------------
// Path 3c: network failure — fail open
// ---------------------------------------------------------------------------

describe('verifyTurnstileToken — network error (fail-open)', () => {
  it('returns success:true when fetch throws (fail open)', async () => {
    mockFetchNetworkError();
    const result = await verifyTurnstileToken('tok', 'sec');
    // Per comment in code: "Network error calling Turnstile API — fail open"
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('does not propagate the network error', async () => {
    mockFetchNetworkError();
    await expect(verifyTurnstileToken('tok', 'sec')).resolves.not.toThrow();
  });
});
