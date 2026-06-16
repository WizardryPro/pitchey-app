/**
 * SQL Injection Security Tests — REWRITTEN 2026-06-16
 *
 * The original test asserted the OLD sanitize-and-reflect contract (e.g.
 * "buildPitchSearchQuery should not throw on DROP payload and should reflect
 * the payload in params"). That contract no longer matches the implementation.
 *
 * CURRENT MODEL (SafeQueryBuilder, src/utils/safe-query-builder.ts):
 *   • WHITELIST-based, not sanitize-based
 *   • Invalid sort columns, invalid directions, non-integer limits, non-whitelisted
 *     table names, and suspicious keywords in identifiers ALL THROW at the builder
 *     level — before any SQL is emitted.
 *   • User-supplied VALUES (search text, genre, format, budget) are PARAMETERIZED
 *     ($N placeholders); they are never concatenated into the SQL string.
 *
 * REJECTION IS THE SECURITY PROPERTY. These tests assert that malicious inputs
 * are either thrown away or parameterized — never interpolated into query text.
 */

import { describe, it, expect } from 'vitest'
import { SafeQueryBuilder, validateInput, escapeLikePattern } from '../utils/safe-query-builder'

// ---------------------------------------------------------------------------
// ORDER BY injection — must THROW (whitelist enforced)
// ---------------------------------------------------------------------------
describe('ORDER BY injection — whitelist throws', () => {
  it('throws on ORDER BY subquery injection via buildSelect', () => {
    // An attacker can only pass sortBy to buildPitchSearchQuery (which maps to a
    // safe column), but if buildSelect is called directly with a subquery column:
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        orderBy: [{ field: '(SELECT password FROM users)', direction: 'ASC' }],
      })
    }).toThrow()
  })

  it('buildPitchSearchQuery maps unknown sortBy to safe default (created_at)', () => {
    // An attacker passing "(SELECT...)" as sortBy gets created_at, not their payload
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({
      sortBy: '(SELECT * FROM users)',
    })
    expect(query).toContain('"created_at"')
    // The injection keyword should not appear as an ORDER BY column in the query
    expect(query).not.toContain('(SELECT')
    expect(query).not.toContain('FROM users')
  })

  it('buildSelect throws on invalid ORDER BY direction (stacked-query attack)', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        // @ts-expect-error — deliberate invalid direction
        orderBy: [{ field: 'id', direction: 'ASC; DELETE FROM pitches' }],
      })
    }).toThrow(/Invalid sort direction/)
  })

  it('buildSelect throws on ORDER BY with non-whitelisted column', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        orderBy: [{ field: 'secret_column', direction: 'DESC' }],
      })
    }).toThrow(/Invalid sort column/)
  })
})

// ---------------------------------------------------------------------------
// LIMIT / OFFSET injection — must THROW (integer-only enforcement)
// ---------------------------------------------------------------------------
describe('LIMIT / OFFSET injection — must throw on non-integer', () => {
  it('throws on LIMIT injection string (parsed to NaN)', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: NaN })
    }).toThrow(/Invalid limit/)
  })

  it('throws on negative LIMIT', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: -1 })
    }).toThrow(/Invalid limit/)
  })

  it('throws on float LIMIT', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: 10.9 })
    }).toThrow(/Invalid limit/)
  })

  it('throws on negative OFFSET', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', offset: -1 })
    }).toThrow(/Invalid offset/)
  })

  it('buildPitchSearchQuery parseInt("10 UNION SELECT...") → 10, which is valid', () => {
    // parseInt coerces "10 UNION SELECT" → 10; the builder receives 10 (integer)
    // and emits it as a parameterized value. The attack payload is discarded by
    // the calling layer before the builder is invoked.
    const limit = parseInt('10 UNION SELECT * FROM sessions', 10)
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({ limit })
    expect(params).toContain(10)
    expect(query).not.toContain('UNION SELECT')
  })
})

// ---------------------------------------------------------------------------
// Table name injection — must THROW (whitelist enforced)
// ---------------------------------------------------------------------------
describe('Table name injection — whitelist throws', () => {
  it('throws on an arbitrary table name', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'evil_table' })
    }).toThrow(/Invalid table name/)
  })

  it('throws when DROP is embedded in the table name', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches; DROP TABLE users' })
    }).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Identifier injection — suspicious keywords in column names THROW
// ---------------------------------------------------------------------------
describe('Identifier injection — suspicious keywords throw', () => {
  const dangerousIdentifiers = [
    'drop_all',
    'delete_rows',
    'insert_data',
    'update_records',
    'alter_schema',
    'exec_fn',
    'script_tag',
  ]

  for (const id of dangerousIdentifiers) {
    it(`throws when SELECT column contains suspicious keyword: ${id}`, () => {
      expect(() => {
        const b = new SafeQueryBuilder()
        b.buildSelect({ from: 'pitches', select: [id] })
      }).toThrow(/Suspicious identifier/)
    })
  }
})

// ---------------------------------------------------------------------------
// VALUE injection — SQL payloads in values are PARAMETERIZED, not interpolated
// ---------------------------------------------------------------------------
describe('Value parameterization — injection payloads go into params, not query text', () => {
  const injectionPayloads = [
    "'; DROP TABLE users; --",
    "' OR 1=1--",
    "' OR 1=1#",
    "' OR 1=1/*",
    "'; WAITFOR DELAY '00:00:10'--",
    "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
    "' AND 1=CONVERT(int, (SELECT TOP 1 name FROM sysobjects))--",
    "SLEEP(5)/*' or SLEEP(5) or '\" or SLEEP(5) or \"*/",
    "admin'--",
    // encoded/polyglot
    "\\x27\\x20\\x4F\\x52",
    "%27%20OR%201%3D1",
    "&#39; OR &#49;=&#49;",
    // Long payload
    "a".repeat(5000) + "'; DROP TABLE pitches; --",
    // Unicode
    "🎬 电影' OR '1'='1",
  ]

  for (const payload of injectionPayloads) {
    it(`parameterizes search payload: ${payload.slice(0, 40)}...`, () => {
      const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
        search: payload,
      })
      // The raw payload must NOT appear in query text
      expect(query).not.toContain(payload)
      // The payload must appear somewhere in the params (wrapped with %)
      const paramStr = params.map((p: any) => String(p)).join('|')
      expect(paramStr).toContain(payload)
    })
  }

  it('parameterizes genre UNION injection payload', () => {
    const payload = "action' UNION SELECT * FROM users --"
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({ genre: payload })
    expect(query).not.toContain(payload)
    expect(params).toContain(payload)
  })

  it('parameterizes boolean-based blind injection in search', () => {
    const payload = "test' OR '1'='1"
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({ search: payload })
    expect(query).not.toContain(payload)
    expect(params.some((p: any) => String(p).includes(payload))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateInput — SQL keywords in string type throw
// ---------------------------------------------------------------------------
describe('validateInput — SQL keyword rejection', () => {
  const sqlKeywords = [
    'DROP TABLE users',
    'DELETE FROM pitches',
    'UPDATE users SET role="admin"',
    'INSERT INTO sessions',
    'ALTER TABLE',
    'EXEC sp_executesql',
    'SCRIPT',
    'UNION SELECT * FROM users',
    'SELECT password FROM users',
  ]

  for (const kw of sqlKeywords) {
    it(`throws on input containing: ${kw}`, () => {
      expect(() => validateInput(kw, 'string')).toThrow(/SQL keyword/)
    })
  }

  it('rejects email-shaped SQL injection (invalid email format)', () => {
    expect(() =>
      validateInput("test'; DROP TABLE users; --@example.com", 'email')
    ).toThrow(/Invalid email format/)
  })

  it('converts numeric string to number safely', () => {
    expect(validateInput('123', 'number')).toBe(123)
  })

  it('throws on mixed number+SQL string', () => {
    expect(() => validateInput('123; DELETE FROM users', 'number')).toThrow(/Invalid number/)
  })

  it('throws on null string input', () => {
    expect(() => validateInput(null, 'string')).toThrow()
  })

  it('throws on undefined number input', () => {
    expect(() => validateInput(undefined, 'number')).toThrow(/Invalid number/)
  })
})

// ---------------------------------------------------------------------------
// escapeLikePattern — correctly escapes LIKE metacharacters
// ---------------------------------------------------------------------------
describe('escapeLikePattern', () => {
  it('escapes % wildcard', () => {
    expect(escapeLikePattern('test%value')).toBe('test\\%value')
  })

  it('escapes _ wildcard', () => {
    expect(escapeLikePattern('test_value')).toBe('test\\_value')
  })

  it('escapes backslash', () => {
    expect(escapeLikePattern('test\\value')).toBe('test\\\\value')
  })

  it('handles the canonical complex pattern', () => {
    expect(escapeLikePattern('50%_off\\sale')).toBe('50\\%\\_off\\\\sale')
  })
})

// ---------------------------------------------------------------------------
// Integration scenario — real-world form data with injection attempts
// ---------------------------------------------------------------------------
describe('Real-world form injection scenario', () => {
  it('safely handles form data with DROP TABLE in search', () => {
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
      search: "Robert'); DROP TABLE users; --",
      genre: 'action',
      minBudget: 1000000,
      maxBudget: 5000000,
      sortBy: 'views',
      sortOrder: 'DESC',
    })
    expect(query).not.toContain('DROP TABLE')
    expect(query).not.toContain('DELETE FROM')
    expect(params.some((p: any) => String(p).includes('DROP TABLE'))).toBe(true)
  })

  it('safely handles API params where sortBy is an injection payload (defaults to created_at)', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({
      sortBy: "(SELECT password FROM users)",
    })
    expect(query).not.toContain('SELECT password')
    expect(query).toContain('"created_at"')
  })

  it('safely handles API params where limit is parsed from a mixed string', () => {
    // parseInt("10 UNION SELECT * FROM sessions") = 10 — valid integer, safe
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
      limit: parseInt("10 UNION SELECT * FROM sessions", 10),
      // offset: parseInt("-1") = -1 which THROWS (negative not allowed).
      // The calling layer must sanitize offset before passing it; default to 0.
      offset: 0,
    })
    expect(params).toContain(10)
    expect(params).toContain(0)
    expect(query).not.toContain('UNION SELECT')
  })

  it('throws when offset from API params is negative (e.g. parseInt("-1"))', () => {
    // offset=-1 is not silently coerced to 0 — the builder throws.
    // This is correct security behavior: callers must validate before passing.
    expect(() => {
      SafeQueryBuilder.buildPitchSearchQuery({
        limit: 10,
        offset: parseInt("-1", 10),
      })
    }).toThrow(/Invalid offset/)
  })
})
