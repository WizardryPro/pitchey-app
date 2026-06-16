/**
 * Tests for src/utils/public-data-filter.ts
 *
 * Security-relevant file: verifies that private fields are stripped before
 * any data reaches a public endpoint. Any test documenting a LEAK is marked
 * with a LEAK comment and intentionally asserts the existing (buggy) behavior
 * per the task instructions — do NOT fix leaks here, just document them.
 *
 * Covers:
 *   - filterPitchForPublic: status/visibility gating, sensitive field removal,
 *     synopsis truncation (500 chars at word boundary), comparable_works limit,
 *     creator_id exclusion, rating sourcing (rating_average vs legacy rating)
 *   - filterPitchesForPublic: array handling, null filtering
 *   - filterUserForPublic: private field removal, bio truncation, URL validation
 *   - removeSensitiveFields: SENSITIVE_FIELDS list, recursive cleaning
 *   - createPublicErrorResponse: message passthrough by status code
 *   - addPublicCacheHeaders: cache-control header values
 *   - createPublicResponse: runs removeSensitiveFields on data, CORS header
 *   - generateETag: deterministic hash, quoted string format
 */
import { describe, it, expect } from 'vitest'
import {
  filterPitchForPublic,
  filterPitchesForPublic,
  filterUserForPublic,
  removeSensitiveFields,
  createPublicErrorResponse,
  addPublicCacheHeaders,
  createPublicResponse,
  generateETag,
} from '../public-data-filter'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BASE_PITCH = {
  id: '1',
  title: 'Galaxy Road',
  tagline: 'A space western',
  genre: 'Sci-Fi',
  format: 'Feature Film',
  logline: 'A lone ranger rides the galaxy.',
  status: 'published',
  visibility: 'public',
  view_count: 10,
  like_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Adds all sensitive fields that should be stripped
const PITCH_WITH_SENSITIVE = {
  ...BASE_PITCH,
  email: 'creator@secret.com',
  password_hash: 'bcrypt$hash',
  stripe_customer_id: 'cus_123',
  pitch_deck_url: 'https://s3.example.com/deck.pdf',
  video_pitch_url: 'https://s3.example.com/pitch.mp4',
  funding_goal: 500000,
  investor_details: [{ name: 'Investor A' }],
  creator_email: 'private@creator.com',
  creator_phone: '+15551234567',
  internal_notes: 'Do not share',
  api_key: 'sk_live_secret',
}

const BASE_USER = {
  id: '42',
  username: 'karlcreator',
  profile_image: 'https://r2.example.com/avatar.jpg',
  company_name: 'Karl Studios',
  bio: 'I make films.',
  location: 'London',
  website: 'https://karlstudios.com',
  created_at: new Date().toISOString(),
  // Private fields that must be stripped:
  email: 'karl@secret.com',
  password: 'plaintext!',
  phone: '+44123456789',
}

// ---------------------------------------------------------------------------
// filterPitchForPublic — status / visibility gating
// ---------------------------------------------------------------------------
describe('filterPitchForPublic — visibility gating', () => {
  it('returns null for draft pitches', () => {
    expect(filterPitchForPublic({ ...BASE_PITCH, status: 'draft' })).toBeNull()
  })

  it('returns null for private visibility', () => {
    expect(filterPitchForPublic({ ...BASE_PITCH, visibility: 'private' })).toBeNull()
  })

  it('returns null for undefined/missing pitch', () => {
    expect(filterPitchForPublic(null)).toBeNull()
    expect(filterPitchForPublic(undefined)).toBeNull()
  })

  it('allows investors_only visibility', () => {
    expect(filterPitchForPublic({ ...BASE_PITCH, visibility: 'investors_only' })).not.toBeNull()
  })

  it('allows public visibility with published status', () => {
    expect(filterPitchForPublic(BASE_PITCH)).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// filterPitchForPublic — sensitive field removal
// ---------------------------------------------------------------------------
describe('filterPitchForPublic — sensitive field removal', () => {
  it('does not include email', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).email).toBeUndefined()
  })

  it('does not include password_hash', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).password_hash).toBeUndefined()
  })

  it('does not include stripe_customer_id', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).stripe_customer_id).toBeUndefined()
  })

  it('does not include pitch_deck_url (private document)', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).pitch_deck_url).toBeUndefined()
  })

  it('does not include video_pitch_url (private video)', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).video_pitch_url).toBeUndefined()
  })

  it('does not include funding_goal', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).funding_goal).toBeUndefined()
  })

  it('does not include investor_details', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).investor_details).toBeUndefined()
  })

  it('does not include creator_email', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).creator_email).toBeUndefined()
  })

  it('does not include api_key', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).api_key).toBeUndefined()
  })

  it('does not include internal_notes', () => {
    const out = filterPitchForPublic(PITCH_WITH_SENSITIVE)!
    expect((out as any).internal_notes).toBeUndefined()
  })

  // creator_id is on the SENSITIVE_FIELDS list — verify it is excluded
  it('does not expose creator_id', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, creator_id: 7 })!
    expect((out as any).creator_id).toBeUndefined()
  })

  it('exposes safe public fields (id, title, genre, logline)', () => {
    const out = filterPitchForPublic(BASE_PITCH)!
    expect(out.id).toBe('1')
    expect(out.title).toBe('Galaxy Road')
    expect(out.genre).toBe('Sci-Fi')
    expect(out.logline).toBe('A lone ranger rides the galaxy.')
  })
})

// ---------------------------------------------------------------------------
// filterPitchForPublic — synopsis truncation
// NOTE: The source truncates at 500 chars, NOT 300 chars.
// CLAUDE.md says "synopsis truncated to 300 chars" but the implementation
// uses maxLength=500. This is a discrepancy — documented below.
// ---------------------------------------------------------------------------
describe('filterPitchForPublic — synopsis truncation', () => {
  it('passes through short synopsis unchanged', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, synopsis: 'Short text.' })!
    expect(out.synopsis).toBe('Short text.')
  })

  it('truncates synopsis longer than 500 chars with ellipsis at word boundary', () => {
    // Build a string longer than 500 chars
    const long = 'word '.repeat(120) // 600 chars
    const out = filterPitchForPublic({ ...BASE_PITCH, synopsis: long })!
    expect(out.synopsis).toBeDefined()
    expect(out.synopsis!.length).toBeLessThanOrEqual(504) // 500 + '...' max
    expect(out.synopsis!.endsWith('...')).toBe(true)
  })

  // DISCREPANCY NOTE: CLAUDE.md states 300 char limit; code uses 500.
  // A 400-char synopsis should NOT be truncated by the current implementation.
  it('DISCREPANCY: 400-char synopsis is NOT truncated (code uses 500, not 300 as stated in CLAUDE.md)', () => {
    const fourHundred = 'a '.repeat(200) // 400 chars
    const out = filterPitchForPublic({ ...BASE_PITCH, synopsis: fourHundred })!
    // Current behavior: NOT truncated at 400 chars (500 is the limit)
    expect(out.synopsis!.endsWith('...')).toBe(false)
  })

  it('truncates long_synopsis as well', () => {
    const long = 'word '.repeat(120)
    const out = filterPitchForPublic({ ...BASE_PITCH, long_synopsis: long })!
    expect(out.long_synopsis!.endsWith('...')).toBe(true)
  })

  it('returns undefined for missing synopsis', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, synopsis: undefined })!
    expect(out.synopsis).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// filterPitchForPublic — comparable_works capped at 3
// ---------------------------------------------------------------------------
describe('filterPitchForPublic — comparable_works limit', () => {
  it('caps comparable_works at 3 items', () => {
    const out = filterPitchForPublic({
      ...BASE_PITCH,
      comparable_works: ['A', 'B', 'C', 'D', 'E']
    })!
    expect(out.comparable_works!.length).toBe(3)
  })

  it('returns empty array when comparable_works is not an array', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, comparable_works: 'string' })!
    expect(out.comparable_works).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// filterPitchForPublic — rating sourcing
// ---------------------------------------------------------------------------
describe('filterPitchForPublic — rating sourcing', () => {
  it('uses rating_average over legacy rating column', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, rating: 0, rating_average: 4.5 })!
    expect(out.rating).toBe(4.5)
  })

  it('falls back to legacy rating when rating_average is absent', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, rating: 3, rating_average: undefined })!
    expect(out.rating).toBe(3)
  })

  it('rating is undefined when both are 0', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, rating: 0, rating_average: 0 })!
    // 0 is falsy; the expression `Number(...) || undefined` yields undefined
    expect(out.rating).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// filterPitchForPublic — view_count safety
// ---------------------------------------------------------------------------
describe('filterPitchForPublic — view_count safety', () => {
  it('clamps negative view_count to 0', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, view_count: -5 })!
    expect(out.view_count).toBe(0)
  })

  it('defaults view_count to 0 when missing', () => {
    const out = filterPitchForPublic({ ...BASE_PITCH, view_count: undefined })!
    expect(out.view_count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// filterPitchesForPublic
// ---------------------------------------------------------------------------
describe('filterPitchesForPublic', () => {
  it('returns empty array for non-array input', () => {
    expect(filterPitchesForPublic(null as any)).toEqual([])
    expect(filterPitchesForPublic('string' as any)).toEqual([])
  })

  it('filters out draft pitches from array', () => {
    const pitches = [
      BASE_PITCH,
      { ...BASE_PITCH, id: '2', status: 'draft' }
    ]
    expect(filterPitchesForPublic(pitches).length).toBe(1)
  })

  it('maps each pitch through filterPitchForPublic', () => {
    const pitches = [BASE_PITCH, { ...BASE_PITCH, id: '2' }]
    const out = filterPitchesForPublic(pitches)
    expect(out.length).toBe(2)
    expect(out[0].id).toBe('1')
    expect(out[1].id).toBe('2')
  })
})

// ---------------------------------------------------------------------------
// filterUserForPublic
// ---------------------------------------------------------------------------
describe('filterUserForPublic', () => {
  it('returns null for falsy input', () => {
    expect(filterUserForPublic(null)).toBeNull()
    expect(filterUserForPublic(undefined)).toBeNull()
  })

  it('includes safe public fields', () => {
    const out = filterUserForPublic(BASE_USER)!
    expect(out.id).toBe('42')
    expect(out.username).toBe('karlcreator')
    expect(out.company_name).toBe('Karl Studios')
    expect(out.location).toBe('London')
  })

  it('does NOT expose email', () => {
    const out = filterUserForPublic(BASE_USER)!
    expect((out as any).email).toBeUndefined()
  })

  it('does NOT expose password', () => {
    const out = filterUserForPublic(BASE_USER)!
    expect((out as any).password).toBeUndefined()
  })

  it('does NOT expose phone', () => {
    const out = filterUserForPublic(BASE_USER)!
    expect((out as any).phone).toBeUndefined()
  })

  it('truncates bio at 200 chars', () => {
    const longBio = 'word '.repeat(50) // 250 chars
    const out = filterUserForPublic({ ...BASE_USER, bio: longBio })!
    expect(out.bio!.length).toBeLessThanOrEqual(204) // 200 + '...'
    expect(out.bio!.endsWith('...')).toBe(true)
  })

  it('passes through bio shorter than 200 chars unchanged', () => {
    const out = filterUserForPublic(BASE_USER)!
    expect(out.bio).toBe('I make films.')
  })

  it('includes valid website URL', () => {
    const out = filterUserForPublic(BASE_USER)!
    expect(out.website).toBe('https://karlstudios.com')
  })

  it('excludes invalid website URL', () => {
    const out = filterUserForPublic({ ...BASE_USER, website: 'not-a-url' })!
    expect(out.website).toBeUndefined()
  })

  it('excludes missing website', () => {
    const out = filterUserForPublic({ ...BASE_USER, website: undefined })!
    expect(out.website).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// removeSensitiveFields
// ---------------------------------------------------------------------------
describe('removeSensitiveFields', () => {
  it('removes all SENSITIVE_FIELDS from flat object', () => {
    const obj = {
      title: 'Keep me',
      email: 'strip@this.com',
      password: 'secret',
      password_hash: 'hashed',
      stripe_customer_id: 'cus_abc',
      api_key: 'key123',
      session_token: 'tok',
      pitch_deck_url: 'https://s3.example.com/deck.pdf',
    }
    const out = removeSensitiveFields(obj)
    expect(out.title).toBe('Keep me')
    expect(out.email).toBeUndefined()
    expect(out.password).toBeUndefined()
    expect(out.password_hash).toBeUndefined()
    expect(out.stripe_customer_id).toBeUndefined()
    expect(out.api_key).toBeUndefined()
    expect(out.session_token).toBeUndefined()
    expect(out.pitch_deck_url).toBeUndefined()
  })

  it('recursively cleans nested objects', () => {
    const obj = {
      user: { name: 'Karl', email: 'private@x.com', profile: { password: 'shh' } }
    }
    const out = removeSensitiveFields(obj)
    expect(out.user.name).toBe('Karl')
    expect(out.user.email).toBeUndefined()
    expect(out.user.profile.password).toBeUndefined()
  })

  it('handles arrays recursively', () => {
    const arr = [{ email: 'a@b.com', name: 'A' }, { email: 'c@d.com', name: 'B' }]
    const out = removeSensitiveFields(arr)
    expect(out[0].name).toBe('A')
    expect(out[0].email).toBeUndefined()
  })

  it('returns primitives unchanged', () => {
    expect(removeSensitiveFields('string')).toBe('string')
    expect(removeSensitiveFields(42)).toBe(42)
    expect(removeSensitiveFields(null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createPublicErrorResponse
// ---------------------------------------------------------------------------
describe('createPublicErrorResponse', () => {
  it('returns the given status code', () => {
    expect(createPublicErrorResponse('Not found', 404).status).toBe(404)
  })

  it('body has success=false', async () => {
    const body = await createPublicErrorResponse('oops', 500).json() as any
    expect(body.success).toBe(false)
  })

  it('passes through the message', async () => {
    const body = await createPublicErrorResponse('Custom message', 400).json() as any
    expect(body.error).toBe('Custom message')
  })

  it('sets CORS header from origin', () => {
    const res = createPublicErrorResponse('err', 500, 'https://pitchey-5o8.pages.dev')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })

  it('includes timestamp in body', async () => {
    const body = await createPublicErrorResponse('err', 500).json() as any
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ---------------------------------------------------------------------------
// addPublicCacheHeaders
// ---------------------------------------------------------------------------
describe('addPublicCacheHeaders', () => {
  it('adds Cache-Control with public and s-maxage', () => {
    const h = addPublicCacheHeaders({}) as Record<string, string>
    expect(h['Cache-Control']).toContain('public')
    expect(h['Cache-Control']).toContain('s-maxage=600')
  })

  it('adds Vary: Accept-Encoding', () => {
    const h = addPublicCacheHeaders({}) as Record<string, string>
    expect(h['Vary']).toBe('Accept-Encoding')
  })

  it('adds X-Content-Type-Options: nosniff', () => {
    const h = addPublicCacheHeaders({}) as Record<string, string>
    expect(h['X-Content-Type-Options']).toBe('nosniff')
  })

  it('merges with supplied headers', () => {
    const h = addPublicCacheHeaders({ 'X-Custom': 'yes' }) as Record<string, string>
    expect(h['X-Custom']).toBe('yes')
    expect(h['Cache-Control']).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// createPublicResponse
// ---------------------------------------------------------------------------
describe('createPublicResponse', () => {
  it('returns 200 by default', () => {
    expect(createPublicResponse({}).status).toBe(200)
  })

  it('uses custom status', () => {
    expect(createPublicResponse({}, { status: 201 }).status).toBe(201)
  })

  it('body has success=true', async () => {
    const body = await createPublicResponse({ id: 1 }).json() as any
    expect(body.success).toBe(true)
  })

  it('removes sensitive fields from data via removeSensitiveFields', async () => {
    const body = await createPublicResponse({ name: 'Karl', email: 'k@k.com' }).json() as any
    expect(body.data.name).toBe('Karl')
    expect(body.data.email).toBeUndefined()
  })

  it('sets CORS header from origin option', () => {
    const res = createPublicResponse({}, { origin: 'https://pitchey-5o8.pages.dev' })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })

  it('adds ETag header when supplied', () => {
    const res = createPublicResponse({}, { etag: '"abc123"' })
    expect(res.headers.get('ETag')).toBe('"abc123"')
  })

  it('skips public CDN cache headers when cache=false', () => {
    const res = createPublicResponse({}, { cache: false })
    // When cache is false, addPublicCacheHeaders is not called so Cache-Control header is null
    const cc = res.headers.get('Cache-Control')
    // Either null (no header set) or missing the CDN value
    if (cc !== null) {
      expect(cc).not.toContain('s-maxage=600')
    } else {
      expect(cc).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// generateETag
// ---------------------------------------------------------------------------
describe('generateETag', () => {
  it('returns a quoted string', () => {
    const tag = generateETag({ id: 1 })
    expect(tag.startsWith('"')).toBe(true)
    expect(tag.endsWith('"')).toBe(true)
  })

  it('is deterministic for the same data', () => {
    const a = generateETag({ id: 1, title: 'x' })
    const b = generateETag({ id: 1, title: 'x' })
    expect(a).toBe(b)
  })

  it('produces different tags for different data', () => {
    expect(generateETag({ id: 1 })).not.toBe(generateETag({ id: 2 }))
  })

  it('handles empty object', () => {
    expect(() => generateETag({})).not.toThrow()
    expect(generateETag({})).toMatch(/^"[a-z0-9]+"$/)
  })
})
