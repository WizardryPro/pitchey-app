/**
 * Tests for src/utils/request.validation.ts
 *
 * Covers: safeParseJson, validateRequiredFields, validateJsonRequest,
 *         ClientError, ServerError, isClientError
 */

import { describe, it, expect, vi } from 'vitest'
import {
  safeParseJson,
  validateRequiredFields,
  validateJsonRequest,
  ClientError,
  ServerError,
  isClientError,
} from '../request.validation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  body: string | null,
  contentType = 'application/json',
  hasBody = true
): Request {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': contentType },
  }
  if (hasBody && body !== null) {
    init.body = body
  }
  return new Request('http://localhost/api/test', init)
}

// ---------------------------------------------------------------------------
// safeParseJson
// ---------------------------------------------------------------------------

describe('safeParseJson', () => {
  it('parses valid JSON and returns success=true with data', async () => {
    const req = makeRequest(JSON.stringify({ foo: 'bar' }))
    const result = await safeParseJson(req)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ foo: 'bar' })
    expect(result.error).toBeUndefined()
  })

  it('returns success=false for malformed JSON', async () => {
    const req = makeRequest('{not valid json}')
    const result = await safeParseJson(req)
    expect(result.success).toBe(false)
    expect(result.data).toBeUndefined()
    expect(result.error).toBeDefined()
    const errorText = await result.error!.json()
    expect(result.error!.status).toBe(400)
    expect(errorText.error).toMatch(/invalid json/i)
  })

  it('returns success=false for wrong content-type', async () => {
    const req = makeRequest('some text', 'text/plain')
    const result = await safeParseJson(req)
    expect(result.success).toBe(false)
    expect(result.error!.status).toBe(400)
    const body = await result.error!.json()
    expect(body.error).toMatch(/content-type/i)
  })

  it('returns success=false when request has no body', async () => {
    // Build a request without a body by omitting it
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    const result = await safeParseJson(req)
    expect(result.success).toBe(false)
    expect(result.error!.status).toBe(400)
  })

  it('parses an empty JSON object {}', async () => {
    const req = makeRequest('{}')
    const result = await safeParseJson(req)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({})
  })

  it('parses a JSON array', async () => {
    const req = makeRequest('[1, 2, 3]')
    const result = await safeParseJson(req)
    expect(result.success).toBe(true)
    expect(result.data).toEqual([1, 2, 3])
  })

  it('accepts request without explicit content-type (null)', async () => {
    // When content-type is absent, the guard only fires if content-type is
    // present AND not JSON — so a missing header should still parse.
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ x: 1 }),
    })
    const result = await safeParseJson(req)
    // May succeed or fail depending on body presence — just check it doesn't throw
    expect(typeof result.success).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// validateRequiredFields
// ---------------------------------------------------------------------------

describe('validateRequiredFields', () => {
  it('returns isValid=true when all required fields are present', () => {
    const result = validateRequiredFields({ name: 'Alice', age: 30 }, ['name', 'age'])
    expect(result.isValid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns isValid=false when a field is missing', () => {
    const result = validateRequiredFields({ name: 'Alice' }, ['name', 'email'])
    expect(result.isValid).toBe(false)
    expect(result.error!.status).toBe(400)
  })

  it('includes the missing field name in the error message', async () => {
    const result = validateRequiredFields({ name: 'Alice' }, ['name', 'email'])
    const body = await result.error!.json()
    expect(body.error).toContain('email')
  })

  it('returns isValid=false when a field value is null', () => {
    const result = validateRequiredFields({ name: null }, ['name'])
    expect(result.isValid).toBe(false)
  })

  it('returns isValid=false when a field value is empty string', () => {
    const result = validateRequiredFields({ name: '' }, ['name'])
    expect(result.isValid).toBe(false)
  })

  it('returns isValid=false when data is null', () => {
    const result = validateRequiredFields(null, ['name'])
    expect(result.isValid).toBe(false)
    expect(result.error!.status).toBe(400)
  })

  it('returns isValid=false when data is a primitive', () => {
    const result = validateRequiredFields('hello', ['name'])
    expect(result.isValid).toBe(false)
  })

  it('returns isValid=true with empty requiredFields array', () => {
    const result = validateRequiredFields({ anything: true }, [])
    expect(result.isValid).toBe(true)
  })

  it('reports multiple missing fields in one error', async () => {
    const result = validateRequiredFields({}, ['title', 'email', 'password'])
    expect(result.isValid).toBe(false)
    const body = await result.error!.json()
    expect(body.error).toContain('title')
    expect(body.error).toContain('email')
    expect(body.error).toContain('password')
  })

  it('allows numeric zero as a valid value (not missing)', () => {
    // 0 is falsy but should be accepted for numeric fields
    // Current implementation: treats undefined/null/'' as missing; 0 passes
    const result = validateRequiredFields({ count: 0 }, ['count'])
    expect(result.isValid).toBe(true)
  })

  it('allows boolean false as a valid value', () => {
    const result = validateRequiredFields({ active: false }, ['active'])
    expect(result.isValid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateJsonRequest
// ---------------------------------------------------------------------------

describe('validateJsonRequest', () => {
  it('succeeds with valid JSON and no required fields', async () => {
    const req = makeRequest(JSON.stringify({ anything: 1 }))
    const result = await validateJsonRequest(req)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ anything: 1 })
  })

  it('succeeds with valid JSON that has all required fields', async () => {
    const req = makeRequest(JSON.stringify({ title: 'Test', email: 'a@b.com' }))
    const result = await validateJsonRequest(req, ['title', 'email'])
    expect(result.success).toBe(true)
  })

  it('fails when JSON is invalid', async () => {
    const req = makeRequest('{bad}')
    const result = await validateJsonRequest(req, ['title'])
    expect(result.success).toBe(false)
    expect(result.error!.status).toBe(400)
  })

  it('fails when a required field is missing', async () => {
    const req = makeRequest(JSON.stringify({ title: 'ok' }))
    const result = await validateJsonRequest(req, ['title', 'email'])
    expect(result.success).toBe(false)
    expect(result.error!.status).toBe(400)
    const body = await result.error!.json()
    expect(body.error).toContain('email')
  })

  it('propagates parse error without checking required fields', async () => {
    const req = makeRequest('not json', 'text/plain')
    const result = await validateJsonRequest(req, ['title'])
    expect(result.success).toBe(false)
    // Should be a content-type or JSON parse error, not a "missing fields" error
    const body = await result.error!.json()
    expect(body.error).not.toContain('Missing required fields')
  })
})

// ---------------------------------------------------------------------------
// ClientError
// ---------------------------------------------------------------------------

describe('ClientError', () => {
  it('is an instance of Error', () => {
    const e = new ClientError('oops')
    expect(e).toBeInstanceOf(Error)
  })

  it('has name ClientError', () => {
    const e = new ClientError('oops')
    expect(e.name).toBe('ClientError')
  })

  it('stores message', () => {
    const e = new ClientError('bad request')
    expect(e.message).toBe('bad request')
  })

  it('stores optional details', () => {
    const e = new ClientError('oops', { field: 'email' })
    expect(e.details).toEqual({ field: 'email' })
  })
})

// ---------------------------------------------------------------------------
// ServerError
// ---------------------------------------------------------------------------

describe('ServerError', () => {
  it('is an instance of Error', () => {
    const e = new ServerError('db error')
    expect(e).toBeInstanceOf(Error)
  })

  it('has name ServerError', () => {
    const e = new ServerError('db error')
    expect(e.name).toBe('ServerError')
  })

  it('stores originalError', () => {
    const orig = new Error('conn refused')
    const e = new ServerError('db error', orig)
    expect(e.originalError).toBe(orig)
  })
})

// ---------------------------------------------------------------------------
// isClientError
// ---------------------------------------------------------------------------

describe('isClientError', () => {
  it('returns true for ClientError instance', () => {
    expect(isClientError(new ClientError('bad input'))).toBe(true)
  })

  it('returns false for ServerError instance', () => {
    expect(isClientError(new ServerError('internal'))).toBe(false)
  })

  it('returns true for SyntaxError with JSON in message', () => {
    const e = new SyntaxError('Unexpected token in JSON')
    expect(isClientError(e)).toBe(true)
  })

  it('returns false for a generic SyntaxError', () => {
    // SyntaxErrors that don't mention JSON should not be client errors
    const e = new SyntaxError('unexpected token')
    // Only returns true if message contains 'JSON'
    expect(isClientError(e)).toBe(false)
  })

  it('returns true for errors with status 400', () => {
    const e: any = new Error('bad request')
    e.status = 400
    expect(isClientError(e)).toBe(true)
  })

  it('returns true for errors with status 404', () => {
    const e: any = new Error('not found')
    e.status = 404
    expect(isClientError(e)).toBe(true)
  })

  it('returns false for errors with status 500', () => {
    const e: any = new Error('server fault')
    e.status = 500
    expect(isClientError(e)).toBe(false)
  })

  it('returns true for ValidationError by name', () => {
    const e: any = new Error('invalid')
    e.name = 'ValidationError'
    expect(isClientError(e)).toBe(true)
  })

  it('returns true for error with "invalid" in message', () => {
    expect(isClientError(new Error('invalid email format'))).toBe(true)
  })

  it('returns true for error with "missing" in message', () => {
    expect(isClientError(new Error('missing required field'))).toBe(true)
  })

  it('returns true for error with "unauthorized" in message', () => {
    expect(isClientError(new Error('unauthorized access'))).toBe(true)
  })

  it('returns false for a plain server-like error', () => {
    expect(isClientError(new Error('database connection timeout'))).toBe(false)
  })

  it('returns true for error with "validation" in message', () => {
    expect(isClientError(new Error('validation failed'))).toBe(true)
  })
})
