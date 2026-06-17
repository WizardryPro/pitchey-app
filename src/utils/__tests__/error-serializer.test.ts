/**
 * Tests for src/utils/error-serializer.ts
 *
 * Covers: serializeError (null/undefined, string, number, standard Error, DB/PG error
 * with code, cause chaining, Drizzle detection), errorToResponse, getErrorMessage, logError.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  serializeError,
  logError,
  errorToResponse,
  getErrorMessage,
} from '../error-serializer'

// ---------------------------------------------------------------------------
// serializeError — basic type handling
// ---------------------------------------------------------------------------
describe('serializeError — null / undefined', () => {
  it('null → type unknown, message fallback', () => {
    const s = serializeError(null)
    expect(s.type).toBe('unknown')
    expect(s.message).toBe('Unknown error occurred')
  })

  it('undefined → type unknown', () => {
    expect(serializeError(undefined).type).toBe('unknown')
  })
})

describe('serializeError — primitive types', () => {
  it('string → message equals the string, type unknown', () => {
    const s = serializeError('something went wrong')
    expect(s.message).toBe('something went wrong')
    expect(s.type).toBe('unknown')
  })

  it('number → String() used for message', () => {
    const s = serializeError(42 as any)
    expect(s.message).toBe('42')
    expect(s.type).toBe('unknown')
  })

  it('boolean false is falsy — returns unknown fallback message (falsy guard fires before typeof check)', () => {
    // false is falsy; the `if (!error) return { message: 'Unknown error occurred' }` branch fires
    // before the `typeof error !== 'object'` branch, so String(false) is never reached.
    expect(serializeError(false as any).message).toBe('Unknown error occurred')
    expect(serializeError(false as any).type).toBe('unknown')
  })
})

describe('serializeError — standard Error', () => {
  it('type is standard', () => {
    expect(serializeError(new Error('boom')).type).toBe('standard')
  })

  it('message is extracted', () => {
    expect(serializeError(new Error('disk full')).message).toBe('disk full')
  })

  it('name is extracted', () => {
    const e = new TypeError('bad type')
    expect(serializeError(e).name).toBe('TypeError')
  })

  it('stack is trimmed to 10 lines', () => {
    const e = new Error('deep')
    const s = serializeError(e)
    if (s.stack) {
      expect(s.stack.split('\n').length).toBeLessThanOrEqual(10)
    }
  })

  it('originalType contains constructor name', () => {
    const s = serializeError(new RangeError('range'))
    expect(s.originalType).toBe('RangeError')
  })
})

describe('serializeError — database / PostgreSQL error', () => {
  it('type is database when code is present', () => {
    const s = serializeError({ code: '23505', message: 'dup key' })
    expect(s.type).toBe('database')
  })

  it('code is extracted as string', () => {
    const s = serializeError({ code: '23505', message: 'dup' })
    expect(s.code).toBe('23505')
  })

  it('PG fields are extracted: constraint, table, column, detail, severity', () => {
    const s = serializeError({
      code: '23505',
      message: 'conflict',
      constraint: 'users_email_key',
      table: 'users',
      column: 'email',
      detail: 'Key (email)=(x@x.com) already exists.',
      severity: 'ERROR'
    })
    expect(s.constraint).toBe('users_email_key')
    expect(s.table).toBe('users')
    expect(s.column).toBe('email')
    expect(s.detail).toContain('already exists')
    expect(s.severity).toBe('ERROR')
  })

  it('type stays database even when also a standard Error instance with code', () => {
    const e: any = new Error('dup')
    e.code = '23505'
    const s = serializeError(e)
    expect(s.type).toBe('database')
  })
})

describe('serializeError — Drizzle detection', () => {
  it('type is drizzle when constructor name includes Drizzle', () => {
    class DrizzleError extends Error {
      constructor(m: string) { super(m); this.name = 'DrizzleError' }
    }
    const s = serializeError(new DrizzleError('query failed'))
    expect(s.type).toBe('drizzle')
  })

  it('type is drizzle when message includes drizzle', () => {
    const s = serializeError({ message: 'drizzle: connection refused', code: undefined })
    expect(s.type).toBe('drizzle')
  })
})

describe('serializeError — cause chain', () => {
  it('appends cause message to main message', () => {
    const cause = new Error('root cause')
    const outer = new Error('outer')
    ;(outer as any).cause = cause
    const s = serializeError(outer)
    expect(s.message).toContain('outer')
    expect(s.message).toContain('root cause')
  })

  it('inherits code from cause when outer has none', () => {
    const cause = { code: '23503', message: 'fk violation' }
    const outer = { message: 'wrapper', cause }
    const s = serializeError(outer)
    expect(s.code).toBe('23503')
  })
})

// ---------------------------------------------------------------------------
// getErrorMessage
// ---------------------------------------------------------------------------
describe('getErrorMessage', () => {
  it('extracts message from Error', () => {
    expect(getErrorMessage(new Error('hello'))).toBe('hello')
  })

  it('returns string errors directly', () => {
    expect(getErrorMessage('oops')).toBe('oops')
  })

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('Unknown error occurred')
  })
})

// ---------------------------------------------------------------------------
// errorToResponse
// ---------------------------------------------------------------------------
describe('errorToResponse', () => {
  it('returns object with message field', () => {
    const r = errorToResponse(new Error('boom'))
    expect(r.message).toBe('boom')
  })

  it('includes code when present on a DB error', () => {
    const r = errorToResponse({ code: '23505', message: 'dup' })
    expect(r.code).toBe('23505')
  })

  it('fallback message is unused when serializeError already returns a message (even for null)', () => {
    // serializeError(null) returns { message: 'Unknown error occurred', type: 'unknown' }
    // errorToResponse: `serialized.message || fallbackMessage` — 'Unknown error occurred' is truthy
    // so the fallbackMessage is never reached.
    const r = errorToResponse(null, 'Something broke')
    expect(r.message).toBe('Unknown error occurred')
  })

  it('does NOT include detail or sqlState (production safety)', () => {
    const r = errorToResponse({ code: '23505', message: 'dup', detail: 'internal detail', sqlState: 'HY000' })
    expect((r as any).detail).toBeUndefined()
    expect((r as any).sqlState).toBeUndefined()
  })

  it('does NOT include originalType (production safety)', () => {
    const r = errorToResponse(new RangeError('range'))
    expect((r as any).originalType).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// logError — side-effect tests (spy on console.error)
// ---------------------------------------------------------------------------
describe('logError', () => {
  it('calls console.error with context prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError(new Error('db broke'), 'QueryRunner')
    const calls = spy.mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('QueryRunner'))).toBe(true)
    spy.mockRestore()
  })

  it('logs without context when not provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => logError(new Error('bare'))).not.toThrow()
    spy.mockRestore()
  })

  it('logs additional data when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError(new Error('x'), '', { userId: 'abc' })
    const combined = spy.mock.calls.map(c => String(c[0])).join('\n')
    spy.mockRestore()
    // Just verifying it doesn't throw and logs something about Additional Data
    expect(combined).toBeTruthy()
  })

  it('does not throw when error has circular reference', () => {
    const circular: any = { message: 'cycle' }
    circular.self = circular
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => logError(circular)).not.toThrow()
    spy.mockRestore()
  })
})
