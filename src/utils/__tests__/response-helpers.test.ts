/**
 * Tests for src/utils/response-helpers.ts
 *
 * This is a lightweight parallel set of response helpers (no CORS, no security headers)
 * used in some handlers for quick shaping.
 * Covers: all 8 exported functions, status codes, body shape, Content-Type.
 */
import { describe, it, expect } from 'vitest'
import {
  successResponse,
  errorResponse,
  authErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  validationErrorResponse,
  createdResponse,
  paginatedResponse,
} from '../response-helpers'

async function json(res: Response) {
  return res.json() as Promise<any>
}

// ---------------------------------------------------------------------------
// successResponse
// ---------------------------------------------------------------------------
describe('successResponse', () => {
  it('returns 200 by default', () => {
    expect(successResponse({ ok: 1 }).status).toBe(200)
  })

  it('uses custom status', () => {
    expect(successResponse({}, 202).status).toBe(202)
  })

  it('body is the raw data (no success wrapper)', async () => {
    const body = await json(successResponse({ foo: 'bar' }))
    expect(body.foo).toBe('bar')
  })

  it('Content-Type is application/json', () => {
    expect(successResponse({}).headers.get('Content-Type')).toBe('application/json')
  })
})

// ---------------------------------------------------------------------------
// errorResponse
// ---------------------------------------------------------------------------
describe('errorResponse', () => {
  it('returns 400 by default', () => {
    expect(errorResponse('bad').status).toBe(400)
  })

  it('uses custom status', () => {
    expect(errorResponse('conflict', 409).status).toBe(409)
  })

  it('body has success=false and error message', async () => {
    const body = await json(errorResponse('oops'))
    expect(body.success).toBe(false)
    expect(body.error).toBe('oops')
  })

  it('body includes details when supplied', async () => {
    const body = await json(errorResponse('bad', 400, { field: 'email' }))
    expect(body.details).toEqual({ field: 'email' })
  })
})

// ---------------------------------------------------------------------------
// authErrorResponse
// ---------------------------------------------------------------------------
describe('authErrorResponse', () => {
  it('returns 401 by default', () => {
    expect(authErrorResponse().status).toBe(401)
  })

  it('default message is Authentication required', async () => {
    const body = await json(authErrorResponse())
    expect(body.error).toBe('Authentication required')
  })

  it('uses custom message', async () => {
    const body = await json(authErrorResponse('session expired'))
    expect(body.error).toBe('session expired')
  })

  it('custom status overrides 401', () => {
    expect(authErrorResponse('x', 403).status).toBe(403)
  })

  it('body has success=false', async () => {
    expect((await json(authErrorResponse())).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// forbiddenResponse
// ---------------------------------------------------------------------------
describe('forbiddenResponse', () => {
  it('returns 403 by default', () => {
    expect(forbiddenResponse().status).toBe(403)
  })

  it('default message is Forbidden', async () => {
    const body = await json(forbiddenResponse())
    expect(body.error).toBe('Forbidden')
  })

  it('custom message and status work', async () => {
    const res = forbiddenResponse('NDA required', 451)
    expect(res.status).toBe(451)
    expect((await json(res)).error).toBe('NDA required')
  })
})

// ---------------------------------------------------------------------------
// notFoundResponse
// ---------------------------------------------------------------------------
describe('notFoundResponse', () => {
  it('returns 404 by default', () => {
    expect(notFoundResponse().status).toBe(404)
  })

  it('default message is Not found', async () => {
    const body = await json(notFoundResponse())
    expect(body.error).toBe('Not found')
  })

  it('uses custom message', async () => {
    const body = await json(notFoundResponse('Pitch not found'))
    expect(body.error).toBe('Pitch not found')
  })
})

// ---------------------------------------------------------------------------
// serverErrorResponse
// ---------------------------------------------------------------------------
describe('serverErrorResponse', () => {
  it('returns 500 by default', () => {
    expect(serverErrorResponse().status).toBe(500)
  })

  it('default message is Internal server error', async () => {
    const body = await json(serverErrorResponse())
    expect(body.error).toBe('Internal server error')
  })

  it('custom message used when supplied', async () => {
    const body = await json(serverErrorResponse('DB timeout'))
    expect(body.error).toBe('DB timeout')
  })

  it('body has success=false', async () => {
    expect((await json(serverErrorResponse())).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validationErrorResponse
// ---------------------------------------------------------------------------
describe('validationErrorResponse', () => {
  it('returns 422 by default', () => {
    expect(validationErrorResponse('bad email').status).toBe(422)
  })

  it('body has success=false and error message', async () => {
    const body = await json(validationErrorResponse('bad email'))
    expect(body.success).toBe(false)
    expect(body.error).toBe('bad email')
  })

  it('body includes errors array when supplied', async () => {
    const body = await json(validationErrorResponse('errors', [{ field: 'email' }]))
    expect(body.errors).toEqual([{ field: 'email' }])
  })

  it('custom status works', () => {
    expect(validationErrorResponse('x', undefined, 400).status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// createdResponse
// ---------------------------------------------------------------------------
describe('createdResponse', () => {
  it('returns 201 by default', () => {
    expect(createdResponse({ id: 1 }).status).toBe(201)
  })

  it('body has success=true and spreads data', async () => {
    const body = await json(createdResponse({ id: 99, title: 'New Pitch' }))
    expect(body.success).toBe(true)
    expect(body.id).toBe(99)
    expect(body.title).toBe('New Pitch')
  })
})

// ---------------------------------------------------------------------------
// paginatedResponse
// ---------------------------------------------------------------------------
describe('paginatedResponse', () => {
  it('returns 200 by default', () => {
    expect(paginatedResponse({ pitches: [] }, { page: 1, total: 0 }).status).toBe(200)
  })

  it('body has success=true with spread data and pagination', async () => {
    const body = await json(paginatedResponse(
      { pitches: [{ id: 1 }] },
      { page: 1, limit: 10, total: 1 }
    ))
    expect(body.success).toBe(true)
    expect(body.pitches).toEqual([{ id: 1 }])
    expect(body.pagination.total).toBe(1)
  })
})
