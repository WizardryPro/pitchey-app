/**
 * Tests for src/utils/api-response.ts
 *
 * Covers: ApiResponseBuilder (instance and static methods), ErrorCode/ErrorStatusMap
 * mapping, LegacyResponseAdapter transform helpers, ValidationHelpers, errorHandler
 * middleware, addRequestId, successResponse and errorResponse module-level exports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ApiResponseBuilder,
  ErrorCode,
  LegacyResponseAdapter,
  ValidationHelpers,
  errorHandler,
  addRequestId,
  createResponse,
  successResponse,
  errorResponse,
} from '../api-response'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function json(res: Response) {
  return res.json() as Promise<any>
}

function makeRequest(origin?: string): Request {
  return new Request('https://api.example.com/test', {
    headers: origin ? { Origin: origin } : {}
  })
}

// ---------------------------------------------------------------------------
// ApiResponseBuilder — instance methods
// ---------------------------------------------------------------------------
describe('ApiResponseBuilder — success()', () => {
  it('returns 200', () => {
    expect(new ApiResponseBuilder().success({ ok: true }).status).toBe(200)
  })

  it('body has success=true and data', async () => {
    const body = await json(new ApiResponseBuilder().success({ id: 42 }))
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ id: 42 })
  })

  it('meta includes timestamp as ISO string', async () => {
    const body = await json(new ApiResponseBuilder().success({}))
    expect(body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('meta includes requestId', async () => {
    const body = await json(new ApiResponseBuilder().success({}))
    expect(body.meta.requestId).toBeTruthy()
  })

  it('uses X-Request-Id from request header when provided', async () => {
    const req = new Request('https://x.com', { headers: { 'X-Request-Id': 'my-id', Origin: '' } })
    const body = await json(new ApiResponseBuilder(req).success({}))
    expect(body.meta.requestId).toBe('my-id')
  })

  it('CORS origin echoed from request', () => {
    const req = makeRequest('https://pitchey-5o8.pages.dev')
    const res = new ApiResponseBuilder(req).success({})
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })

  it('Content-Type is application/json', () => {
    const res = new ApiResponseBuilder().success({})
    expect(res.headers.get('Content-Type')).toBe('application/json')
  })
})

describe('ApiResponseBuilder — error()', () => {
  it('maps UNAUTHORIZED to 401', () => {
    const res = new ApiResponseBuilder().error(ErrorCode.UNAUTHORIZED, 'nope')
    expect(res.status).toBe(401)
  })

  it('maps FORBIDDEN to 403', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.FORBIDDEN, 'denied').status).toBe(403)
  })

  it('maps NOT_FOUND to 404', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.NOT_FOUND, 'gone').status).toBe(404)
  })

  it('maps INTERNAL_ERROR to 500', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.INTERNAL_ERROR, 'crash').status).toBe(500)
  })

  it('maps DATABASE_ERROR to 500', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.DATABASE_ERROR, 'db').status).toBe(500)
  })

  it('maps SERVICE_UNAVAILABLE to 503', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.SERVICE_UNAVAILABLE, 'down').status).toBe(503)
  })

  it('maps RATE_LIMIT_EXCEEDED to 429', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.RATE_LIMIT_EXCEEDED, 'slow').status).toBe(429)
  })

  it('maps FILE_TOO_LARGE to 413', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.FILE_TOO_LARGE, 'big').status).toBe(413)
  })

  it('maps INVALID_FILE_TYPE to 415', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.INVALID_FILE_TYPE, 'type').status).toBe(415)
  })

  it('maps INSUFFICIENT_FUNDS to 402', () => {
    expect(new ApiResponseBuilder().error(ErrorCode.INSUFFICIENT_FUNDS, 'broke').status).toBe(402)
  })

  it('statusOverride takes precedence', () => {
    const res = new ApiResponseBuilder().error(ErrorCode.INTERNAL_ERROR, 'custom', undefined, 418)
    expect(res.status).toBe(418)
  })

  it('body has success=false', async () => {
    const body = await json(new ApiResponseBuilder().error(ErrorCode.NOT_FOUND, 'missing'))
    expect(body.success).toBe(false)
  })

  it('body error.code and message are populated', async () => {
    const body = await json(new ApiResponseBuilder().error(ErrorCode.VALIDATION_ERROR, 'bad input', { field: 'email' }))
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('bad input')
    expect(body.error.details).toEqual({ field: 'email' })
  })
})

describe('ApiResponseBuilder — paginated()', () => {
  it('returns 200', () => {
    expect(new ApiResponseBuilder().paginated([], 1, 10, 0).status).toBe(200)
  })

  it('hasMore is true when more pages exist', async () => {
    const body = await json(new ApiResponseBuilder().paginated(['a', 'b'], 1, 2, 5))
    expect(body.meta.pagination.hasMore).toBe(true)
  })

  it('hasMore is false when exactly one page', async () => {
    const body = await json(new ApiResponseBuilder().paginated(['a', 'b'], 1, 2, 2))
    expect(body.meta.pagination.hasMore).toBe(false)
  })

  it('X-Total-Count header is set', () => {
    const res = new ApiResponseBuilder().paginated([], 1, 10, 99)
    expect(res.headers.get('X-Total-Count')).toBe('99')
  })
})

describe('ApiResponseBuilder — noContent()', () => {
  it('returns 204', () => {
    expect(new ApiResponseBuilder().noContent().status).toBe(204)
  })

  it('body is empty', async () => {
    expect(await new ApiResponseBuilder().noContent().text()).toBe('')
  })
})

describe('ApiResponseBuilder — redirect()', () => {
  it('returns 302 by default', () => {
    expect(new ApiResponseBuilder().redirect('https://pitchey-5o8.pages.dev').status).toBe(302)
  })

  it('returns 301 for permanent redirect', () => {
    expect(new ApiResponseBuilder().redirect('https://example.com', true).status).toBe(301)
  })

  it('sets Location header', () => {
    const res = new ApiResponseBuilder().redirect('https://target.com')
    expect(res.headers.get('Location')).toBe('https://target.com')
  })
})

// ---------------------------------------------------------------------------
// ApiResponseBuilder — static convenience methods
// ---------------------------------------------------------------------------
describe('ApiResponseBuilder static methods', () => {
  it('rateLimited() returns 429', () => {
    expect(ApiResponseBuilder.rateLimited().status).toBe(429)
  })

  it('unauthorized() returns 401', () => {
    expect(ApiResponseBuilder.unauthorized().status).toBe(401)
  })

  it('badRequest() returns 400', () => {
    expect(ApiResponseBuilder.badRequest().status).toBe(400)
  })

  it('internalServerError() returns 500', () => {
    expect(ApiResponseBuilder.internalServerError().status).toBe(500)
  })

  it('notFound() returns 404', () => {
    expect(ApiResponseBuilder.notFound().status).toBe(404)
  })

  it('static success() returns 200 with data', async () => {
    const body = await json(ApiResponseBuilder.success({ val: 1 }))
    expect(body.data).toEqual({ val: 1 })
  })

  it('static error() accepts code and message', async () => {
    const body = await json(ApiResponseBuilder.error(ErrorCode.FORBIDDEN, 'no'))
    expect(body.error.message).toBe('no')
  })
})

// ---------------------------------------------------------------------------
// LegacyResponseAdapter
// ---------------------------------------------------------------------------
describe('LegacyResponseAdapter.transformPitchResponse', () => {
  it('passes through failure responses unchanged', () => {
    const resp = { success: false, error: { code: 'NOT_FOUND', message: 'nope' } }
    expect(LegacyResponseAdapter.transformPitchResponse(resp)).toEqual(resp)
  })

  it('wraps array data in pitches key', () => {
    const resp = { success: true, data: [{ id: 1 }, { id: 2 }] }
    const out = LegacyResponseAdapter.transformPitchResponse(resp)
    expect(out.data.data.pitches).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('wraps single pitch object in pitch key', () => {
    const resp = { success: true, data: { id: 1, title: 'My Pitch' } }
    const out = LegacyResponseAdapter.transformPitchResponse(resp)
    expect(out.data.pitch).toEqual({ id: 1, title: 'My Pitch' })
  })

  it('does not double-wrap already keyed pitch', () => {
    const resp = { success: true, data: { pitch: { id: 1 } } }
    const out = LegacyResponseAdapter.transformPitchResponse(resp)
    expect(out.data.pitch).toEqual({ id: 1 })
  })
})

describe('LegacyResponseAdapter.transformUserResponse', () => {
  it('passes through failure responses', () => {
    const resp = { success: false }
    expect(LegacyResponseAdapter.transformUserResponse(resp)).toEqual(resp)
  })

  it('returns data with token as-is', () => {
    const resp = { success: true, data: { token: 'abc', user: { id: 1 } } }
    const out = LegacyResponseAdapter.transformUserResponse(resp)
    expect(out.data.token).toBe('abc')
  })
})

describe('LegacyResponseAdapter.transform', () => {
  it('routes /pitch endpoints through transformPitchResponse', () => {
    const resp = { success: true, data: [{ id: 1 }] }
    const out = LegacyResponseAdapter.transform('/api/pitches', resp)
    expect(out.data.data.pitches).toBeDefined()
  })

  it('routes /auth endpoints through transformUserResponse', () => {
    const resp = { success: true, data: { token: 'x' } }
    const out = LegacyResponseAdapter.transform('/api/auth/login', resp)
    expect(out.data.token).toBe('x')
  })

  it('returns unchanged for non-matched endpoints', () => {
    const resp = { success: true, data: { some: 'thing' } }
    const out = LegacyResponseAdapter.transform('/api/credits', resp)
    expect(out).toEqual(resp)
  })
})

// ---------------------------------------------------------------------------
// ValidationHelpers
// ---------------------------------------------------------------------------
describe('ValidationHelpers.validateRequired', () => {
  it('returns valid=true when all fields present', () => {
    const r = ValidationHelpers.validateRequired({ name: 'Karl', email: 'k@k.com' }, ['name', 'email'])
    expect(r.valid).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('returns valid=false with missing fields', () => {
    const r = ValidationHelpers.validateRequired({ name: 'Karl' }, ['name', 'email'])
    expect(r.valid).toBe(false)
    expect(r.missing).toContain('email')
  })
})

describe('ValidationHelpers.isValidEmail', () => {
  it('accepts valid email', () => {
    expect(ValidationHelpers.isValidEmail('user@pitchey.com')).toBe(true)
  })

  it('rejects plain string', () => {
    expect(ValidationHelpers.isValidEmail('notanemail')).toBe(false)
  })

  it('rejects missing TLD', () => {
    expect(ValidationHelpers.isValidEmail('a@b')).toBe(false)
  })
})

describe('ValidationHelpers.isValidUUID', () => {
  it('accepts valid UUID v4', () => {
    expect(ValidationHelpers.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('rejects random string', () => {
    expect(ValidationHelpers.isValidUUID('not-a-uuid')).toBe(false)
  })
})

describe('ValidationHelpers.isValidPhone', () => {
  it('accepts E.164 phone number', () => {
    expect(ValidationHelpers.isValidPhone('+12125551234')).toBe(true)
  })

  it('rejects garbage', () => {
    expect(ValidationHelpers.isValidPhone('abc')).toBe(false)
  })
})

describe('ValidationHelpers.sanitize', () => {
  it('strips script tags', () => {
    const out = ValidationHelpers.sanitize('<script>alert(1)</script>hello')
    expect(out).not.toContain('<script>')
    expect(out).toContain('hello')
  })

  it('strips HTML tags', () => {
    const out = ValidationHelpers.sanitize('<b>bold</b>')
    expect(out).toBe('bold')
  })

  it('trims whitespace', () => {
    expect(ValidationHelpers.sanitize('  hello  ')).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// errorHandler middleware
// ---------------------------------------------------------------------------
describe('errorHandler middleware', () => {
  it('maps PG 23505 to 409 ALREADY_EXISTS', async () => {
    const req = makeRequest()
    const res = await errorHandler({ code: '23505', message: 'dup', detail: 'key' }, req)
    expect(res.status).toBe(409)
    const body = await json(res)
    expect(body.error.code).toBe('ALREADY_EXISTS')
  })

  it('maps PG 23503 to 400 VALIDATION_ERROR', async () => {
    const req = makeRequest()
    const res = await errorHandler({ code: '23503', message: 'fk', detail: 'ref' }, req)
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('maps NetworkError to 503', async () => {
    const req = makeRequest()
    const res = await errorHandler({ name: 'NetworkError', message: 'conn refused' }, req)
    expect(res.status).toBe(503)
  })

  it('defaults to 500 INTERNAL_ERROR for unknown errors', async () => {
    const req = makeRequest()
    const res = await errorHandler({ message: 'weird failure' }, req)
    expect(res.status).toBe(500)
    const body = await json(res)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// ---------------------------------------------------------------------------
// addRequestId
// ---------------------------------------------------------------------------
describe('addRequestId', () => {
  it('preserves existing X-Request-Id', () => {
    const req = new Request('https://x.com', { headers: { 'X-Request-Id': 'preset-id' } })
    const out = addRequestId(req)
    expect(out.headers.get('X-Request-Id')).toBe('preset-id')
  })

  it('generates a UUID when none present', () => {
    const req = new Request('https://x.com')
    const out = addRequestId(req)
    const id = out.headers.get('X-Request-Id')
    expect(id).toBeTruthy()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

// ---------------------------------------------------------------------------
// Module-level convenience exports
// ---------------------------------------------------------------------------
describe('createResponse', () => {
  it('returns an ApiResponseBuilder', () => {
    expect(createResponse()).toBeInstanceOf(ApiResponseBuilder)
  })
})

describe('module successResponse', () => {
  it('returns 200 with data', async () => {
    const res = successResponse({ x: 1 })
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.data).toEqual({ x: 1 })
  })
})

describe('module errorResponse', () => {
  it('returns status matching error code', () => {
    const res = errorResponse(ErrorCode.NOT_FOUND, 'gone')
    expect(res.status).toBe(404)
  })
})
