/**
 * Tests for src/lib/production-logger.ts — pure-logic helpers
 *
 * @sentry/cloudflare is mocked at module level to avoid needing Worker globals.
 *
 * Chosen because: generateRequestId, generateTraceId, generateSpanId, and
 * ProductionLogger's redact/level-filtering logic are purely algorithmic with
 * no DB or network coupling once Sentry is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @sentry/cloudflare before any import of production-logger
vi.mock('@sentry/cloudflare', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
}))

import {
  generateRequestId,
  generateTraceId,
  generateSpanId,
  ProductionLogger,
} from '../production-logger'

// ---------------------------------------------------------------------------
// generateRequestId
// ---------------------------------------------------------------------------

describe('generateRequestId', () => {
  it('returns a string', () => {
    expect(typeof generateRequestId()).toBe('string')
  })

  it('starts with req_', () => {
    expect(generateRequestId()).toMatch(/^req_/)
  })

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRequestId()))
    expect(ids.size).toBe(50)
  })

  it('contains only alphanumeric characters and underscores', () => {
    const id = generateRequestId()
    expect(id).toMatch(/^[a-z0-9_]+$/)
  })
})

// ---------------------------------------------------------------------------
// generateTraceId
// ---------------------------------------------------------------------------

describe('generateTraceId', () => {
  it('returns a 32-character hex string (16 bytes)', () => {
    const id = generateTraceId()
    expect(id).toHaveLength(32)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTraceId()))
    expect(ids.size).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// generateSpanId
// ---------------------------------------------------------------------------

describe('generateSpanId', () => {
  it('returns a 16-character hex string (8 bytes)', () => {
    const id = generateSpanId()
    expect(id).toHaveLength(16)
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateSpanId()))
    expect(ids.size).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// ProductionLogger — log level filtering
// ---------------------------------------------------------------------------

describe('ProductionLogger — level filtering', () => {
  it('does not output messages below minLevel', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = new ProductionLogger({ minLevel: 'warn', enableSentry: false })
    logger.debug('debug message')
    logger.info('info message')
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('outputs messages at or above minLevel', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = new ProductionLogger({ minLevel: 'warn', enableSentry: false })
    logger.warn('warning message')
    expect(consoleSpy).toHaveBeenCalledOnce()
    consoleSpy.mockRestore()
  })

  it('always outputs error messages regardless of sampleRate', () => {
    // Even with sampleRate=0 errors should pass
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = new ProductionLogger({ minLevel: 'debug', sampleRate: 0, enableSentry: false })
    logger.error('critical error')
    expect(consoleSpy).toHaveBeenCalledOnce()
    consoleSpy.mockRestore()
  })

  it('outputs structured JSON to console', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((msg: string) => {
      messages.push(msg)
    })
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('test message', { key: 'value' })
    expect(messages).toHaveLength(1)
    const parsed = JSON.parse(messages[0])
    expect(parsed.message).toBe('test message')
    expect(parsed.level).toBe('info')
    expect(parsed.timestamp).toBeDefined()
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// ProductionLogger — sensitive data redaction
// ---------------------------------------------------------------------------

describe('ProductionLogger — redaction', () => {
  it('redacts password fields', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((msg: string) => {
      messages.push(msg)
    })
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('user login', { password: 'secret123', username: 'alice' })
    const parsed = JSON.parse(messages[0])
    expect(parsed.data.password).toBe('[REDACTED]')
    expect(parsed.data.username).toBe('alice')
    consoleSpy.mockRestore()
  })

  it('redacts token fields', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((m: string) => messages.push(m))
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('auth', { token: 'abc123', userId: '42' })
    const parsed = JSON.parse(messages[0])
    expect(parsed.data.token).toBe('[REDACTED]')
    expect(parsed.data.userId).toBe('42')
    consoleSpy.mockRestore()
  })

  it('redacts cookie fields', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((m: string) => messages.push(m))
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('session', { cookie: 'session-value', page: '/dashboard' })
    const parsed = JSON.parse(messages[0])
    expect(parsed.data.cookie).toBe('[REDACTED]')
    consoleSpy.mockRestore()
  })

  it('redacts nested sensitive fields', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((m: string) => messages.push(m))
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('deep', { user: { password: 'top-secret', name: 'Bob' } })
    const parsed = JSON.parse(messages[0])
    expect(parsed.data.user.password).toBe('[REDACTED]')
    expect(parsed.data.user.name).toBe('Bob')
    consoleSpy.mockRestore()
  })

  it('redacts apiKey and api_key fields', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((m: string) => messages.push(m))
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('api call', { apiKey: 'sk-secret', api_key: 'another-secret', endpoint: '/data' })
    const parsed = JSON.parse(messages[0])
    expect(parsed.data.apiKey).toBe('[REDACTED]')
    expect(parsed.data.api_key).toBe('[REDACTED]')
    expect(parsed.data.endpoint).toBe('/data')
    consoleSpy.mockRestore()
  })

  it('does not redact non-sensitive fields', () => {
    const messages: string[] = []
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation((m: string) => messages.push(m))
    const logger = new ProductionLogger({ minLevel: 'info', enableSentry: false })
    logger.info('pitch view', { pitchId: '123', viewCount: 42, title: 'My Film' })
    const parsed = JSON.parse(messages[0])
    expect(parsed.data.pitchId).toBe('123')
    expect(parsed.data.viewCount).toBe(42)
    expect(parsed.data.title).toBe('My Film')
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// ProductionLogger — child logger
// ---------------------------------------------------------------------------

describe('ProductionLogger — child logger', () => {
  it('child logger inherits parent context', () => {
    const logger = new ProductionLogger({}, { requestId: 'req_123', service: 'test' })
    const child = logger.child({ component: 'auth' })
    const ctx = child.getContext()
    expect(ctx.requestId).toBe('req_123')
    expect(ctx.component).toBe('auth')
  })

  it('child logger can override parent context fields', () => {
    const logger = new ProductionLogger({}, { requestId: 'req_parent' })
    const child = logger.child({ requestId: 'req_child' })
    expect(child.getContext().requestId).toBe('req_child')
  })

  it('child logger does not mutate parent context', () => {
    const logger = new ProductionLogger({}, { userId: 'user1' })
    logger.child({ userId: 'user2' })
    expect(logger.getContext().userId).toBe('user1')
  })
})

// ---------------------------------------------------------------------------
// ProductionLogger — setContext / getContext
// ---------------------------------------------------------------------------

describe('ProductionLogger — setContext / getContext', () => {
  it('setContext merges additional fields', () => {
    const logger = new ProductionLogger({}, { requestId: 'req_1' })
    logger.setContext({ userId: 'user_42' })
    const ctx = logger.getContext()
    expect(ctx.requestId).toBe('req_1')
    expect(ctx.userId).toBe('user_42')
  })

  it('getContext returns a copy (mutation does not affect internal state)', () => {
    const logger = new ProductionLogger({}, { requestId: 'req_1' })
    const ctx = logger.getContext()
    ctx.requestId = 'mutated'
    expect(logger.getContext().requestId).toBe('req_1')
  })
})

// ---------------------------------------------------------------------------
// ProductionLogger — startTimer
// ---------------------------------------------------------------------------

describe('ProductionLogger — startTimer', () => {
  it('returns a function that returns elapsed ms', async () => {
    const logger = new ProductionLogger({ minLevel: 'debug', enableSentry: false })
    vi.useFakeTimers()
    const stop = logger.startTimer('test-op')
    vi.advanceTimersByTime(100)
    const duration = stop()
    expect(duration).toBeGreaterThanOrEqual(100)
    vi.useRealTimers()
  })
})
