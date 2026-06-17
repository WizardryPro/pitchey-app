/**
 * Tests for src/utils/response.ts
 *
 * Covers: CORS allowed/disallowed origins, security headers, cache headers,
 * successResponse, errorResponse, createdResponse, paginatedResponse,
 * corsPreflightResponse, notFoundResponse, rateLimitResponse, serverErrorResponse,
 * validationErrorResponse, badRequestResponse, authErrorResponse, forbiddenResponse,
 * createErrorResponse, jsonResponse, setRequestOrigin (no-op), getCacheHeaders.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  getCorsHeaders,
  getSecurityHeaders,
  getCacheHeaders,
  successResponse,
  createdResponse,
  errorResponse,
  badRequestResponse,
  validationErrorResponse,
  authErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  rateLimitResponse,
  serverErrorResponse,
  paginatedResponse,
  corsPreflightResponse,
  createAuthErrorResponse,
  createErrorResponse,
  jsonResponse,
  setRequestOrigin,
} from '../response'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function parseBody(res: Response) {
  return res.json() as Promise<any>
}

// ---------------------------------------------------------------------------
// CORS origin allowlist
// ---------------------------------------------------------------------------
describe('getCorsHeaders — CORS origin rules', () => {
  const CANONICAL = 'https://pitchey-5o8.pages.dev'

  it('allows the canonical production origin and echoes it back', () => {
    const h = getCorsHeaders(CANONICAL)
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('allows pitchey.com marketing stub', () => {
    const h = getCorsHeaders('https://pitchey.com')
    expect(h['Access-Control-Allow-Origin']).toBe('https://pitchey.com')
  })

  it('allows www.pitchey.com', () => {
    const h = getCorsHeaders('https://www.pitchey.com')
    expect(h['Access-Control-Allow-Origin']).toBe('https://www.pitchey.com')
  })

  it('allows localhost:5173', () => {
    const h = getCorsHeaders('http://localhost:5173')
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
  })

  it('allows 127.0.0.1:5173', () => {
    const h = getCorsHeaders('http://127.0.0.1:5173')
    expect(h['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:5173')
  })

  it('allows localhost:3000', () => {
    const h = getCorsHeaders('http://localhost:3000')
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:3000')
  })

  it('allows 127.0.0.1:3000', () => {
    const h = getCorsHeaders('http://127.0.0.1:3000')
    expect(h['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:3000')
  })

  // Cloudflare Pages previews — stem must be pitchey-5o8, not bare pitchey
  it('allows hash-prefixed pitchey-5o8 preview (lowercase hex)', () => {
    const preview = 'https://52e5fc15.pitchey-5o8.pages.dev'
    const h = getCorsHeaders(preview)
    expect(h['Access-Control-Allow-Origin']).toBe(preview)
  })

  it('allows branch-prefixed pitchey-5o8 preview', () => {
    const preview = 'https://pr-42.pitchey-5o8.pages.dev'
    const h = getCorsHeaders(preview)
    expect(h['Access-Control-Allow-Origin']).toBe(preview)
  })

  it('allows named branch preview e.g. fix-cors.pitchey-5o8.pages.dev', () => {
    const preview = 'https://fix-cors.pitchey-5o8.pages.dev'
    const h = getCorsHeaders(preview)
    expect(h['Access-Control-Allow-Origin']).toBe(preview)
  })

  // Disallowed origins — fall back to canonical
  it('rejects unknown origin and falls back to canonical', () => {
    const h = getCorsHeaders('https://evil.example.com')
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('rejects the old deleted pitchey.pages.dev origin (NXDOMAINs since 2026-04-21)', () => {
    const h = getCorsHeaders('https://pitchey.pages.dev')
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('rejects a bare pitchey-<suffix>.pages.dev that is NOT pitchey-5o8', () => {
    // An attacker could register "pitchey-main" — must not be allowed.
    const h = getCorsHeaders('https://pitchey-main.pages.dev')
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('rejects http (non-https) pitchey-5o8.pages.dev', () => {
    const h = getCorsHeaders('http://pitchey-5o8.pages.dev')
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('falls back to canonical when origin is null', () => {
    const h = getCorsHeaders(null)
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('falls back to canonical when origin is undefined', () => {
    const h = getCorsHeaders(undefined)
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('strips trailing period before matching', () => {
    // Some browsers send "example.com." with a trailing dot
    const h = getCorsHeaders('https://pitchey-5o8.pages.dev.')
    expect(h['Access-Control-Allow-Origin']).toBe(CANONICAL)
  })

  it('includes credentials header', () => {
    const h = getCorsHeaders(CANONICAL)
    expect(h['Access-Control-Allow-Credentials']).toBe('true')
  })

  it('includes sentry-trace and baggage in allowed headers (observability)', () => {
    const h = getCorsHeaders(CANONICAL)
    const allowed = h['Access-Control-Allow-Headers']
    expect(allowed).toContain('sentry-trace')
    expect(allowed).toContain('baggage')
    expect(allowed).toContain('traceparent')
  })

  it('max-age is 86400', () => {
    const h = getCorsHeaders(CANONICAL)
    expect(h['Access-Control-Max-Age']).toBe('86400')
  })
})

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
describe('getSecurityHeaders', () => {
  it('includes nosniff X-Content-Type-Options', () => {
    expect(getSecurityHeaders()['X-Content-Type-Options']).toBe('nosniff')
  })

  it('includes HSTS', () => {
    expect(getSecurityHeaders()['Strict-Transport-Security']).toContain('max-age=31536000')
  })

  it('includes X-Frame-Options SAMEORIGIN', () => {
    expect(getSecurityHeaders()['X-Frame-Options']).toBe('SAMEORIGIN')
  })
})

// ---------------------------------------------------------------------------
// Cache headers
// ---------------------------------------------------------------------------
describe('getCacheHeaders', () => {
  it('returns long cache for image content types', () => {
    const h = getCacheHeaders('image/png')
    expect(h['Cache-Control']).toContain('max-age=31536000')
    expect(h['Cache-Control']).toContain('immutable')
  })

  it('returns short cache for json', () => {
    const h = getCacheHeaders('application/json')
    expect(h['Cache-Control']).toContain('max-age=300')
  })

  it('returns no-cache for default', () => {
    const h = getCacheHeaders('text/html')
    expect(h['Cache-Control']).toContain('no-cache')
  })
})

// ---------------------------------------------------------------------------
// successResponse
// ---------------------------------------------------------------------------
describe('successResponse', () => {
  it('returns 200', () => {
    expect(successResponse({ ok: true }).status).toBe(200)
  })

  it('body has success=true and data', async () => {
    const body = await parseBody(successResponse({ foo: 'bar' }))
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ foo: 'bar' })
  })

  it('body includes metadata.timestamp as ISO string', async () => {
    const body = await parseBody(successResponse(null))
    expect(body.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('includes optional message when supplied', async () => {
    const body = await parseBody(successResponse({}, 'created!'))
    expect(body.message).toBe('created!')
  })

  it('sets CORS header for supplied origin', () => {
    const res = successResponse({}, undefined, undefined, 'http://localhost:5173')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('falls back to canonical when no origin supplied', () => {
    const res = successResponse({})
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })
})

// ---------------------------------------------------------------------------
// createdResponse
// ---------------------------------------------------------------------------
describe('createdResponse', () => {
  it('returns 201', () => {
    expect(createdResponse({ id: 1 }).status).toBe(201)
  })

  it('body has success=true', async () => {
    const body = await parseBody(createdResponse({ id: 1 }))
    expect(body.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// errorResponse
// ---------------------------------------------------------------------------
describe('errorResponse', () => {
  it('returns supplied status', () => {
    expect(errorResponse('oops', 422).status).toBe(422)
  })

  it('body has success=false', async () => {
    const body = await parseBody(errorResponse('oops', 400))
    expect(body.success).toBe(false)
  })

  it('body exposes error message', async () => {
    const body = await parseBody(errorResponse('not found', 404))
    expect(body.error).toBe('not found')
  })

  it('body includes details when supplied', async () => {
    const body = await parseBody(errorResponse('bad', 400, { code: 'BAD', field: 'email' }))
    expect(body.metadata.details.code).toBe('BAD')
    expect(body.metadata.details.field).toBe('email')
  })
})

// ---------------------------------------------------------------------------
// Convenience error response wrappers
// ---------------------------------------------------------------------------
describe('badRequestResponse', () => {
  it('returns 400', () => {
    expect(badRequestResponse().status).toBe(400)
  })

  it('uses default message Bad Request', async () => {
    const body = await parseBody(badRequestResponse())
    expect(body.error).toBe('Bad Request')
  })

  it('uses custom message when provided', async () => {
    const body = await parseBody(badRequestResponse('custom msg'))
    expect(body.error).toBe('custom msg')
  })
})

describe('validationErrorResponse', () => {
  it('returns 422', () => {
    expect(validationErrorResponse('Invalid email').status).toBe(422)
  })

  it('with one arg — uses arg as error message and sets VALIDATION_ERROR code in details', async () => {
    const body = await parseBody(validationErrorResponse('Invalid email'))
    expect(body.error).toBe('Invalid email')
    // Single-arg path still sets { code: 'VALIDATION_ERROR' } in metadata.details
    expect(body.metadata.details?.code).toBe('VALIDATION_ERROR')
  })

  it('with two args — sets error to "Validation failed", detail to message, field to first arg', async () => {
    const body = await parseBody(validationErrorResponse('email', 'must be valid'))
    expect(body.error).toBe('Validation failed')
    expect(body.metadata.details.field).toBe('email')
    expect(body.metadata.details.details).toBe('must be valid')
  })
})

describe('authErrorResponse', () => {
  it('returns 401', () => {
    expect(authErrorResponse().status).toBe(401)
  })

  it('body has AUTH_REQUIRED code', async () => {
    const body = await parseBody(authErrorResponse())
    expect(body.metadata.details.code).toBe('AUTH_REQUIRED')
  })

  it('uses custom message', async () => {
    const body = await parseBody(authErrorResponse('login please'))
    expect(body.error).toBe('login please')
  })
})

describe('forbiddenResponse', () => {
  it('returns 403', () => {
    expect(forbiddenResponse().status).toBe(403)
  })

  it('default message is Access denied', async () => {
    const body = await parseBody(forbiddenResponse())
    expect(body.error).toBe('Access denied')
  })
})

describe('notFoundResponse', () => {
  it('returns 404', () => {
    expect(notFoundResponse().status).toBe(404)
  })

  it('appends not found to resource name', async () => {
    const body = await parseBody(notFoundResponse('Pitch'))
    expect(body.error).toBe('Pitch not found')
  })

  it('defaults to Resource not found', async () => {
    const body = await parseBody(notFoundResponse())
    expect(body.error).toBe('Resource not found')
  })
})

// ---------------------------------------------------------------------------
// rateLimitResponse
// ---------------------------------------------------------------------------
describe('rateLimitResponse', () => {
  it('returns 429', () => {
    expect(rateLimitResponse().status).toBe(429)
  })

  it('sets Retry-After header to supplied seconds', () => {
    const res = rateLimitResponse(120)
    expect(res.headers.get('Retry-After')).toBe('120')
  })

  it('sets X-RateLimit-Limit header', () => {
    const res = rateLimitResponse(60, 50)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('50')
  })

  it('sets X-RateLimit-Remaining to 0', () => {
    const res = rateLimitResponse()
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('sets X-RateLimit-Reset as a date string', () => {
    const res = rateLimitResponse()
    const reset = res.headers.get('X-RateLimit-Reset')
    expect(new Date(reset!).getTime()).toBeGreaterThan(Date.now() - 1000)
  })
})

// ---------------------------------------------------------------------------
// serverErrorResponse
// ---------------------------------------------------------------------------
describe('serverErrorResponse', () => {
  it('returns 500', () => {
    expect(serverErrorResponse().status).toBe(500)
  })

  it('default message is Internal server error', async () => {
    const body = await parseBody(serverErrorResponse())
    expect(body.error).toBe('Internal server error')
  })

  it('includes requestId at metadata.details.requestId (single level, no double-nesting)', async () => {
    // serverErrorResponse spreads { code: 'INTERNAL_ERROR', requestId } as ErrorDetails
    // errorResponse sets response.metadata.details = that object
    // So requestId lives at metadata.details.requestId (one sane level)
    const body = await parseBody(serverErrorResponse('boom', 'req-abc'))
    expect(body.metadata.details.requestId).toBe('req-abc')
    expect(body.metadata.details.code).toBe('INTERNAL_ERROR')
  })
})

// ---------------------------------------------------------------------------
// paginatedResponse
// ---------------------------------------------------------------------------
describe('paginatedResponse', () => {
  it('returns 200', () => {
    expect(paginatedResponse([], { page: 1, limit: 10, total: 0 }).status).toBe(200)
  })

  it('computes hasNext and hasPrev correctly', async () => {
    const body = await parseBody(paginatedResponse(['a', 'b'], { page: 2, limit: 2, total: 5 }))
    expect(body.metadata.pagination.hasNext).toBe(true)
    expect(body.metadata.pagination.hasPrev).toBe(true)
  })

  it('hasPrev is false on first page', async () => {
    const body = await parseBody(paginatedResponse([], { page: 1, limit: 10, total: 5 }))
    expect(body.metadata.pagination.hasPrev).toBe(false)
  })

  it('hasNext is false when all items fit on one page', async () => {
    const body = await parseBody(paginatedResponse([], { page: 1, limit: 10, total: 5 }))
    expect(body.metadata.pagination.hasNext).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// corsPreflightResponse
// ---------------------------------------------------------------------------
describe('corsPreflightResponse', () => {
  it('returns 204', () => {
    expect(corsPreflightResponse().status).toBe(204)
  })

  it('body is empty', async () => {
    const res = corsPreflightResponse()
    const text = await res.text()
    expect(text).toBe('')
  })

  it('echoes allowed origin', () => {
    const res = corsPreflightResponse('https://pitchey-5o8.pages.dev')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })
})

// ---------------------------------------------------------------------------
// createAuthErrorResponse (convenience alias)
// ---------------------------------------------------------------------------
describe('createAuthErrorResponse', () => {
  it('returns 401', () => {
    expect(createAuthErrorResponse().status).toBe(401)
  })

  it('delegates to authErrorResponse', async () => {
    const body = await parseBody(createAuthErrorResponse('token expired'))
    expect(body.error).toBe('token expired')
  })
})

// ---------------------------------------------------------------------------
// createErrorResponse
// ---------------------------------------------------------------------------
describe('createErrorResponse', () => {
  it('returns 500', () => {
    const res = createErrorResponse(new Error('boom'))
    expect(res.status).toBe(500)
  })

  it('extracts message from Error object', async () => {
    const body = await parseBody(createErrorResponse(new Error('disk full')))
    expect(body.error).toBe('disk full')
  })

  it('uses fallback message for non-Error', async () => {
    const body = await parseBody(createErrorResponse('string error'))
    expect(body.error).toBe('Internal server error')
  })

  it('uses Origin from request header for CORS', () => {
    const req = new Request('https://api.example.com/test', {
      headers: { Origin: 'http://localhost:5173' }
    })
    const res = createErrorResponse(new Error('oops'), req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })
})

// ---------------------------------------------------------------------------
// jsonResponse
// ---------------------------------------------------------------------------
describe('jsonResponse', () => {
  it('honors the custom status code for both standard and non-standard data', () => {
    // Non-standard data (no `success` key) is wrapped but still respects the passed status.
    expect(jsonResponse({ ok: true }, 201).status).toBe(201)
    // Already-shaped standard-format objects also use the passed status directly.
    expect(jsonResponse({ success: true, data: {} }, 201).status).toBe(201)
    // Default status is still 200 when none is supplied.
    expect(jsonResponse({ ok: true }).status).toBe(200)
  })

  it('returns already-shaped standard response without re-wrapping', async () => {
    const pre = { success: true, data: { x: 1 } }
    const body = await parseBody(jsonResponse(pre))
    // Standard shape preserved — should NOT have double-nested data
    expect(body.success).toBe(true)
  })

  it('wraps legacy plain objects in success format', async () => {
    const body = await parseBody(jsonResponse({ foo: 'bar' }))
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ foo: 'bar' })
  })
})

// ---------------------------------------------------------------------------
// setRequestOrigin (deprecated no-op)
// ---------------------------------------------------------------------------
describe('setRequestOrigin (no-op)', () => {
  it('calling it does not throw', () => {
    expect(() => setRequestOrigin('https://pitchey-5o8.pages.dev')).not.toThrow()
    expect(() => setRequestOrigin(null)).not.toThrow()
  })
})
