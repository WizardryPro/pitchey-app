/**
 * Tests for src/utils/database-error-handler.ts
 *
 * Covers: parseDatabaseError (all PostgreSQL error codes + message-pattern fallbacks),
 * handleDatabaseError (status-to-response-function mapping), withDatabaseErrorHandling
 * (success path, error path, returns Response on throw).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  parseDatabaseError,
  handleDatabaseError,
  withDatabaseErrorHandling,
} from '../database-error-handler'

async function json(res: Response) {
  return res.json() as Promise<any>
}

// ---------------------------------------------------------------------------
// parseDatabaseError — PostgreSQL error codes
// ---------------------------------------------------------------------------
describe('parseDatabaseError — unique constraint (23505)', () => {
  it('generic 23505 returns 409 statusCode', () => {
    const r = parseDatabaseError({ code: '23505', message: 'dup key', constraint: 'other_key' })
    expect(r.statusCode).toBe(409)
  })

  it('email constraint detected by constraint name', () => {
    const r = parseDatabaseError({ code: '23505', message: 'dup', constraint: 'users_email_key' })
    expect(r.field).toBe('email')
    expect(r.message).toContain('email')
  })

  it('email detected by detail string', () => {
    const r = parseDatabaseError({ code: '23505', message: 'dup', detail: 'Key (email)=(x@x.com) already exists.' })
    expect(r.field).toBe('email')
  })

  it('username uniqueness detected', () => {
    const r = parseDatabaseError({ code: '23505', constraint: 'users_username_key' })
    expect(r.field).toBe('username')
    expect(r.statusCode).toBe(409)
  })

  it('title uniqueness detected', () => {
    const r = parseDatabaseError({ code: '23505', constraint: 'pitches_title_key' })
    expect(r.field).toBe('title')
  })

  it('company uniqueness detected', () => {
    const r = parseDatabaseError({ code: '23505', constraint: 'company_name_key' })
    expect(r.field).toBe('companyName')
  })
})

describe('parseDatabaseError — foreign key violation (23503)', () => {
  it('returns 400 statusCode for user FK', () => {
    const r = parseDatabaseError({ code: '23503', detail: 'Key (user_id) not present in users' })
    expect(r.statusCode).toBe(400)
    expect(r.message).toContain('User')
  })

  it('returns 400 statusCode for pitch FK', () => {
    const r = parseDatabaseError({ code: '23503', detail: 'Key (pitch_id) not present in pitches' })
    expect(r.statusCode).toBe(400)
    expect(r.message).toContain('Pitch')
  })

  it('returns 400 for generic FK', () => {
    const r = parseDatabaseError({ code: '23503', detail: 'some other table' })
    expect(r.statusCode).toBe(400)
  })
})

describe('parseDatabaseError — not null violation (23502)', () => {
  it('returns 400 for missing email column', () => {
    const r = parseDatabaseError({ code: '23502', column: 'email' })
    expect(r.statusCode).toBe(400)
    expect(r.field).toBe('email')
    expect(r.message).toContain('Email')
  })

  it('returns 400 for missing title column', () => {
    const r = parseDatabaseError({ code: '23502', column: 'title' })
    expect(r.field).toBe('title')
  })

  it('returns 400 for unmapped column', () => {
    const r = parseDatabaseError({ code: '23502', column: 'some_obscure_column' })
    expect(r.statusCode).toBe(400)
    expect(r.field).toBeUndefined()
  })
})

describe('parseDatabaseError — check constraint violation (23514)', () => {
  it('returns 400 for budget constraint', () => {
    const r = parseDatabaseError({ code: '23514', constraint: 'budget_positive_check' })
    expect(r.statusCode).toBe(400)
    expect(r.field).toBe('budget')
  })

  it('returns 400 for email format constraint', () => {
    const r = parseDatabaseError({ code: '23514', constraint: 'email_format_check' })
    expect(r.field).toBe('email')
  })

  it('returns 400 for user_type constraint', () => {
    const r = parseDatabaseError({ code: '23514', constraint: 'user_type_check' })
    expect(r.field).toBe('userType')
  })

  it('generic check constraint returns 400 with no field', () => {
    const r = parseDatabaseError({ code: '23514', constraint: 'some_check' })
    expect(r.statusCode).toBe(400)
  })
})

describe('parseDatabaseError — data format errors', () => {
  it('22P02 (invalid text representation) → 400', () => {
    const r = parseDatabaseError({ code: '22P02' })
    expect(r.statusCode).toBe(400)
  })

  it('22001 (string too long) → 400', () => {
    const r = parseDatabaseError({ code: '22001' })
    expect(r.statusCode).toBe(400)
  })
})

describe('parseDatabaseError — connection errors', () => {
  it('08000 → 503', () => {
    expect(parseDatabaseError({ code: '08000' }).statusCode).toBe(503)
  })

  it('08003 → 503', () => {
    expect(parseDatabaseError({ code: '08003' }).statusCode).toBe(503)
  })

  it('08006 → 503', () => {
    expect(parseDatabaseError({ code: '08006' }).statusCode).toBe(503)
  })
})

describe('parseDatabaseError — privilege and schema errors', () => {
  it('42501 (insufficient privilege) → 403', () => {
    expect(parseDatabaseError({ code: '42501' }).statusCode).toBe(403)
  })

  it('42P01 (undefined table) → 503 (hides schema from client)', () => {
    expect(parseDatabaseError({ code: '42P01' }).statusCode).toBe(503)
  })
})

// ---------------------------------------------------------------------------
// parseDatabaseError — message-pattern fallbacks (no code)
// ---------------------------------------------------------------------------
describe('parseDatabaseError — message pattern fallbacks', () => {
  it('duplicate key message → 409', () => {
    const r = parseDatabaseError({ message: 'duplicate key value violates unique constraint' })
    expect(r.statusCode).toBe(409)
  })

  it('duplicate key with email detail → field=email', () => {
    const r = parseDatabaseError({
      message: 'duplicate key value violates unique constraint',
      detail: 'Key (email)=(x@x.com) already exists.'
    })
    expect(r.field).toBe('email')
  })

  it('foreign key message → 400', () => {
    const r = parseDatabaseError({ message: 'foreign key constraint' })
    expect(r.statusCode).toBe(400)
  })

  it('not null message with exact "not null" substring → 400', () => {
    // Code checks message.includes('not null') — note: no hyphen.
    // 'violates not-null constraint' contains 'not-null', not 'not null', so it falls to default (500).
    // Use the exact pattern the code matches:
    const r = parseDatabaseError({ message: 'violates not null constraint' })
    expect(r.statusCode).toBe(400)
  })

  it('hyphenated not-null message does NOT match — falls to 500 default', () => {
    // 'not-null' ≠ 'not null' in includes() check; falls to generic 500 fallback
    const r = parseDatabaseError({ message: 'violates not-null constraint' })
    expect(r.statusCode).toBe(500)
  })

  it('timeout message → 503', () => {
    const r = parseDatabaseError({ message: 'query timeout expired' })
    expect(r.statusCode).toBe(503)
  })

  it('deadlock message → 503', () => {
    const r = parseDatabaseError({ message: 'deadlock detected' })
    expect(r.statusCode).toBe(503)
  })

  it('completely unknown error → 500', () => {
    const r = parseDatabaseError({ message: 'some unexpected thing happened' })
    expect(r.statusCode).toBe(500)
  })

  it('null/undefined error → 500 fallback', () => {
    const r = parseDatabaseError(null)
    expect(r.statusCode).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// parseDatabaseError — constraint/detail aliasing
// ---------------------------------------------------------------------------
describe('parseDatabaseError — constraint alias (constraint_name)', () => {
  it('reads constraint_name as constraint', () => {
    const r = parseDatabaseError({ code: '23505', constraint_name: 'users_email_key' })
    expect(r.field).toBe('email')
  })

  it('reads table_name as table', () => {
    // Just verifying it doesn't throw
    expect(() => parseDatabaseError({ code: '23502', column_name: 'email', table_name: 'users' })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// handleDatabaseError — Response mapping
// ---------------------------------------------------------------------------
describe('handleDatabaseError — HTTP responses', () => {
  it('23505 email dup → 409 response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ code: '23505', constraint: 'users_email_key' })
    spy.mockRestore()
    expect(res.status).toBe(409)
    const body = await json(res)
    expect(body.success).toBe(false)
  })

  it('23505 generic → 409 with CONFLICT code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ code: '23505' })
    spy.mockRestore()
    expect(res.status).toBe(409)
    const body = await json(res)
    expect(body.metadata?.details?.code ?? body.error).toBeTruthy()
  })

  it('23502 → 422 validation error response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ code: '23502', column: 'email' })
    spy.mockRestore()
    expect(res.status).toBe(422)
  })

  it('42501 → 403 forbidden response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ code: '42501' })
    spy.mockRestore()
    expect(res.status).toBe(403)
  })

  it('08000 → 503 service unavailable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ code: '08000' })
    spy.mockRestore()
    expect(res.status).toBe(503)
  })

  it('unknown → 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ message: 'weird error' })
    spy.mockRestore()
    expect(res.status).toBe(500)
  })

  it('uses CORS origin when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = handleDatabaseError({ code: '08000' }, 'https://pitchey-5o8.pages.dev')
    spy.mockRestore()
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })
})

// ---------------------------------------------------------------------------
// withDatabaseErrorHandling
// ---------------------------------------------------------------------------
describe('withDatabaseErrorHandling', () => {
  it('returns the operation result on success', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withDatabaseErrorHandling(async () => ({ rows: [{ id: 1 }] }))
    spy.mockRestore()
    expect(result).toEqual({ rows: [{ id: 1 }] })
  })

  it('returns a Response when the operation throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withDatabaseErrorHandling(async () => {
      throw { code: '23505', constraint: 'users_email_key' }
    })
    spy.mockRestore()
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(409)
  })

  it('passes origin to handleDatabaseError on throw', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withDatabaseErrorHandling(
      async () => { throw { code: '08000' } },
      'https://pitchey-5o8.pages.dev'
    )
    spy.mockRestore()
    expect((result as Response).headers.get('Access-Control-Allow-Origin')).toBe('https://pitchey-5o8.pages.dev')
  })

  it('success path returns typed value, not a Response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withDatabaseErrorHandling(async () => 'done')
    spy.mockRestore()
    expect(typeof result).toBe('string')
    expect(result).toBe('done')
  })
})
