import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockFetch = vi.fn()
const mockSetUser = vi.fn()
const mockSessionCacheClear = vi.fn()
const mockSessionManagerClearCache = vi.fn()

// ─── Stub global fetch before any module loads ──────────────────────
vi.stubGlobal('fetch', mockFetch)

// ─── Mock sessionCache ──────────────────────────────────────────────
vi.mock('../../store/sessionCache', () => ({
  sessionCache: {
    get: vi.fn(),
    set: vi.fn(),
    clear: mockSessionCacheClear,
  },
}))

// ─── Mock session-manager ────────────────────────────────────────────
vi.mock('../session-manager', () => ({
  sessionManager: {
    clearCache: mockSessionManagerClearCache,
    getCachedSession: vi.fn(),
    checkSession: vi.fn(),
    updateCache: vi.fn(),
    resetForNewPageLoad: vi.fn(),
  },
}))

// ─── Mock betterAuthStore (lazily imported inside the 401 handler) ───
const mockStoreGetState = vi.fn()
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: {
    getState: mockStoreGetState,
  },
}))

// ─── Mock zod-schemas (used by getValidated) ────────────────────────
vi.mock('@shared/types/zod-schemas', () => ({
  ValidatedPitchesResponse: {},
  ValidatedSinglePitchResponse: {},
  ValidatedUserResponse: {},
  safeValidateApiResponse: vi.fn((schema: any, response: any) => ({
    success: true,
    data: response.data,
  })),
  PitchesResponseSchema: {},
  PitchSchema: {},
  UserSchema: {},
  NDASchema: {},
  InvestmentSchema: {},
  LoginCredentialsSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
  RegisterDataSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
  CreatePitchInputSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
  UpdatePitchInputSchema: { safeParse: (d: any) => ({ success: true, data: d }) },
}))

// ─── Dynamic import (after all vi.mock calls) ────────────────────────
let apiClient: any

beforeAll(async () => {
  const mod = await import('../api-client')
  apiClient = mod.default
})

// ─── Helpers ─────────────────────────────────────────────────────────
function makeOkResponse(body: unknown, contentType = 'application/json') {
  const text = JSON.stringify(body)
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    text: async () => text,
  }
}

function makeErrorResponse(status: number, body: unknown, contentType = 'application/json') {
  const text = JSON.stringify(body)
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    text: async () => text,
  }
}

// Session check response (minimal — not an API response, just ok/status)
function makeSessionOkResponse(ok: boolean) {
  return {
    ok,
    status: ok ? 200 : 401,
    statusText: ok ? 'OK' : 'Unauthorized',
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ ok }),
  }
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Default store state: no authenticated user
    mockStoreGetState.mockReturnValue({ user: null, setUser: mockSetUser })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── credentials:include ───────────────────────────────────────────
  describe('credentials', () => {
    it('always includes credentials:include on GET', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ data: { id: 1 } }))
      await apiClient.get('/api/test')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    it('always includes credentials:include on POST', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ data: {} }))
      await apiClient.post('/api/test', { foo: 'bar' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  // ── successful GET ────────────────────────────────────────────────
  describe('get', () => {
    it('returns success:true with data on 200 JSON', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ title: 'Test Pitch' }))
      const result = await apiClient.get('/api/pitches/1')
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ title: 'Test Pitch' })
    })

    it('extracts nested data.data when present', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ data: { id: 5 } }))
      const result = await apiClient.get('/api/pitches/5')
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 5 })
    })

    it('single-flight: concurrent identical GETs share one fetch call', async () => {
      // Create a pending promise that we can resolve from outside
      let resolveP!: (v: any) => void
      const pending = new Promise<any>(res => { resolveP = res })
      mockFetch.mockReturnValueOnce(pending)

      // Fire two GETs concurrently — before settling pending
      const p1 = apiClient.get('/api/dedupe-sf')
      const p2 = apiClient.get('/api/dedupe-sf')

      // Now resolve the single underlying fetch
      resolveP(makeOkResponse({ ok: true }))

      const [r1, r2] = await Promise.all([p1, p2])

      // fetch must have been called exactly once
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    })

    it('sequential GETs for the same endpoint each fire a fetch', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkResponse({ n: 1 }))
        .mockResolvedValueOnce(makeOkResponse({ n: 2 }))

      const r1 = await apiClient.get('/api/seq')
      const r2 = await apiClient.get('/api/seq')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(r1.data).toEqual({ n: 1 })
      expect(r2.data).toEqual({ n: 2 })
    })
  })

  // ── non-JSON response ─────────────────────────────────────────────
  describe('non-JSON content-type', () => {
    it('returns success:false with non-JSON message when content-type is text/html', async () => {
      const htmlResp = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (h: string) => (h === 'content-type' ? 'text/html' : null) },
        text: async () => '<html>Not JSON</html>',
      }
      mockFetch.mockResolvedValueOnce(htmlResp)
      const result = await apiClient.get('/api/non-json')
      expect(result.success).toBe(false)
      expect(result.error?.message).toMatch(/non-JSON/i)
    })
  })

  // ── HTTP error responses ──────────────────────────────────────────
  describe('HTTP errors', () => {
    it('returns success:false for 404', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404, { error: 'Not found' }))
      const result = await apiClient.get('/api/missing')
      expect(result.success).toBe(false)
      expect(result.error?.status).toBe(404)
      expect(result.error?.message).toMatch(/not found/i)
    })

    it('returns success:false for 500', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: 'Internal error' }))
      const result = await apiClient.get('/api/broken')
      expect(result.success).toBe(false)
      expect(result.error?.status).toBe(500)
    })

    it('uses the error message string from the response body', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(422, { error: 'Validation failed', code: 'INVALID' }))
      const result = await apiClient.post('/api/validate', {})
      expect(result.error?.message).toBe('Validation failed')
      expect(result.error?.code).toBe('INVALID')
    })
  })

  // ── 401 handling ──────────────────────────────────────────────────
  describe('401 handling', () => {
    it('calls session check endpoint on 401', async () => {
      // Primary API call returns 401
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(401, { error: 'Unauthorized' }))
        // Session verification call — returns expired
        .mockResolvedValueOnce(makeSessionOkResponse(false))

      mockStoreGetState.mockReturnValue({ user: null, setUser: mockSetUser })

      await apiClient.get('/api/protected')
      await vi.runAllTimersAsync()

      // Second call should be the session check
      const calls = mockFetch.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(2)
      expect(calls[1][0]).toMatch(/\/api\/auth\/session/)
    })

    it('clears session caches when session is truly expired on 401', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(makeSessionOkResponse(false))

      mockStoreGetState.mockReturnValue({ user: { id: 1 }, setUser: mockSetUser })

      await apiClient.get('/api/protected')
      await vi.runAllTimersAsync()

      expect(mockSessionCacheClear).toHaveBeenCalled()
      expect(mockSessionManagerClearCache).toHaveBeenCalled()
    })

    it('calls setUser(null) when session is expired', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(makeSessionOkResponse(false))

      mockStoreGetState.mockReturnValue({ user: { id: 1 }, setUser: mockSetUser })

      await apiClient.get('/api/protected')
      await vi.runAllTimersAsync()

      expect(mockSetUser).toHaveBeenCalledWith(null)
    })

    it('does NOT clear session when session endpoint returns ok (false positive 401)', async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(makeSessionOkResponse(true))

      mockStoreGetState.mockReturnValue({ user: { id: 1 }, setUser: mockSetUser })

      await apiClient.get('/api/endpoint')
      await vi.runAllTimersAsync()

      // setUser should NOT have been called
      expect(mockSetUser).not.toHaveBeenCalled()
    })

    it('_handlingAuth401 flag prevents duplicate 401 redirects on concurrent requests', async () => {
      // First request 401 -> session check -> expired
      // Second request 401 -> flag is set, no session check
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(makeSessionOkResponse(false)) // session check for first req
        .mockResolvedValueOnce(makeErrorResponse(401, { error: 'Unauthorized' }))
      // No 4th call — flag blocks the second 401 from checking session

      mockStoreGetState.mockReturnValue({ user: { id: 1 }, setUser: mockSetUser })

      // Fire both — they are different endpoints so no single-flight dedup
      const p1 = apiClient.post('/api/a', {})
      const p2 = apiClient.post('/api/b', {})
      await Promise.all([p1, p2])
      await vi.runAllTimersAsync()

      // setUser should only be called once
      expect(mockSetUser).toHaveBeenCalledTimes(1)
    })
  })

  // ── retry logic ───────────────────────────────────────────────────
  describe('retry logic', () => {
    it('retries on NetworkError up to maxRetries (2) and succeeds on 3rd attempt', async () => {
      const networkErr = Object.assign(new Error('getaddrinfo ENOTFOUND api.example.com'), {
        name: 'NetworkError',
      })
      mockFetch
        .mockRejectedValueOnce(networkErr)
        .mockRejectedValueOnce(networkErr)
        .mockResolvedValueOnce(makeOkResponse({ ok: true }))

      // Use runAllTimersAsync to process the retry delays
      const promise = apiClient.get('/api/retry-test')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
    })

    it('fails after maxRetries (2) are exhausted — returns NETWORK_ERROR', async () => {
      const networkErr = Object.assign(new Error('ERR_NAME_NOT_RESOLVED'), {
        name: 'NetworkError',
      })
      mockFetch
        .mockRejectedValueOnce(networkErr)
        .mockRejectedValueOnce(networkErr)
        .mockRejectedValueOnce(networkErr)

      const promise = apiClient.get('/api/always-fail')
      await vi.runAllTimersAsync()
      const result = await promise

      // 3 attempts total (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NETWORK_ERROR')
    })

    it('does NOT retry on "Failed to fetch" (CORS error)', async () => {
      const corsErr = new Error('Failed to fetch')
      mockFetch.mockRejectedValueOnce(corsErr)

      const result = await apiClient.get('/api/cors-blocked')
      // No timers needed since no retry
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
    })

    it('does NOT retry on Cross-Origin error', async () => {
      const corsErr = new Error('Cross-Origin request blocked')
      mockFetch.mockRejectedValueOnce(corsErr)

      const result = await apiClient.get('/api/cors')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
    })

    it('does NOT retry on Access-Control error', async () => {
      const corsErr = new Error('Access-Control-Allow-Origin missing')
      mockFetch.mockRejectedValueOnce(corsErr)

      const result = await apiClient.get('/api/cors2')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
    })

    it('DOES retry on ENOTFOUND DNS error', async () => {
      const dnsErr = Object.assign(new Error('getaddrinfo ENOTFOUND host.local'), {
        code: 'ENOTFOUND',
      })
      mockFetch
        .mockRejectedValueOnce(dnsErr)
        .mockResolvedValueOnce(makeOkResponse({ ok: true }))

      const promise = apiClient.get('/api/dns-fail')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })

    it('DOES retry on error.name === "NetworkError"', async () => {
      const netErr = Object.assign(new Error('Connection refused'), { name: 'NetworkError' })
      mockFetch
        .mockRejectedValueOnce(netErr)
        .mockResolvedValueOnce(makeOkResponse({ ok: true }))

      const promise = apiClient.get('/api/netfail')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })

    it('DOES retry on getaddrinfo ENOTFOUND message', async () => {
      const dnsErr = new Error('getaddrinfo ENOTFOUND api.host.local')
      mockFetch
        .mockRejectedValueOnce(dnsErr)
        .mockResolvedValueOnce(makeOkResponse({ ok: true }))

      const promise = apiClient.get('/api/dns-msg')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })
  })

  // ── HTTP methods ──────────────────────────────────────────────────
  describe('HTTP methods', () => {
    it('post sends JSON body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ created: true }))
      await apiClient.post('/api/items', { title: 'New Item' })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('POST')
      expect(opts.body).toBe(JSON.stringify({ title: 'New Item' }))
    })

    it('put sends JSON body with PUT method', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ updated: true }))
      await apiClient.put('/api/items/1', { title: 'Updated' })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('PUT')
      expect(opts.body).toBe(JSON.stringify({ title: 'Updated' }))
    })

    it('delete sends DELETE method', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ deleted: true }))
      await apiClient.delete('/api/items/1')
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('DELETE')
    })

    it('patch sends PATCH method with body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ patched: true }))
      await apiClient.patch('/api/items/1', { status: 'closed' })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('PATCH')
      expect(opts.body).toBe(JSON.stringify({ status: 'closed' }))
    })

    it('post without body omits body', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }))
      await apiClient.post('/api/no-body')
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBeUndefined()
    })
  })

  // ── empty/malformed body ──────────────────────────────────────────
  describe('empty response body', () => {
    it('empty-body 200 is a clean success with null data, not an error object as data', async () => {
      // An empty-body 2xx response must report success WITHOUT handing the caller
      // an error-shaped object as data. Previously safeJsonParse returned
      // { error: 'Empty response body' } and makeRequest only gated on 'Invalid JSON',
      // so an empty 200 surfaced as success:true with { error: ... } as data.
      const emptyResp = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
        text: async () => '',
      }
      mockFetch.mockResolvedValueOnce(emptyResp)
      const result = await apiClient.get('/api/empty')
      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('empty-body non-2xx surfaces as a failure', async () => {
      const emptyErrResp = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
        text: async () => '',
      }
      mockFetch.mockResolvedValueOnce(emptyErrResp)
      const result = await apiClient.get('/api/empty-error')
      expect(result.success).toBe(false)
      expect(result.error?.status).toBe(500)
    })

    it('malformed JSON returns a result without throwing', async () => {
      const badJsonResp = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
        text: async () => '{ this is not json }',
      }
      mockFetch.mockResolvedValueOnce(badJsonResp)
      const result = await apiClient.get('/api/bad-json')
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('PARSE_ERROR')
    })
  })

  // ── ndaAPI helpers ────────────────────────────────────────────────
  describe('ndaAPI', () => {
    it('requestNDA calls POST /api/ndas/request with pitchId', async () => {
      const { ndaAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1, status: 'pending' }))
      await ndaAPI.requestNDA(42, { ndaType: 'basic', requestMessage: 'please' })
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/ndas\/request/)
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.pitchId).toBe(42)
    })

    it('getSignedNDAs calls GET /api/ndas/signed', async () => {
      const { ndaAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse([]))
      await ndaAPI.getSignedNDAs()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/ndas\/signed/)
    })

    it('approveRequest calls POST /api/ndas/:id/approve', async () => {
      const { ndaAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1, status: 'approved' }))
      await ndaAPI.approveRequest(5)
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/ndas\/5\/approve/)
    })

    it('getActiveNDAs calls GET /api/ndas/active', async () => {
      const { ndaAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse([]))
      await ndaAPI.getActiveNDAs()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/ndas\/active/)
    })
  })

  // ── savedPitchesAPI helpers ───────────────────────────────────────
  describe('savedPitchesAPI', () => {
    it('savePitch calls POST /api/saved-pitches', async () => {
      const { savedPitchesAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1 }))
      await savedPitchesAPI.savePitch(99, 'my notes')
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/saved-pitches/)
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body).pitchId).toBe(99)
    })

    it('unsavePitch calls DELETE /api/saved-pitches/:id', async () => {
      const { savedPitchesAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }))
      await savedPitchesAPI.unsavePitch(7)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/saved-pitches\/7/)
      expect(opts.method).toBe('DELETE')
    })

    it('getSavedPitches builds query string from params', async () => {
      const { savedPitchesAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse([]))
      await savedPitchesAPI.getSavedPitches({ page: 2, limit: 10, genre: 'drama' })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/page=2/)
      expect(url).toMatch(/limit=10/)
      expect(url).toMatch(/genre=drama/)
    })

    it('isPitchSaved calls GET /api/saved-pitches/check/:id', async () => {
      const { savedPitchesAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ isSaved: true, savedPitchId: 5 }))
      await savedPitchesAPI.isPitchSaved(10)
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/saved-pitches\/check\/10/)
    })
  })

  // ── dashboardAPI helpers ──────────────────────────────────────────
  describe('dashboardAPI', () => {
    it('getInvestorStats calls GET /api/investor/dashboard', async () => {
      const { dashboardAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ stats: {} }))
      await dashboardAPI.getInvestorStats()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/investor\/dashboard/)
    })

    it('getCreatorStats calls GET /api/creator/dashboard', async () => {
      const { dashboardAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ stats: {} }))
      await dashboardAPI.getCreatorStats()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/creator\/dashboard/)
    })

    it('getProductionStats calls GET /api/production/dashboard', async () => {
      const { dashboardAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ stats: {} }))
      await dashboardAPI.getProductionStats()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/production\/dashboard/)
    })
  })

  // ── authAPI ───────────────────────────────────────────────────────
  describe('authAPI', () => {
    it('logout returns success:true even if backend returns error', async () => {
      const { authAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: 'Server error' }))
      const result = await authAPI.logout()
      // Logout is designed to succeed locally even on backend failure
      expect(result.success).toBe(true)
    })

    it('getSession calls GET /api/auth/session', async () => {
      const { authAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ user: { id: 1 }, session: {} }))
      await authAPI.getSession()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/auth\/session/)
    })

    it('login validates credentials format before calling API', async () => {
      const { authAPI } = await import('../api-client')
      // With our mock schema (always succeeds), just test it goes to the right endpoint
      mockFetch.mockResolvedValueOnce(makeOkResponse({ user: { id: 1 } }))
      await authAPI.login('u@example.com', 'pass')
      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/auth\/creator\/login/)
    })
  })

  // ── infoRequestAPI ────────────────────────────────────────────────
  describe('infoRequestAPI', () => {
    it('close calls PATCH with status:closed', async () => {
      const { infoRequestAPI } = await import('../api-client')
      mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1, status: 'closed' }))
      await infoRequestAPI.close(3)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toMatch(/\/api\/info-requests\/3/)
      expect(opts.method).toBe('PATCH')
      expect(JSON.parse(opts.body).status).toBe('closed')
    })
  })
})
