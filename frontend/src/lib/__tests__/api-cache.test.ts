import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// api-cache has no external deps — import directly (no mocks needed)
import { getCached, setCache, clearCache } from '../api-cache'

describe('api-cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearCache()
  })

  describe('getCached', () => {
    it('returns null for unknown key', () => {
      expect(getCached('missing')).toBeNull()
    })

    it('returns cached data immediately after set', () => {
      setCache('key1', { value: 42 })
      expect(getCached('key1')).toEqual({ value: 42 })
    })

    it('returns null after cache duration expires (>60s)', () => {
      setCache('key2', 'hello')
      // Advance past 60 000 ms CACHE_DURATION
      vi.advanceTimersByTime(60001)
      expect(getCached('key2')).toBeNull()
    })

    it('returns data when still within cache window', () => {
      setCache('key3', [1, 2, 3])
      vi.advanceTimersByTime(59999)
      expect(getCached('key3')).toEqual([1, 2, 3])
    })

    it('stores null data values and returns them', () => {
      setCache('key-null', null)
      expect(getCached('key-null')).toBeNull()
    })

    it('stores falsy zero correctly', () => {
      setCache('zero', 0)
      expect(getCached('zero')).toBe(0)
    })
  })

  describe('setCache', () => {
    it('overwrites an existing entry with new data', () => {
      setCache('dup', 'first')
      setCache('dup', 'second')
      expect(getCached('dup')).toBe('second')
    })

    it('resets the timestamp on overwrite (expiry starts from new write)', () => {
      setCache('ts', 'original')
      vi.advanceTimersByTime(50000)
      setCache('ts', 'refreshed')
      vi.advanceTimersByTime(59999)
      // Should still be valid: only 59 999 ms since the second write
      expect(getCached('ts')).toBe('refreshed')
    })

    it('expired after overwrite + 60 001 ms', () => {
      setCache('ts2', 'original')
      vi.advanceTimersByTime(50000)
      setCache('ts2', 'refreshed')
      vi.advanceTimersByTime(60001)
      expect(getCached('ts2')).toBeNull()
    })
  })

  describe('clearCache', () => {
    it('removes all keys', () => {
      setCache('a', 1)
      setCache('b', 2)
      clearCache()
      expect(getCached('a')).toBeNull()
      expect(getCached('b')).toBeNull()
    })

    it('is safe to call on an empty cache', () => {
      expect(() => clearCache()).not.toThrow()
    })
  })

  describe('multiple independent keys', () => {
    it('expiry of one key does not affect another', () => {
      setCache('early', 'earlyVal')
      vi.advanceTimersByTime(30000)
      setCache('late', 'lateVal')
      vi.advanceTimersByTime(30001)
      // 'early' is now 60 001 ms old — expired
      expect(getCached('early')).toBeNull()
      // 'late' is only 30 001 ms old — still valid
      expect(getCached('late')).toBe('lateVal')
    })
  })
})
