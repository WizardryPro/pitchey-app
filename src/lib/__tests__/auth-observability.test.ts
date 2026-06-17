/**
 * Tests for src/lib/auth-observability.ts — brute-force/lockout pure logic
 *
 * @sentry/cloudflare and ./observability are mocked to keep tests pure.
 *
 * Chosen because: isLockedOut, getLockoutRemaining, loginFailed (failure
 * counting), and the window-reset behavior are entirely in-memory logic
 * that can be exercised deterministically without network or DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/cloudflare', () => ({
  withScope: vi.fn((fn: any) => fn({ setLevel: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setExtras: vi.fn() })),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}))

// Minimal Observability mock — we only care about the pure in-memory logic
vi.mock('../observability', () => ({
  Observability: class {
    info = vi.fn()
    warn = vi.fn()
    error = vi.fn()
    getMetrics = vi.fn().mockReturnValue(null)
  },
}))

import { AuthObservability } from '../auth-observability'
import { Observability } from '../observability'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeObs(): Observability {
  return new Observability({} as any)
}

// ---------------------------------------------------------------------------
// isLockedOut
// ---------------------------------------------------------------------------

describe('AuthObservability.isLockedOut', () => {
  it('returns false when no failed attempts recorded', () => {
    const obs = new AuthObservability(makeObs())
    expect(obs.isLockedOut('user@example.com')).toBe(false)
  })

  it('returns false below the lockout threshold (5)', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 4; i++) {
      await obs.loginFailed({ email: 'user@example.com' })
    }
    expect(obs.isLockedOut('user@example.com')).toBe(false)
  })

  it('returns true at the lockout threshold (5 failures)', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ email: 'locked@example.com' })
    }
    expect(obs.isLockedOut('locked@example.com')).toBe(true)
  })

  it('returns true above the lockout threshold', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 8; i++) {
      await obs.loginFailed({ email: 'multi@example.com' })
    }
    expect(obs.isLockedOut('multi@example.com')).toBe(true)
  })

  it('returns false after the lockout window expires', async () => {
    vi.useFakeTimers()
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ email: 'expiring@example.com' })
    }
    expect(obs.isLockedOut('expiring@example.com')).toBe(true)
    // Advance past 15 minutes
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(obs.isLockedOut('expiring@example.com')).toBe(false)
    vi.useRealTimers()
  })

  it('locks by IP prefix (ip:<ip>)', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ ip: '1.2.3.4' })
    }
    expect(obs.isLockedOut('ip:1.2.3.4')).toBe(true)
  })

  it('does not lock out a different identifier', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ email: 'a@example.com' })
    }
    expect(obs.isLockedOut('b@example.com')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getLockoutRemaining
// ---------------------------------------------------------------------------

describe('AuthObservability.getLockoutRemaining', () => {
  it('returns 0 when identifier has no failure record', () => {
    const obs = new AuthObservability(makeObs())
    expect(obs.getLockoutRemaining('nobody@example.com')).toBe(0)
  })

  it('returns 0 after the lockout window expires', async () => {
    vi.useFakeTimers()
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ email: 'expired@example.com' })
    }
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(obs.getLockoutRemaining('expired@example.com')).toBe(0)
    vi.useRealTimers()
  })

  it('returns a positive number of seconds within the lockout window', async () => {
    vi.useFakeTimers()
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ email: 'counting@example.com' })
    }
    vi.advanceTimersByTime(5 * 60 * 1000) // advance 5 min
    const remaining = obs.getLockoutRemaining('counting@example.com')
    // 15 min window - 5 min elapsed = ~10 min = ~600 seconds
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(600)
    vi.useRealTimers()
  })

  it('returns approximately 15 minutes (900s) immediately after first failed attempt', async () => {
    vi.useFakeTimers()
    const obs = new AuthObservability(makeObs())
    await obs.loginFailed({ email: 'fresh@example.com' })
    const remaining = obs.getLockoutRemaining('fresh@example.com')
    // Within the window: should be close to 900
    expect(remaining).toBeGreaterThan(898)
    expect(remaining).toBeLessThanOrEqual(900)
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// loginSuccess — clears failed attempts
// ---------------------------------------------------------------------------

describe('AuthObservability.loginSuccess', () => {
  it('clears failed attempts for email on success', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ email: 'cleared@example.com' })
    }
    expect(obs.isLockedOut('cleared@example.com')).toBe(true)
    await obs.loginSuccess({ email: 'cleared@example.com', userId: 'u1' })
    expect(obs.isLockedOut('cleared@example.com')).toBe(false)
  })

  it('clears failed attempts for IP on success', async () => {
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 5; i++) {
      await obs.loginFailed({ ip: '5.5.5.5' })
    }
    expect(obs.isLockedOut('ip:5.5.5.5')).toBe(true)
    await obs.loginSuccess({ ip: '5.5.5.5', userId: 'u2' })
    expect(obs.isLockedOut('ip:5.5.5.5')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// loginFailed — count accumulation within window
// ---------------------------------------------------------------------------

describe('AuthObservability.loginFailed — attempt counting', () => {
  it('increments attempts count on repeated failures within window', async () => {
    vi.useFakeTimers()
    const obs = new AuthObservability(makeObs())
    // 3 failures
    for (let i = 0; i < 3; i++) {
      await obs.loginFailed({ email: 'counter@example.com' })
    }
    // Not yet locked (< 5)
    expect(obs.isLockedOut('counter@example.com')).toBe(false)
    // 2 more
    await obs.loginFailed({ email: 'counter@example.com' })
    await obs.loginFailed({ email: 'counter@example.com' })
    expect(obs.isLockedOut('counter@example.com')).toBe(true)
    vi.useRealTimers()
  })

  it('resets the count when the window expires between failures', async () => {
    vi.useFakeTimers()
    const obs = new AuthObservability(makeObs())
    for (let i = 0; i < 4; i++) {
      await obs.loginFailed({ email: 'window-reset@example.com' })
    }
    // Advance past window
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    // One more failure: count resets to 1 (not 5, so not locked)
    await obs.loginFailed({ email: 'window-reset@example.com' })
    expect(obs.isLockedOut('window-reset@example.com')).toBe(false)
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// Observability log-level routing
// ---------------------------------------------------------------------------

describe('AuthObservability — event log-level routing', () => {
  it('calls obs.error for login_failed', async () => {
    const obs = makeObs()
    const authObs = new AuthObservability(obs)
    await authObs.trackAuthEvent('login_failed', { email: 'bad@example.com' })
    expect(obs.error).toHaveBeenCalledWith(
      expect.stringContaining('login_failed'),
      undefined,
      expect.any(Object)
    )
  })

  it('calls obs.warn for session_expired', async () => {
    const obs = makeObs()
    const authObs = new AuthObservability(obs)
    await authObs.trackAuthEvent('session_expired', { userId: 'u1' })
    expect(obs.warn).toHaveBeenCalledWith(
      expect.stringContaining('session_expired'),
      expect.any(Object)
    )
  })

  it('calls obs.info for login_success', async () => {
    const obs = makeObs()
    const authObs = new AuthObservability(obs)
    await authObs.trackAuthEvent('login_success', { userId: 'u1' })
    expect(obs.info).toHaveBeenCalledWith(
      expect.stringContaining('login_success'),
      expect.any(Object)
    )
  })

  it('calls obs.warn for password_reset_requested', async () => {
    const obs = makeObs()
    const authObs = new AuthObservability(obs)
    await authObs.trackAuthEvent('password_reset_requested', { email: 'a@b.com' })
    expect(obs.warn).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Email sanitization in log output
// ---------------------------------------------------------------------------

describe('AuthObservability — email sanitization', () => {
  it('masks email local part in logged data', async () => {
    const obs = makeObs()
    const authObs = new AuthObservability(obs)
    await authObs.trackAuthEvent('login_success', { email: 'alice@example.com', userId: 'u1' })
    // Check that the logged call did NOT include the full email
    const callArg = (obs.info as any).mock.calls[0][1]
    // sanitizeAuthData masks: "al***@example.com"
    expect(callArg.email).toMatch(/^al\*{3}@example\.com$/)
  })
})
