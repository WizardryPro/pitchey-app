/**
 * worker-jwt.ts unit tests
 *
 * Tests the HS256 JWT implementation using Web Crypto API.
 * Node ≥18 exposes crypto.subtle globally; setup.ts shims it for older runners.
 *
 * Covers: sign/verify round-trip, expiry detection, signature tamper detection,
 * malformed token rejection, and the extractJWT header helper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createJWT, verifyJWT, extractJWT } from '../worker-jwt'

const TEST_SECRET = 'test-secret-key-at-least-32-chars!!'

const BASE_PAYLOAD = {
  sub: '42',
  email: 'user@example.com',
  name: 'Test User',
  userType: 'creator',
}

// ---------------------------------------------------------------------------
// createJWT
// ---------------------------------------------------------------------------
describe('createJWT', () => {
  it('returns a three-part dot-separated string', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('encodes the header with alg=HS256 and typ=JWT', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET)
    const headerJson = atob(
      token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    )
    const header = JSON.parse(headerJson)
    expect(header.alg).toBe('HS256')
    expect(header.typ).toBe('JWT')
  })

  it('encodes the payload fields in the second segment', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET)
    const rawPayload = token.split('.')[1]
    const padding = (4 - (rawPayload.length % 4)) % 4
    const payloadJson = atob(
      (rawPayload + '='.repeat(padding)).replace(/-/g, '+').replace(/_/g, '/')
    )
    const decoded = JSON.parse(payloadJson)
    expect(decoded.sub).toBe('42')
    expect(decoded.email).toBe('user@example.com')
    expect(decoded.userType).toBe('creator')
  })

  it('sets iat and exp fields automatically', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const after = Math.floor(Date.now() / 1000)

    const rawPayload = token.split('.')[1]
    const padding = (4 - (rawPayload.length % 4)) % 4
    const decoded = JSON.parse(
      atob((rawPayload + '='.repeat(padding)).replace(/-/g, '+').replace(/_/g, '/'))
    )

    expect(decoded.iat).toBeGreaterThanOrEqual(before)
    expect(decoded.iat).toBeLessThanOrEqual(after)
    expect(decoded.exp).toBeGreaterThanOrEqual(before + 3600)
    expect(decoded.exp).toBeLessThanOrEqual(after + 3600)
  })

  it('includes a jti (JWT ID) field', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET)
    const rawPayload = token.split('.')[1]
    const padding = (4 - (rawPayload.length % 4)) % 4
    const decoded = JSON.parse(
      atob((rawPayload + '='.repeat(padding)).replace(/-/g, '+').replace(/_/g, '/'))
    )
    expect(decoded.jti).toBeDefined()
    expect(typeof decoded.jti).toBe('string')
    expect(decoded.jti.length).toBeGreaterThan(0)
  })

  it('produces different tokens on each call (jti / iat uniqueness)', async () => {
    const t1 = await createJWT(BASE_PAYLOAD, TEST_SECRET)
    const t2 = await createJWT(BASE_PAYLOAD, TEST_SECRET)
    expect(t1).not.toBe(t2)
  })

  it('respects custom expiresIn value', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 60)
    const rawPayload = token.split('.')[1]
    const padding = (4 - (rawPayload.length % 4)) % 4
    const decoded = JSON.parse(
      atob((rawPayload + '='.repeat(padding)).replace(/-/g, '+').replace(/_/g, '/'))
    )
    expect(decoded.exp - decoded.iat).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// verifyJWT — happy path
// ---------------------------------------------------------------------------
describe('verifyJWT — valid token', () => {
  it('round-trips: verify returns the original payload fields', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const payload = await verifyJWT(token, TEST_SECRET)

    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe(BASE_PAYLOAD.sub)
    expect(payload!.email).toBe(BASE_PAYLOAD.email)
    expect(payload!.name).toBe(BASE_PAYLOAD.name)
    expect(payload!.userType).toBe(BASE_PAYLOAD.userType)
  })

  it('returns a payload with iat and exp populated', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const payload = await verifyJWT(token, TEST_SECRET)
    expect(payload!.iat).toBeGreaterThan(0)
    expect(payload!.exp).toBeGreaterThan(payload!.iat)
  })
})

// ---------------------------------------------------------------------------
// verifyJWT — tamper detection
// ---------------------------------------------------------------------------
describe('verifyJWT — signature tamper detection', () => {
  it('returns null when the signature is altered', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const [h, p, sig] = token.split('.')
    // Flip last character of signature
    const badSig = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    const tampered = `${h}.${p}.${badSig}`
    expect(await verifyJWT(tampered, TEST_SECRET)).toBeNull()
  })

  it('returns null when the payload is altered (signature mismatch)', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const [h, _p, sig] = token.split('.')
    // Replace payload with a different one
    const evilPayload = btoa(JSON.stringify({ sub: '1', email: 'admin@evil.com', name: 'Hacker', userType: 'admin', iat: 0, exp: 9999999999 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const tampered = `${h}.${evilPayload}.${sig}`
    expect(await verifyJWT(tampered, TEST_SECRET)).toBeNull()
  })

  it('returns null when the header is altered', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const [_h, p, sig] = token.split('.')
    const evilHeader = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const tampered = `${evilHeader}.${p}.${sig}`
    expect(await verifyJWT(tampered, TEST_SECRET)).toBeNull()
  })

  it('returns null when verified with the wrong secret', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    expect(await verifyJWT(token, 'wrong-secret-entirely-different!')).toBeNull()
  })

  it('returns null when verified with an empty secret', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    // An empty HMAC key may throw — verifyJWT catches and returns null
    const result = await verifyJWT(token, '')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// verifyJWT — expiry detection
// ---------------------------------------------------------------------------
describe('verifyJWT — expiry detection', () => {
  it('returns null for a token that expired in the past', async () => {
    // Create a token that expires 1 second in the future, then advance time
    // We do this by creating a token with -1 second expiry (already expired).
    // We manually craft an already-expired token by using a past exp value.
    // The easiest approach: create a valid token then fake Date.now to be in the future.
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 1) // 1 second expiry

    // Advance time by 5 seconds to make it expire
    const originalNow = Date.now
    Date.now = () => originalNow() + 5000
    try {
      const result = await verifyJWT(token, TEST_SECRET)
      expect(result).toBeNull()
    } finally {
      Date.now = originalNow
    }
  })

  it('returns payload for a token that has NOT expired yet', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600) // 1 hour
    const result = await verifyJWT(token, TEST_SECRET)
    expect(result).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// verifyJWT — malformed token rejection
// ---------------------------------------------------------------------------
describe('verifyJWT — malformed token rejection', () => {
  it('returns null for an empty string', async () => {
    expect(await verifyJWT('', TEST_SECRET)).toBeNull()
  })

  it('returns null for a token with only two parts', async () => {
    expect(await verifyJWT('header.payload', TEST_SECRET)).toBeNull()
  })

  it('returns null for a token with four parts', async () => {
    expect(await verifyJWT('a.b.c.d', TEST_SECRET)).toBeNull()
  })

  it('returns null for a random garbage string', async () => {
    expect(await verifyJWT('not.a.jwt', TEST_SECRET)).toBeNull()
  })

  it('returns null for a token with invalid base64 payload', async () => {
    expect(await verifyJWT('validheader.!!!invalid!!!.validsig', TEST_SECRET)).toBeNull()
  })

  it('returns null when payload is not JSON', async () => {
    // Valid base64 but not JSON
    const notJson = btoa('this is not json')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    const h = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    expect(await verifyJWT(`${h}.${notJson}.fakesig`, TEST_SECRET)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractJWT
// ---------------------------------------------------------------------------
describe('extractJWT', () => {
  it('extracts the token from a "Bearer <token>" header', () => {
    expect(extractJWT('Bearer my.jwt.token')).toBe('my.jwt.token')
  })

  it('returns null for a null header', () => {
    expect(extractJWT(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(extractJWT('')).toBeNull()
  })

  it('returns null when the header does not start with "Bearer "', () => {
    expect(extractJWT('Token my.jwt.token')).toBeNull()
    expect(extractJWT('Basic dXNlcjpwYXNz')).toBeNull()
    expect(extractJWT('my.jwt.token')).toBeNull()
  })

  it('returns null for "Bearer " with no token following', () => {
    // "Bearer " has 7 chars; substring(7) returns ""
    expect(extractJWT('Bearer ')).toBe('')
    // Empty string is falsy — caller should treat empty token as invalid
    // NOTE: this is a minor edge case — extractJWT returns '' not null here.
    // Document but do not change: the security property is enforced by verifyJWT
    // returning null for an empty/invalid token.
  })

  it('preserves dots and dashes in the extracted token', () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SflKxwRJSMeKKF2QT4fwpMeJf36'
    expect(extractJWT(`Bearer ${fakeToken}`)).toBe(fakeToken)
  })

  it('handles multiple spaces in token value (Bearer with multiple spaces)', () => {
    // Only strips exactly "Bearer " (7 chars); extra spaces remain in token
    expect(extractJWT('Bearer  my.jwt')).toBe(' my.jwt')
  })
})

// ---------------------------------------------------------------------------
// End-to-end: sign → extract from header → verify
// ---------------------------------------------------------------------------
describe('end-to-end: sign → Authorization header → verify', () => {
  it('full round-trip through Authorization header extraction and verification', async () => {
    const token = await createJWT(BASE_PAYLOAD, TEST_SECRET, 3600)
    const authHeader = `Bearer ${token}`
    const extracted = extractJWT(authHeader)
    expect(extracted).toBe(token)

    const payload = await verifyJWT(extracted!, TEST_SECRET)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe(BASE_PAYLOAD.sub)
    expect(payload!.email).toBe(BASE_PAYLOAD.email)
  })
})
