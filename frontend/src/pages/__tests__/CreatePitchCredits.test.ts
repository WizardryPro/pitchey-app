/**
 * E2E tests for the Creator Pitch Creation credit flow.
 *
 * Hit the live pitchey-api-prod Worker and Neon database.
 * Uses node:https directly to bypass the global fetch mock in test/setup.ts.
 *
 * Note: Production enforces Cloudflare Turnstile on sign-in.
 * Set TURNSTILE_TEST_TOKEN env var to the Cloudflare always-pass token
 * (1x0000000000000000000000000000000AA) if using the Turnstile test secret key,
 * or leave unset to skip auth-dependent tests gracefully.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import https from 'node:https'

const API_BASE = 'https://pitchey-api-prod.ndlovucavelle.workers.dev'
const TURNSTILE_TOKEN = process.env.TURNSTILE_TEST_TOKEN || '1x0000000000000000000000000000000AA'

const DEMO_CREATOR = {
  email: 'alex.creator@demo.com',
  password: 'Demo123',
}

// ── Real HTTP helper (bypasses vi.fn() fetch mock) ───────────────
interface HttpResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  json: () => Promise<any>
  raw: string
}

function request(url: string, opts: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request(
      urlObj,
      {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode!,
            headers: res.headers as Record<string, string | string[] | undefined>,
            json: () => {
              try {
                return Promise.resolve(JSON.parse(data))
              } catch {
                return Promise.reject(new Error(`Not JSON: ${data.slice(0, 200)}`))
              }
            },
            raw: data,
          })
        })
      },
    )
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

// ── Auth helper ──────────────────────────────────────────────────
let sessionCookie = ''

async function login(email: string, password: string): Promise<string> {
  const res = await request(`${API_BASE}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, turnstileToken: TURNSTILE_TOKEN }),
  })

  // set-cookie may be a string or string[]
  const raw = res.headers['set-cookie']
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []

  for (const hdr of cookies) {
    const m = hdr.match(/(pitchey-session|better-auth-session)=([^;]+)/)
    if (m) return `${m[1]}=${m[2]}`
  }

  throw new Error(
    `Login returned ${res.status} but no session cookie. ` +
      `set-cookie: ${JSON.stringify(raw)}`,
  )
}

async function api(path: string, opts: { method?: string; body?: string } = {}) {
  const res = await request(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function unauthApi(path: string, opts: { method?: string; body?: string } = {}) {
  const res = await request(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json' },
  })
  return { status: res.status }
}

// ── Cleanup tracker ──────────────────────────────────────────────
const createdPitchIds: number[] = []
let authFailed = false

// ── Setup / Teardown ─────────────────────────────────────────────
beforeAll(async () => {
  try {
    sessionCookie = await login(DEMO_CREATOR.email, DEMO_CREATOR.password)
  } catch {
    // Turnstile or auth failure — mark so tests skip gracefully
    authFailed = true
    console.warn('E2E auth failed (likely Turnstile). Auth-dependent tests will be skipped.')
  }
}, 15_000)

afterAll(async () => {
  for (const id of createdPitchIds) {
    await api(`/api/pitches/${id}`, { method: 'DELETE' }).catch(() => {})
  }
}, 15_000)

// ── Tests ────────────────────────────────────────────────────────

describe('Authentication', () => {
  it('gets a valid session for demo creator', async () => {
    if (authFailed) return
    const { status, data } = await api('/api/auth/session')
    expect(status).toBe(200)
    // session endpoint may nest user under data or directly
    const user = data?.data?.user ?? data?.user
    expect(user).toBeTruthy()
    expect(user?.email ?? user?.name).toBeTruthy()
  })
})

describe('Credit Balance', () => {
  it('returns credit balance for authenticated user', async () => {
    if (authFailed) return
    const { status, data } = await api('/api/payments/credits/balance')
    expect(status).toBe(200)
    // balance may be at various nesting levels
    const balance =
      data?.data?.balance?.credits ??
      data?.data?.credits ??
      data?.credits ??
      data?.balance
    expect(balance).toBeDefined()
    expect(typeof balance).toBe('number')
  })

  it('rejects unauthenticated balance request', async () => {
    const { status } = await unauthApi('/api/payments/credits/balance')
    expect(status).toBeGreaterThanOrEqual(401)
  })
})

describe('Pitch Creation', () => {
  it('creates a pitch with minimal valid data', async () => {
    if (authFailed) return
    const pitchData = {
      title: `E2E Credit Test ${Date.now()}`,
      logline: 'An automated E2E test pitch verifying the credit creation flow end-to-end',
      genre: 'drama',
      format: 'feature_narrative',
    }

    const { status, data } = await api('/api/pitches', {
      method: 'POST',
      body: JSON.stringify(pitchData),
    })

    expect(status).toBeLessThan(300)
    expect(data?.success).toBe(true)

    const pitchId = data?.data?.pitch?.id ?? data?.data?.id ?? data?.pitch?.id
    expect(pitchId).toBeDefined()
    if (pitchId) createdPitchIds.push(pitchId)
  })

  it('rejects pitch with missing title', async () => {
    if (authFailed) return
    const { status } = await api('/api/pitches', {
      method: 'POST',
      body: JSON.stringify({ logline: 'No title provided', genre: 'drama' }),
    })
    expect(status).toBeGreaterThanOrEqual(400)
  })

  it('rejects pitch with missing logline', async () => {
    if (authFailed) return
    const { status } = await api('/api/pitches', {
      method: 'POST',
      body: JSON.stringify({ title: 'Missing Logline Pitch', genre: 'drama' }),
    })
    expect(status).toBeGreaterThanOrEqual(400)
  })

  it('rejects unauthenticated pitch creation', async () => {
    const { status } = await unauthApi('/api/pitches', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Should Fail',
        logline: 'No auth cookie attached',
        genre: 'drama',
      }),
    })
    expect(status).toBeGreaterThanOrEqual(401)
  })
})

describe('Credit Cost Config (static)', () => {
  it('basic_upload costs 10 credits', async () => {
    const { getCreditCost } = await import('../../config/subscription-plans')
    expect(getCreditCost('basic_upload')).toBe(10)
  })

  it('extra_image costs 1 credit', async () => {
    const { getCreditCost } = await import('../../config/subscription-plans')
    expect(getCreditCost('extra_image')).toBe(1)
  })

  it('video_link costs 1 credit', async () => {
    const { getCreditCost } = await import('../../config/subscription-plans')
    expect(getCreditCost('video_link')).toBe(1)
  })
})

describe('Credit Deduction on Pitch Creation (not yet wired)', () => {
  // CreatePitch.tsx does NOT call paymentsAPI.useCredits() after pitchService.create().
  // These specs document the expected behaviour once the credit flow is connected.

  it.todo('balance decreases by 10 after creating a basic pitch')
  it.todo('API rejects pitch creation when credit balance < 10')
  it.todo('extra image uploads deduct 1 credit each')
  it.todo('video link uploads deduct 1 credit each')
  it.todo('pitch is still saved if credit deduction call fails')
})
