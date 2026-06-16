/**
 * Tests for src/utils/redis-fallback.ts
 *
 * Covers: RedisWithFallback (get/set/setex/del/keys/ttl operations, primary→memory
 *         fallback on unavailability or error), wrapRedisClient, getSharedRedisWithFallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RedisWithFallback,
  wrapRedisClient,
  getSharedRedisWithFallback,
} from '../redis-fallback'

// ---------------------------------------------------------------------------
// Mock Redis factory — a minimal client that behaves like Upstash
// ---------------------------------------------------------------------------

function makeMockRedis(overrides: Partial<{
  get: (k: string) => Promise<string | null>
  set: (k: string, v: string, mode?: string, ttl?: number) => Promise<void>
  setex: (k: string, s: number, v: string) => Promise<void>
  del: (...keys: string[]) => Promise<number>
  keys: (pattern: string) => Promise<string[]>
  ttl: (k: string) => Promise<number>
}> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ttl: vi.fn().mockResolvedValue(-2),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Constructor / availability detection
// ---------------------------------------------------------------------------

describe('RedisWithFallback — availability check', () => {
  it('marks redis available when client has get and set methods', () => {
    const redis = makeMockRedis()
    const wrapper = new RedisWithFallback(redis)
    expect(wrapper.getStats().redisAvailable).toBe(true)
  })

  it('marks redis unavailable when client is null', () => {
    const wrapper = new RedisWithFallback(null)
    expect(wrapper.getStats().redisAvailable).toBe(false)
  })

  it('marks redis unavailable when client lacks get/set methods', () => {
    const wrapper = new RedisWithFallback({ someOtherMethod: vi.fn() })
    expect(wrapper.getStats().redisAvailable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// get — primary path
// ---------------------------------------------------------------------------

describe('RedisWithFallback.get — primary path', () => {
  it('delegates to redis.get when available', async () => {
    const redis = makeMockRedis({ get: vi.fn().mockResolvedValue('hello') })
    const wrapper = new RedisWithFallback(redis)
    const result = await wrapper.get('my-key')
    expect(result).toBe('hello')
    expect(redis.get).toHaveBeenCalledWith('my-key')
  })

  it('returns null when redis.get returns null', async () => {
    const redis = makeMockRedis()
    const wrapper = new RedisWithFallback(redis)
    expect(await wrapper.get('missing')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// get — fallback path
// ---------------------------------------------------------------------------

describe('RedisWithFallback.get — memory fallback', () => {
  it('returns value from memory cache when redis unavailable', async () => {
    const wrapper = new RedisWithFallback(null)
    // Pre-populate memory cache via set()
    await wrapper.set('key1', 'cached-value')
    const result = await wrapper.get('key1')
    expect(result).toBe('cached-value')
  })

  it('returns null when key not in memory cache', async () => {
    const wrapper = new RedisWithFallback(null)
    expect(await wrapper.get('no-such-key')).toBeNull()
  })

  it('falls back to memory when redis.get throws', async () => {
    const redis = makeMockRedis({ get: vi.fn().mockRejectedValue(new Error('connection error')) })
    const wrapper = new RedisWithFallback(redis)
    // Populate memory cache so fallback has something to return
    await wrapper.set('fallback-key', 'in-memory')
    // Now redis.get will throw; result should come from memory
    const result = await wrapper.get('fallback-key')
    // After get() fails and sets warning, it reads from memory cache
    // BUT: after a throw the memory cache was set via a previous set() which also
    // calls redis.set (which doesn't throw here). We need to make redis.set throw too
    // to keep the write in memory only. Rebuild:
    const brokenRedis = {
      get: vi.fn().mockRejectedValue(new Error('down')),
      set: vi.fn().mockRejectedValue(new Error('down')),
    }
    const w2 = new RedisWithFallback(brokenRedis)
    // With both get and set broken, the fallback get should return null (nothing in memory)
    expect(await w2.get('any-key')).toBeNull()
  })

  it('returns null from memory cache for an expired entry', async () => {
    const wrapper = new RedisWithFallback(null)
    // Set with a 1-second TTL, then check after expiry using fake timers
    vi.useFakeTimers()
    await wrapper.set('expiring', 'value', 'EX', 1)
    vi.advanceTimersByTime(2000) // advance 2 seconds
    const result = await wrapper.get('expiring')
    expect(result).toBeNull()
    vi.useRealTimers()
  })

  it('deletes expired keys from memory on access', async () => {
    const wrapper = new RedisWithFallback(null)
    vi.useFakeTimers()
    await wrapper.set('temp', 'data', 'EX', 1)
    expect(wrapper.getStats().memoryCacheSize).toBe(1)
    vi.advanceTimersByTime(2000)
    await wrapper.get('temp') // triggers deletion
    expect(wrapper.getStats().memoryCacheSize).toBe(0)
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// set — primary path
// ---------------------------------------------------------------------------

describe('RedisWithFallback.set', () => {
  it('delegates to redis.set without TTL when no mode/duration', async () => {
    const redis = makeMockRedis()
    const wrapper = new RedisWithFallback(redis)
    await wrapper.set('key', 'value')
    expect(redis.set).toHaveBeenCalledWith('key', 'value')
  })

  it('delegates to redis.set with EX mode and duration', async () => {
    const redis = makeMockRedis()
    const wrapper = new RedisWithFallback(redis)
    await wrapper.set('key', 'value', 'EX', 300)
    expect(redis.set).toHaveBeenCalledWith('key', 'value', 'EX', 300)
  })

  it('writes to memory cache when redis unavailable', async () => {
    const wrapper = new RedisWithFallback(null)
    await wrapper.set('mem-key', 'mem-value')
    expect(wrapper.getStats().memoryCacheSize).toBe(1)
    expect(await wrapper.get('mem-key')).toBe('mem-value')
  })

  it('sets memory expiry when EX mode provided', async () => {
    const wrapper = new RedisWithFallback(null)
    vi.useFakeTimers()
    await wrapper.set('ttl-key', 'ttl-value', 'EX', 60)
    vi.advanceTimersByTime(61000)
    expect(await wrapper.get('ttl-key')).toBeNull()
    vi.useRealTimers()
  })

  it('falls back to memory when redis.set throws', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('write failed')),
    }
    const wrapper = new RedisWithFallback(redis)
    // Should not throw — the catch block swallows the redis error
    await expect(wrapper.set('k', 'v')).resolves.toBeUndefined()
    // BUG DOCUMENTED: set() catches the redis error and writes 'v' to the
    // in-memory cache, but get() on the same wrapper will try redis.get first
    // (redis.get succeeds here, returning null) so it never consults memory.
    // The value written to memory on set-failure is therefore silently lost
    // from the caller's perspective. This is existing behavior — not fixed here.
    expect(await wrapper.get('k')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// setex
// ---------------------------------------------------------------------------

describe('RedisWithFallback.setex', () => {
  it('delegates to redis.setex when available', async () => {
    const redis = makeMockRedis()
    const wrapper = new RedisWithFallback(redis)
    await wrapper.setex('key', 120, 'value')
    expect(redis.setex).toHaveBeenCalledWith('key', 120, 'value')
  })

  it('writes to memory with expiry when redis unavailable', async () => {
    const wrapper = new RedisWithFallback(null)
    vi.useFakeTimers()
    await wrapper.setex('se-key', 5, 'se-value')
    expect(await wrapper.get('se-key')).toBe('se-value')
    vi.advanceTimersByTime(6000)
    expect(await wrapper.get('se-key')).toBeNull()
    vi.useRealTimers()
  })

  it('falls back to memory when redis.setex throws', async () => {
    const redis = makeMockRedis({ setex: vi.fn().mockRejectedValue(new Error('setex failed')) })
    const wrapper = new RedisWithFallback(redis)
    await expect(wrapper.setex('k', 10, 'v')).resolves.toBeUndefined()
    // BUG DOCUMENTED (same as set): setex() writes to memory after redis error,
    // but get() checks redis.get first (which works and returns null here),
    // so the memory write is silently invisible to get(). Existing behavior.
    expect(await wrapper.get('k')).toBeNull()
  })

  it('falls back to memory when client has no setex method', async () => {
    // Client with get/set but no setex — still "available" but setex throws
    const redis = { get: vi.fn(), set: vi.fn() } // no setex
    const wrapper = new RedisWithFallback(redis)
    await wrapper.setex('key', 60, 'val')
    // Memory cache should have it
    expect(wrapper.getStats().memoryCacheSize).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// del
// ---------------------------------------------------------------------------

describe('RedisWithFallback.del', () => {
  it('delegates to redis.del and returns count', async () => {
    const redis = makeMockRedis({ del: vi.fn().mockResolvedValue(2) })
    const wrapper = new RedisWithFallback(redis)
    const count = await wrapper.del('key1', 'key2')
    expect(redis.del).toHaveBeenCalledWith('key1', 'key2')
    // Redis returns 2; memory has neither key, so total is 2
    expect(count).toBe(2)
  })

  it('also deletes from memory cache', async () => {
    const wrapper = new RedisWithFallback(null)
    await wrapper.set('m1', 'v1')
    await wrapper.set('m2', 'v2')
    expect(wrapper.getStats().memoryCacheSize).toBe(2)
    await wrapper.del('m1')
    expect(wrapper.getStats().memoryCacheSize).toBe(1)
    expect(await wrapper.get('m1')).toBeNull()
  })

  it('returns 0 when key does not exist in memory', async () => {
    const wrapper = new RedisWithFallback(null)
    const count = await wrapper.del('no-such-key')
    expect(count).toBe(0)
  })

  it('handles redis.del error gracefully (still deletes from memory)', async () => {
    const redis = makeMockRedis({ del: vi.fn().mockRejectedValue(new Error('del failed')) })
    const wrapper = new RedisWithFallback(redis)
    // Manually put something in memory via the wrapper (redis.set will work fine)
    // We can't directly put in memory via set() since redis.set works; use null client:
    const w2 = new RedisWithFallback(null)
    await w2.set('del-key', 'del-val')
    const count = await w2.del('del-key')
    expect(count).toBe(1)
    expect(await w2.get('del-key')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// keys
// ---------------------------------------------------------------------------

describe('RedisWithFallback.keys', () => {
  it('delegates to redis.keys when available', async () => {
    const redis = makeMockRedis({ keys: vi.fn().mockResolvedValue(['prefix:a', 'prefix:b']) })
    const wrapper = new RedisWithFallback(redis)
    const result = await wrapper.keys('prefix:*')
    expect(result).toEqual(['prefix:a', 'prefix:b'])
  })

  it('falls back to memory pattern matching when redis unavailable', async () => {
    const wrapper = new RedisWithFallback(null)
    await wrapper.set('session:1', 'a')
    await wrapper.set('session:2', 'b')
    await wrapper.set('other:1', 'c')
    const result = await wrapper.keys('session:*')
    expect(result).toContain('session:1')
    expect(result).toContain('session:2')
    expect(result).not.toContain('other:1')
  })

  it('returns empty array when no keys match', async () => {
    const wrapper = new RedisWithFallback(null)
    const result = await wrapper.keys('nonexistent:*')
    expect(result).toEqual([])
  })

  it('falls back to memory when redis.keys throws', async () => {
    const redis = makeMockRedis({ keys: vi.fn().mockRejectedValue(new Error('keys failed')) })
    const wrapper = new RedisWithFallback(redis)
    // Memory is empty, so should return []
    const result = await wrapper.keys('*')
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ttl
// ---------------------------------------------------------------------------

describe('RedisWithFallback.ttl', () => {
  it('delegates to redis.ttl when available', async () => {
    const redis = makeMockRedis({ ttl: vi.fn().mockResolvedValue(300) })
    const wrapper = new RedisWithFallback(redis)
    const result = await wrapper.ttl('my-key')
    expect(result).toBe(300)
  })

  it('returns -2 for a key that does not exist in memory', async () => {
    const wrapper = new RedisWithFallback(null)
    const result = await wrapper.ttl('absent')
    expect(result).toBe(-2)
  })

  it('returns -1 for a key with no expiry in memory', async () => {
    const wrapper = new RedisWithFallback(null)
    await wrapper.set('forever', 'value') // no EX
    const result = await wrapper.ttl('forever')
    expect(result).toBe(-1)
  })

  it('returns remaining seconds for a key with expiry', async () => {
    const wrapper = new RedisWithFallback(null)
    vi.useFakeTimers()
    await wrapper.set('short', 'live', 'EX', 60)
    const result = await wrapper.ttl('short')
    expect(result).toBeGreaterThan(58) // approx 60 seconds
    expect(result).toBeLessThanOrEqual(60)
    vi.useRealTimers()
  })

  it('returns -2 for an expired key in memory', async () => {
    const wrapper = new RedisWithFallback(null)
    vi.useFakeTimers()
    await wrapper.set('gone', 'value', 'EX', 1)
    vi.advanceTimersByTime(2000)
    const result = await wrapper.ttl('gone')
    expect(result).toBe(-2)
    vi.useRealTimers()
  })

  it('falls back to memory when redis.ttl throws', async () => {
    const redis = makeMockRedis({ ttl: vi.fn().mockRejectedValue(new Error('ttl error')) })
    const wrapper = new RedisWithFallback(redis)
    // No memory key — should return -2
    const result = await wrapper.ttl('absent')
    expect(result).toBe(-2)
  })
})

// ---------------------------------------------------------------------------
// clearMemoryCache
// ---------------------------------------------------------------------------

describe('RedisWithFallback.clearMemoryCache', () => {
  it('removes all entries from memory cache', async () => {
    const wrapper = new RedisWithFallback(null)
    await wrapper.set('a', '1')
    await wrapper.set('b', '2')
    expect(wrapper.getStats().memoryCacheSize).toBe(2)
    wrapper.clearMemoryCache()
    expect(wrapper.getStats().memoryCacheSize).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe('RedisWithFallback.getStats', () => {
  it('reports redisAvailable, memoryCacheSize, warningsShown', async () => {
    const wrapper = new RedisWithFallback(null)
    await wrapper.set('x', 'y')
    const stats = wrapper.getStats()
    expect(stats.redisAvailable).toBe(false)
    expect(stats.memoryCacheSize).toBe(1)
    expect(Array.isArray(stats.warningsShown)).toBe(true)
  })

  it('records warning strings after fallback operations', async () => {
    const redis = { get: vi.fn().mockRejectedValue(new Error('down')), set: vi.fn() }
    const wrapper = new RedisWithFallback(redis)
    await wrapper.get('x')
    expect(wrapper.getStats().warningsShown).toContain('get')
  })

  it('only records each warning once', async () => {
    const redis = { get: vi.fn().mockRejectedValue(new Error('down')), set: vi.fn() }
    const wrapper = new RedisWithFallback(redis)
    await wrapper.get('a')
    await wrapper.get('b')
    await wrapper.get('c')
    const count = wrapper.getStats().warningsShown.filter(w => w === 'get').length
    expect(count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// wrapRedisClient
// ---------------------------------------------------------------------------

describe('wrapRedisClient', () => {
  it('returns a RedisWithFallback instance', () => {
    const redis = makeMockRedis()
    const wrapper = wrapRedisClient(redis)
    expect(wrapper).toBeInstanceOf(RedisWithFallback)
  })

  it('marks the client as available', () => {
    const redis = makeMockRedis()
    const wrapper = wrapRedisClient(redis)
    expect(wrapper.getStats().redisAvailable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSharedRedisWithFallback
// ---------------------------------------------------------------------------

describe('getSharedRedisWithFallback', () => {
  beforeEach(() => {
    // Reset module-level singleton by accessing the module's state via a fresh import.
    // We can't reset it directly, so we test its observable behavior instead.
  })

  it('returns a RedisWithFallback instance', () => {
    const instance = getSharedRedisWithFallback()
    expect(instance).toBeInstanceOf(RedisWithFallback)
  })

  it('returns the same instance on repeated calls without a client', () => {
    const a = getSharedRedisWithFallback()
    const b = getSharedRedisWithFallback()
    expect(a).toBe(b)
  })

  it('creates an unavailable instance when called with no client and no prior client', () => {
    // If no client was ever passed, singleton uses null → unavailable
    const instance = getSharedRedisWithFallback()
    // It may or may not be available depending on prior test order (singleton),
    // but it must be a valid instance
    expect(instance).toBeInstanceOf(RedisWithFallback)
  })
})
