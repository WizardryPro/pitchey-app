/**
 * Tests for src/utils/auth-extract.ts
 *
 * Covers:
 *  - getAuthenticatedUser: JWT path, session-cookie KV path, DB fallback,
 *    expired session, missing token, missing cookie
 *  - getUserId: auth path + deprecated query-param fallback
 *  - requireAuth: returns user or 401 Response
 *  - requireRole: role match, role mismatch, unauthenticated
 *
 * Real crypto.subtle is used (Node ≥18 via setup.ts) to produce genuine JWTs
 * from worker-jwt's createJWT helper. Network and DB are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAuthenticatedUser,
  getUserId,
  requireAuth,
  requireRole,
  type AuthEnv,
} from '../auth-extract';

// We'll use the real createJWT from worker-jwt to sign real tokens
import { createJWT } from '../worker-jwt';

// ---------------------------------------------------------------------------
// Mock @neondatabase/serverless — we do not hit a real DB.
// ---------------------------------------------------------------------------

const mockNeonQuery = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    // neon() returns a tagged-template function; mock a function that also has .query
    const tpl = mockNeonQuery;
    return tpl;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-key-for-development';

async function makeJWT(overrides: Record<string, string> = {}) {
  return createJWT({
    sub: overrides.sub ?? '42',
    email: overrides.email ?? 'user@test.com',
    name: overrides.name ?? 'Test User',
    userType: overrides.userType ?? 'creator',
  }, JWT_SECRET, 3600);
}

function makeKV(store: Record<string, string> = {}): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ keys: [] })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
  } as unknown as KVNamespace;
}

function requestWithJWT(token: string): Request {
  return new Request('https://api.example.com/test', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function requestWithCookie(cookieValue: string, cookieName = 'pitchey-session'): Request {
  return new Request('https://api.example.com/test', {
    headers: { Cookie: `${cookieName}=${cookieValue}` },
  });
}

function emptyRequest(url = 'https://api.example.com/test'): Request {
  return new Request(url);
}

const baseEnv: AuthEnv = {
  JWT_SECRET,
};

// ---------------------------------------------------------------------------
// getAuthenticatedUser — JWT path
// ---------------------------------------------------------------------------

describe('getAuthenticatedUser — JWT path', () => {
  it('authenticates user from valid JWT Bearer token', async () => {
    const token = await makeJWT({ userType: 'creator' });
    const result = await getAuthenticatedUser(requestWithJWT(token), baseEnv);
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe('42');
    expect(result.user?.email).toBe('user@test.com');
    expect(result.user?.userType).toBe('creator');
  });

  it('rejects a token signed with wrong secret', async () => {
    const token = await createJWT({ sub: '1', email: 'x@x.com', name: 'X', userType: 'creator' }, 'WRONG_SECRET');
    const result = await getAuthenticatedUser(requestWithJWT(token), baseEnv);
    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
  });

  it('rejects a malformed token (not 3 segments)', async () => {
    const result = await getAuthenticatedUser(requestWithJWT('not.a.valid.jwt.token.extra'), baseEnv);
    // verifyJWT with 4 parts returns null
    expect(result.authenticated).toBe(false);
  });

  it('rejects an expired JWT (exp in past)', async () => {
    // Create a token that expires immediately (-1s TTL)
    const token = await createJWT(
      { sub: '1', email: 'a@a.com', name: 'A', userType: 'creator' },
      JWT_SECRET,
      -1  // already expired
    );
    const result = await getAuthenticatedUser(requestWithJWT(token), baseEnv);
    expect(result.authenticated).toBe(false);
  });

  it('uses fallback secret when JWT_SECRET not in env', async () => {
    // Default secret is 'test-secret-key-for-development' in auth-extract.ts
    const token = await makeJWT();
    const result = await getAuthenticatedUser(requestWithJWT(token), {});
    expect(result.authenticated).toBe(true);
  });

  it('extracts investor userType from JWT', async () => {
    const token = await makeJWT({ userType: 'investor' });
    const result = await getAuthenticatedUser(requestWithJWT(token), baseEnv);
    expect(result.user?.userType).toBe('investor');
  });

  it('returns error message when unauthenticated', async () => {
    const result = await getAuthenticatedUser(emptyRequest(), baseEnv);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('No valid authentication found');
  });
});

// ---------------------------------------------------------------------------
// getAuthenticatedUser — session cookie KV path
// ---------------------------------------------------------------------------

describe('getAuthenticatedUser — session cookie KV path', () => {
  it('authenticates via pitchey-session cookie from KV', async () => {
    const sessionId = 'session-uuid-001';
    const sessionData = JSON.stringify({
      userId: 7,
      userEmail: 'kv@test.com',
      userName: 'KV User',
      userType: 'investor',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const kv = makeKV({ [`session:${sessionId}`]: sessionData });
    const env: AuthEnv = { SESSION_STORE: kv };

    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe('7');
    expect(result.user?.email).toBe('kv@test.com');
    expect(result.user?.userType).toBe('investor');
  });

  it('rejects session that has expired (KV expiresAt in past)', async () => {
    const sessionId = 'old-session';
    const sessionData = JSON.stringify({
      userId: 7,
      userEmail: 'kv@test.com',
      userType: 'creator',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const kv = makeKV({ [`session:old-session`]: sessionData });
    const env: AuthEnv = { SESSION_STORE: kv, JWT_SECRET };

    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(false);
  });

  it('reads better-auth-session legacy cookie name', async () => {
    const sessionId = 'legacy-uuid-001';
    const sessionData = JSON.stringify({
      userId: 8,
      userEmail: 'legacy@test.com',
      userType: 'production',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const kv = makeKV({ [`session:${sessionId}`]: sessionData });
    const env: AuthEnv = { SESSION_STORE: kv };

    const result = await getAuthenticatedUser(requestWithCookie(sessionId, 'better-auth-session'), env);
    expect(result.authenticated).toBe(true);
    expect(result.user?.userType).toBe('production');
  });

  it('falls back to SESSIONS_KV binding when SESSION_STORE absent', async () => {
    const sessionId = 'sessions-kv-001';
    const kv = makeKV({
      [`session:${sessionId}`]: JSON.stringify({
        userId: 9, userEmail: 'sk@test.com', userType: 'creator',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
    const env: AuthEnv = { SESSIONS_KV: kv };
    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(true);
  });

  it('falls back to KV binding when SESSION_STORE and SESSIONS_KV absent', async () => {
    const sessionId = 'kv-only-001';
    const kv = makeKV({
      [`session:${sessionId}`]: JSON.stringify({
        userId: 10, userEmail: 'konly@test.com', userType: 'creator',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
    const env: AuthEnv = { KV: kv };
    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(true);
  });

  it('falls back to CACHE binding last', async () => {
    const sessionId = 'cache-001';
    const kv = makeKV({
      [`session:${sessionId}`]: JSON.stringify({
        userId: 11, userEmail: 'cache@test.com', userType: 'viewer',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
    const env: AuthEnv = { CACHE: kv };
    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(true);
    expect(result.user?.userType).toBe('viewer');
  });

  it('handles KV error gracefully and falls through to unauthenticated', async () => {
    const kv = {
      get: vi.fn(async () => { throw new Error('KV timeout'); }),
      put: vi.fn(),
    } as unknown as KVNamespace;
    const env: AuthEnv = { SESSION_STORE: kv };
    const result = await getAuthenticatedUser(requestWithCookie('any-session'), env);
    // KV error is caught; no DB_URL means falls through to unauthenticated
    expect(result.authenticated).toBe(false);
  });

  it('defaults userType to creator when session has no userType', async () => {
    const sessionId = 'no-type';
    const kv = makeKV({
      [`session:${sessionId}`]: JSON.stringify({
        userId: 12,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
    const env: AuthEnv = { SESSION_STORE: kv };
    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(true);
    expect(result.user?.userType).toBe('creator');
  });

  it('returns unauthenticated when no cookie and no JWT', async () => {
    const result = await getAuthenticatedUser(emptyRequest(), baseEnv);
    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAuthenticatedUser — DB fallback path
// ---------------------------------------------------------------------------

describe('getAuthenticatedUser — DB fallback path', () => {
  beforeEach(() => {
    mockNeonQuery.mockReset();
  });

  it('authenticates from DB when KV miss and DATABASE_URL configured', async () => {
    const sessionId = 'db-session-001';
    const kv = makeKV({}); // KV miss
    mockNeonQuery.mockResolvedValue([{
      user_id: 55,
      email: 'db@test.com',
      username: 'dbuser',
      user_type: 'production',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      display_name: 'DB User',
      first_name: null,
      last_name: null,
    }]);

    const env: AuthEnv = { SESSION_STORE: kv, DATABASE_URL: 'postgres://test' };
    const result = await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe('55');
    expect(result.user?.userType).toBe('production');
  });

  it('caches DB session in KV after successful lookup', async () => {
    const sessionId = 'db-cache-test';
    const kv = makeKV({});
    mockNeonQuery.mockResolvedValue([{
      user_id: 56, email: 'c@c.com', username: 'cc', user_type: 'creator',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      display_name: null, first_name: 'Carol', last_name: 'C',
    }]);

    const env: AuthEnv = { SESSION_STORE: kv, DATABASE_URL: 'postgres://test' };
    await getAuthenticatedUser(requestWithCookie(sessionId), env);
    expect(kv.put).toHaveBeenCalledWith(
      `session:${sessionId}`,
      expect.stringContaining('"userId":56'),
      { expirationTtl: 3600 }
    );
  });

  it('returns unauthenticated when DB returns no rows', async () => {
    const kv = makeKV({});
    mockNeonQuery.mockResolvedValue([]);
    const env: AuthEnv = { SESSION_STORE: kv, DATABASE_URL: 'postgres://test' };
    const result = await getAuthenticatedUser(requestWithCookie('no-row'), env);
    expect(result.authenticated).toBe(false);
  });

  it('handles DB error gracefully and returns unauthenticated', async () => {
    const kv = makeKV({});
    mockNeonQuery.mockRejectedValue(new Error('DB connection refused'));
    const env: AuthEnv = { SESSION_STORE: kv, DATABASE_URL: 'postgres://test' };
    const result = await getAuthenticatedUser(requestWithCookie('err-session'), env);
    expect(result.authenticated).toBe(false);
  });

  it('constructs display name from first_name + last_name when display_name absent', async () => {
    const kv = makeKV({});
    mockNeonQuery.mockResolvedValue([{
      user_id: 57, email: 'fn@test.com', username: null, user_type: 'creator',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      display_name: null, first_name: 'Jane', last_name: 'Doe',
    }]);
    const env: AuthEnv = { SESSION_STORE: kv, DATABASE_URL: 'postgres://test' };
    const result = await getAuthenticatedUser(requestWithCookie('name-test'), env);
    expect(result.user?.name).toBe('Jane Doe');
  });

  it('falls back to email prefix when all name fields absent', async () => {
    const kv = makeKV({});
    mockNeonQuery.mockResolvedValue([{
      user_id: 58, email: 'fallback@test.com', username: null, user_type: 'creator',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      display_name: null, first_name: null, last_name: null,
    }]);
    const env: AuthEnv = { SESSION_STORE: kv, DATABASE_URL: 'postgres://test' };
    const result = await getAuthenticatedUser(requestWithCookie('name-test-2'), env);
    expect(result.user?.name).toBe('fallback');
  });
});

// ---------------------------------------------------------------------------
// getUserId
// ---------------------------------------------------------------------------

describe('getUserId', () => {
  it('returns user id from valid JWT', async () => {
    const token = await makeJWT({ sub: '99' });
    const result = await getUserId(requestWithJWT(token), baseEnv);
    expect(result).toBe('99');
  });

  it('returns null when unauthenticated and no userId query param', async () => {
    const result = await getUserId(emptyRequest(), baseEnv);
    expect(result).toBeNull();
  });

  it('returns userId from query param as deprecated fallback', async () => {
    const req = emptyRequest('https://api.example.com/test?userId=77');
    const result = await getUserId(req, baseEnv);
    expect(result).toBe('77');
  });

  it('prefers JWT over query param', async () => {
    const token = await makeJWT({ sub: '55' });
    const req = new Request('https://api.example.com/test?userId=99', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getUserId(req, baseEnv);
    expect(result).toBe('55');
  });
});

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  it('returns user when authenticated', async () => {
    const token = await makeJWT({ userType: 'creator' });
    const result = await requireAuth(requestWithJWT(token), baseEnv);
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.id).toBe('42');
    }
  });

  it('returns error Response with 401 when unauthenticated', async () => {
    const result = await requireAuth(emptyRequest(), baseEnv);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(401);
      const body = await result.error.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('UNAUTHORIZED');
    }
  });

  it('401 response sets CORS header', async () => {
    const req = new Request('https://api.example.com/', {
      headers: { Origin: 'https://pitchey-5o8.pages.dev' },
    });
    const result = await requireAuth(req, baseEnv);
    if ('error' in result) {
      expect(result.error.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    }
  });

  it('returns * as CORS origin when no Origin header', async () => {
    const result = await requireAuth(emptyRequest(), baseEnv);
    if ('error' in result) {
      expect(result.error.headers.get('Access-Control-Allow-Origin')).toBe('*');
    }
  });
});

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

describe('requireRole', () => {
  it('returns user when role matches (single string)', async () => {
    const token = await makeJWT({ userType: 'creator' });
    const result = await requireRole(requestWithJWT(token), baseEnv, 'creator');
    expect('user' in result).toBe(true);
  });

  it('returns user when role is in allowed array', async () => {
    const token = await makeJWT({ userType: 'investor' });
    const result = await requireRole(requestWithJWT(token), baseEnv, ['creator', 'investor']);
    expect('user' in result).toBe(true);
  });

  it('returns 403 when role does not match', async () => {
    const token = await makeJWT({ userType: 'viewer' });
    const result = await requireRole(requestWithJWT(token), baseEnv, 'creator');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
      const body = await result.error.json();
      expect(body.error?.code).toBe('FORBIDDEN');
      expect(body.error?.message).toMatch(/creator/);
    }
  });

  it('returns 401 when unauthenticated', async () => {
    const result = await requireRole(emptyRequest(), baseEnv, 'creator');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(401);
    }
  });

  it('role comparison is case-insensitive', async () => {
    const token = await makeJWT({ userType: 'CREATOR' });
    const result = await requireRole(requestWithJWT(token), baseEnv, 'creator');
    // userType from JWT is 'CREATOR'; requireRole lowercases both sides
    expect('user' in result).toBe(true);
  });

  it('403 message lists all allowed roles', async () => {
    const token = await makeJWT({ userType: 'viewer' });
    const result = await requireRole(requestWithJWT(token), baseEnv, ['creator', 'admin']);
    if ('error' in result) {
      const body = await result.error.json();
      expect(body.error?.message).toMatch(/creator/);
      expect(body.error?.message).toMatch(/admin/);
    }
  });
});
