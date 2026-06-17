/**
 * Tests for src/utils/rate-limiter.ts
 *
 * Covers: RateLimiter (memory + redis strategies), extractClientIP,
 *         createHeaders, applyRateLimit, RATE_LIMIT_CONFIGS
 *
 * Mock strategy: vi.useFakeTimers for window expiry; mock redis pipeline
 * for RedisRateLimiter branch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RateLimiter,
  RateLimitConfig,
  extractClientIP,
  applyRateLimit,
  RATE_LIMIT_CONFIGS,
} from '../rate-limiter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', {
    method: 'GET',
    headers,
  })
}

/** Build a mock Redis client whose pipeline records calls and returns results. */
function makeMockRedis(zcard: number) {
  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],      // zremrangebyscore result
      [null, zcard],  // zcard result — current count BEFORE this request
      [null, 1],      // zadd result
      [null, 1],      // expire result
    ]),
  }

  return {
    pipeline: vi.fn().mockReturnValue(pipeline),
    zrem: vi.fn().mockResolvedValue(1),
    get: vi.fn(),
    set: vi.fn(),
    _pipeline: pipeline,
  }
}

// ---------------------------------------------------------------------------
// extractClientIP
// ---------------------------------------------------------------------------

describe('extractClientIP', () => {
  it('returns CF-Connecting-IP when present', () => {
    const req = makeRequest({ 'CF-Connecting-IP': '1.2.3.4' })
    expect(extractClientIP(req)).toBe('1.2.3.4')
  })

  it('returns first IP from X-Forwarded-For', () => {
    const req = makeRequest({ 'X-Forwarded-For': '5.6.7.8, 9.10.11.12' })
    expect(extractClientIP(req)).toBe('5.6.7.8')
  })

  it('prefers CF-Connecting-IP over X-Forwarded-For', () => {
    const req = makeRequest({
      'CF-Connecting-IP': '1.2.3.4',
      'X-Forwarded-For': '5.6.7.8',
    })
    expect(extractClientIP(req)).toBe('1.2.3.4')
  })

  it('falls back to X-Real-IP', () => {
    const req = makeRequest({ 'X-Real-IP': '10.0.0.1' })
    expect(extractClientIP(req)).toBe('10.0.0.1')
  })

  it('returns 127.0.0.1 when no IP headers present', () => {
    const req = makeRequest()
    expect(extractClientIP(req)).toBe('127.0.0.1')
  })

  it('strips ::ffff: IPv6-mapped IPv4 prefix', () => {
    const req = makeRequest({ 'CF-Connecting-IP': '::ffff:192.168.1.1' })
    expect(extractClientIP(req)).toBe('192.168.1.1')
  })

  it('trims spaces from X-Forwarded-For entries', () => {
    const req = makeRequest({ 'X-Forwarded-For': '  5.6.7.8  , 9.10.11.12' })
    expect(extractClientIP(req)).toBe('5.6.7.8')
  })
})

// ---------------------------------------------------------------------------
// MemoryRateLimiter (via RateLimiter with no redis arg)
// ---------------------------------------------------------------------------

describe('RateLimiter — memory strategy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests below the limit', async () => {
    const limiter = new RateLimiter()
    const result = await limiter.checkLimit('user1', { maxRequests: 5, windowMs: 60000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks requests at the limit', async () => {
    const limiter = new RateLimiter()
    const config = { maxRequests: 3, windowMs: 60000 }
    await limiter.checkLimit('user2', config)
    await limiter.checkLimit('user2', config)
    await limiter.checkLimit('user2', config)
    const fourth = await limiter.checkLimit('user2', config)
    expect(fourth.allowed).toBe(false)
    expect(fourth.remaining).toBe(0)
    expect(fourth.retryAfter).toBeGreaterThan(0)
  })

  it('resets the window after windowMs expires', async () => {
    const limiter = new RateLimiter()
    const config = { maxRequests: 2, windowMs: 10000 }
    await limiter.checkLimit('user3', config)
    await limiter.checkLimit('user3', config)
    const blocked = await limiter.checkLimit('user3', config)
    expect(blocked.allowed).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(11000)

    const reset = await limiter.checkLimit('user3', config)
    expect(reset.allowed).toBe(true)
  })

  it('tracks separate windows per identifier', async () => {
    const limiter = new RateLimiter()
    const config = { maxRequests: 1, windowMs: 60000 }
    const r1 = await limiter.checkLimit('ip-a', config)
    const r2 = await limiter.checkLimit('ip-b', config)
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)

    const r1b = await limiter.checkLimit('ip-a', config)
    const r2b = await limiter.checkLimit('ip-b', config)
    expect(r1b.allowed).toBe(false)
    expect(r2b.allowed).toBe(false)
  })

  it('uses DEFAULT_CONFIG values when no partial config provided', async () => {
    const limiter = new RateLimiter()
    const result = await limiter.checkLimit('user-default')
    expect(result.allowed).toBe(true)
    // Default is 100 req/hour; 1 request leaves 99 remaining
    expect(result.remaining).toBe(99)
  })

  it('checkRequest extracts IP from request and delegates', async () => {
    const limiter = new RateLimiter()
    const req = makeRequest({ 'CF-Connecting-IP': '42.42.42.42' })
    const result = await limiter.checkRequest(req, { maxRequests: 5, windowMs: 60000 })
    expect(result.allowed).toBe(true)
  })

  it('remaining counts down as requests accumulate', async () => {
    const limiter = new RateLimiter()
    const config = { maxRequests: 5, windowMs: 60000 }
    for (let i = 4; i >= 0; i--) {
      const result = await limiter.checkLimit('countdown', config)
      expect(result.remaining).toBe(i)
    }
  })

  it('sets resetTime to approximately now + windowMs', async () => {
    const now = Date.now()
    const limiter = new RateLimiter()
    const result = await limiter.checkLimit('user-reset', { maxRequests: 5, windowMs: 30000 })
    expect(result.resetTime).toBeGreaterThanOrEqual(now + 30000 - 100)
    expect(result.resetTime).toBeLessThanOrEqual(now + 30000 + 100)
  })
})

// ---------------------------------------------------------------------------
// RedisRateLimiter (via RateLimiter with redis arg)
// ---------------------------------------------------------------------------

describe('RateLimiter — redis strategy', () => {
  it('allows requests when redis zcard is below max', async () => {
    const redis = makeMockRedis(2) // 2 existing entries
    const limiter = new RateLimiter(redis)
    const result = await limiter.checkLimit('user-redis', { maxRequests: 5, windowMs: 60000 })
    expect(result.allowed).toBe(true)
    expect(redis.pipeline).toHaveBeenCalledOnce()
    expect(redis._pipeline.exec).toHaveBeenCalledOnce()
  })

  it('blocks when redis zcard equals maxRequests', async () => {
    const redis = makeMockRedis(5) // already at limit
    const limiter = new RateLimiter(redis)
    const result = await limiter.checkLimit('user-redis-blocked', { maxRequests: 5, windowMs: 60000 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
    // Should call zrem to remove the request we just added
    expect(redis.zrem).toHaveBeenCalledOnce()
  })

  it('falls back to allowing on redis pipeline error', async () => {
    const brokenRedis = {
      pipeline: vi.fn().mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
      }),
      zrem: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    }
    const limiter = new RateLimiter(brokenRedis)
    const result = await limiter.checkLimit('user-redis-fail', { maxRequests: 5, windowMs: 60000 })
    // On error, the Redis limiter falls back to allowing
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5) // default config maxRequests returned on error
  })

  it('calls pipeline.expire with window in seconds', async () => {
    const redis = makeMockRedis(0)
    const limiter = new RateLimiter(redis)
    const windowMs = 120000 // 2 minutes
    await limiter.checkLimit('user-expire', { maxRequests: 10, windowMs })
    expect(redis._pipeline.expire).toHaveBeenCalledWith(
      expect.any(String),
      120
    )
  })

  it('removes old entries via zremrangebyscore before counting', async () => {
    const redis = makeMockRedis(0)
    const limiter = new RateLimiter(redis)
    await limiter.checkLimit('user-cleanup', { maxRequests: 10, windowMs: 60000 })
    expect(redis._pipeline.zremrangebyscore).toHaveBeenCalledWith(
      expect.any(String),
      '-inf',
      expect.any(Number)
    )
  })
})

// ---------------------------------------------------------------------------
// createHeaders
// ---------------------------------------------------------------------------

describe('RateLimiter.createHeaders', () => {
  it('returns standard rate limit headers', () => {
    const limiter = new RateLimiter()
    const result = { allowed: true, remaining: 4, resetTime: 1700000000000 }
    const headers = limiter.createHeaders(result)
    expect(headers['X-RateLimit-Remaining']).toBe('4')
    expect(headers['X-RateLimit-Reset']).toBeDefined()
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('includes Retry-After when request was blocked', () => {
    const limiter = new RateLimiter()
    const result = { allowed: false, remaining: 0, resetTime: Date.now() + 60000, retryAfter: 60 }
    const headers = limiter.createHeaders(result)
    expect(headers['Retry-After']).toBe('60')
  })

  it('sets X-RateLimit-Reset as epoch seconds (not ms)', () => {
    const limiter = new RateLimiter()
    const resetTimeMs = 1700000000000
    const result = { allowed: true, remaining: 10, resetTime: resetTimeMs }
    const headers = limiter.createHeaders(result)
    const resetSeconds = parseInt(headers['X-RateLimit-Reset'], 10)
    expect(resetSeconds).toBe(Math.floor(resetTimeMs / 1000))
  })
})

// ---------------------------------------------------------------------------
// applyRateLimit middleware
// ---------------------------------------------------------------------------

describe('applyRateLimit', () => {
  it('returns null when request is within limits', async () => {
    const limiter = new RateLimiter()
    const req = makeRequest({ 'CF-Connecting-IP': '1.2.3.4' })
    const response = await applyRateLimit(req, limiter, 'public')
    expect(response).toBeNull()
  })

  it('returns 429 Response when rate limit exceeded', async () => {
    const limiter = new RateLimiter()
    const config: Partial<RateLimitConfig> = { maxRequests: 1, windowMs: 60000 }
    // Exhaust the limit
    await limiter.checkRequest(makeRequest({ 'CF-Connecting-IP': '1.2.3.4' }), config)
    // Override internal limiter to use the same config as applyRateLimit would
    // We need a limiter already at its limit — trick: use a tiny config
    const tinyLimiter = new RateLimiter()
    // Fill up to maxRequests for the 'search' config (50 requests)
    // Instead, we can just use a custom-config limiter and exhaust it directly
    const exhaustedLimiter = new RateLimiter()
    const req = makeRequest({ 'CF-Connecting-IP': '9.9.9.9' })
    // Saturate by setting maxRequests=1 and calling once before applyRateLimit
    for (let i = 0; i < RATE_LIMIT_CONFIGS.public.maxRequests; i++) {
      await exhaustedLimiter.checkRequest(req, RATE_LIMIT_CONFIGS.public)
    }
    const response = await applyRateLimit(req, exhaustedLimiter, 'public')
    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
    const body = await response!.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(body.retryAfter).toBeDefined()
  })

  it('returns 429 with rate limit headers', async () => {
    const limiter = new RateLimiter()
    const req = makeRequest({ 'CF-Connecting-IP': '8.8.8.8' })
    for (let i = 0; i < RATE_LIMIT_CONFIGS.search.maxRequests; i++) {
      await limiter.checkRequest(req, RATE_LIMIT_CONFIGS.search)
    }
    const response = await applyRateLimit(req, limiter, 'search')
    expect(response!.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response!.headers.get('Retry-After')).toBeDefined()
  })

  it('uses default public config when no config specified', async () => {
    const limiter = new RateLimiter()
    const req = makeRequest({ 'CF-Connecting-IP': '5.5.5.5' })
    const result = await applyRateLimit(req, limiter)
    expect(result).toBeNull() // first request always passes
  })
})

// ---------------------------------------------------------------------------
// RATE_LIMIT_CONFIGS shape
// ---------------------------------------------------------------------------

describe('RATE_LIMIT_CONFIGS', () => {
  it('has public config with 100 req/hour', () => {
    expect(RATE_LIMIT_CONFIGS.public.maxRequests).toBe(100)
    expect(RATE_LIMIT_CONFIGS.public.windowMs).toBe(60 * 60 * 1000)
  })

  it('has search config more restrictive than public', () => {
    expect(RATE_LIMIT_CONFIGS.search.maxRequests).toBeLessThan(RATE_LIMIT_CONFIGS.public.maxRequests)
  })

  it('has pitchDetail config', () => {
    expect(RATE_LIMIT_CONFIGS.pitchDetail).toBeDefined()
    expect(RATE_LIMIT_CONFIGS.pitchDetail.maxRequests).toBeGreaterThan(0)
  })

  it('has cached config most generous', () => {
    expect(RATE_LIMIT_CONFIGS.cached.maxRequests).toBeGreaterThanOrEqual(RATE_LIMIT_CONFIGS.public.maxRequests)
  })
})
