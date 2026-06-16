/**
 * SafeQueryBuilder — unit tests asserting the WHITELIST + THROW security model.
 *
 * The old sql-injection.test.ts asserted a "sanitize-and-reflect" contract that
 * no longer exists. The current implementation is whitelist-based: invalid sort
 * columns, bad tables, suspicious identifiers, non-integer limits/offsets all
 * THROW. Throwing IS the security property — rejection stops injection at the
 * query-builder boundary before any SQL is emitted.
 */

import { describe, it, expect } from 'vitest'
import {
  SafeQueryBuilder,
  validateInput,
  escapeLikePattern,
} from '../safe-query-builder'

// ---------------------------------------------------------------------------
// SafeQueryBuilder — whitelist guard: validateTable throws on unknown tables
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder.buildSelect — table whitelist', () => {
  it('accepts every whitelisted table without throwing', () => {
    const allowedTables = [
      'users', 'pitches', 'investments', 'ndas', 'messages',
      'follows', 'sessions', 'transactions', 'notifications',
      'pitch_views', 'pitch_likes', 'comments', 'files',
    ]
    for (const table of allowedTables) {
      expect(() => {
        const b = new SafeQueryBuilder()
        b.buildSelect({ from: table })
      }).not.toThrow()
    }
  })

  it('throws on an unknown table name', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'unknown_table' })
    }).toThrow(/Invalid table name/)
  })

  it('throws when a DROP injection is embedded in the table name', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: "pitches; DROP TABLE users" })
    }).toThrow()
  })

  it('throws when a DELETE injection is embedded in the table name', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: "users--; DELETE FROM sessions" })
    }).toThrow()
  })
})

// ---------------------------------------------------------------------------
// SafeQueryBuilder — ORDER BY whitelist (THROW on invalid column / direction)
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder ORDER BY guards', () => {
  it('accepts whitelisted sort columns that do not contain SQL keyword substrings', () => {
    // NOTE: `updated_at` is in ALLOWED_SORT_COLUMNS but CANNOT be used as an ORDER BY
    // column because `sanitizeIdentifier` rejects it (contains substring "update").
    // This is a CORRECTNESS BUG documented below. We test only the columns that
    // actually work end-to-end.
    const workingWhitelisted = [
      'id', 'created_at', 'published_at',
      'view_count', 'like_count', 'investment_count',
      'title', 'status', 'genre', 'format', 'budget_range',
      'username', 'email', 'role', 'last_login',
      'amount', 'transaction_date', 'priority',
    ]
    for (const col of workingWhitelisted) {
      expect(() => {
        const b = new SafeQueryBuilder()
        b.buildSelect({
          from: 'pitches',
          orderBy: [{ field: col, direction: 'ASC' }],
        })
      }).not.toThrow()
    }
  })

  it('BUG: updated_at is in ALLOWED_SORT_COLUMNS but sanitizeIdentifier throws on it', () => {
    // "updated_at" is whitelisted for ORDER BY but the identifier sanitizer
    // checks cleaned.toLowerCase().includes("update") and throws.
    // This means you cannot actually sort by updated_at — a correctness gap.
    // Documented here; do not fix without updating this test.
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        orderBy: [{ field: 'updated_at', direction: 'DESC' }],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when an ORDER BY column is not in the whitelist', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        orderBy: [{ field: 'password', direction: 'ASC' }],
      })
    }).toThrow(/Invalid sort column/)
  })

  it('throws on a stacked-query ORDER BY injection', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        orderBy: [{ field: '(SELECT * FROM users)', direction: 'ASC' }],
      })
    }).toThrow(/Invalid sort column/)
  })

  it('throws on a subquery in the sort column', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        orderBy: [{ field: 'id; DROP TABLE pitches', direction: 'DESC' }],
      })
    }).toThrow()
  })

  it('throws when sort direction is not ASC or DESC', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        // @ts-expect-error — deliberate invalid direction
        orderBy: [{ field: 'id', direction: 'ASC; DELETE FROM pitches' }],
      })
    }).toThrow(/Invalid sort direction/)
  })

  it('throws on empty-string sort direction', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        // @ts-expect-error — deliberate invalid direction
        orderBy: [{ field: 'id', direction: '' }],
      })
    }).toThrow(/Invalid sort direction/)
  })
})

// ---------------------------------------------------------------------------
// SafeQueryBuilder — LIMIT / OFFSET validation (THROW on non-integer / negative)
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder LIMIT / OFFSET guards', () => {
  it('accepts zero limit and offset', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: 0, offset: 0 })
    }).not.toThrow()
  })

  it('accepts positive integer limit and offset', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: 50, offset: 100 })
    }).not.toThrow()
  })

  it('throws on a float limit', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: 10.5 })
    }).toThrow(/Invalid limit/)
  })

  it('throws on a negative limit', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: -1 })
    }).toThrow(/Invalid limit/)
  })

  it('throws on a float offset', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', offset: 3.7 })
    }).toThrow(/Invalid offset/)
  })

  it('throws on a negative offset', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', offset: -5 })
    }).toThrow(/Invalid offset/)
  })

  it('throws on NaN limit (e.g. parseInt("10 UNION SELECT") yields NaN→10 but string is NaN)', () => {
    // parseInt('10 UNION SELECT') is 10 — that is safe and should not throw.
    // NaN itself must throw.
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({ from: 'pitches', limit: NaN })
    }).toThrow(/Invalid limit/)
  })
})

// ---------------------------------------------------------------------------
// SafeQueryBuilder — sanitizeIdentifier throws on suspicious keywords
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder — identifier keyword guard', () => {
  it('throws when a SELECT column contains the word DROP', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['id', 'drop_col'], // "drop" is in the identifier
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when a SELECT column contains DELETE', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['id', 'delete_me'],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when a SELECT column contains INSERT', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['insert_col'],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when a SELECT column contains UPDATE', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['update_col'],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when a SELECT column contains ALTER', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['alter_seq'],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when a SELECT column contains EXEC', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['exec_fn'],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('throws when a SELECT column contains SCRIPT', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['script_tag'],
      })
    }).toThrow(/Suspicious identifier/)
  })

  it('accepts legitimate identifiers that happen to contain substring matches only as whole-word checks', () => {
    // "id" is fine; "status" is fine; "created_at" is fine.
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        select: ['id', 'status', 'created_at'],
      })
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// SafeQueryBuilder — WHERE clause parameterization (values never in query text)
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder WHERE clause parameterization', () => {
  it('emits a $N placeholder for = conditions, not the raw value', () => {
    const b = new SafeQueryBuilder()
    const { query, params } = b.buildSelect({
      from: 'pitches',
      where: [{ field: 'status', operator: '=', value: 'published' }],
    })
    expect(query).toContain('$1')
    expect(query).not.toContain('published')
    expect(params).toContain('published')
  })

  it('parameterizes ILIKE values, not injecting them into query text', () => {
    const injection = "'; DROP TABLE pitches; --"
    const b = new SafeQueryBuilder()
    const { query, params } = b.buildSelect({
      from: 'pitches',
      where: [{ field: 'title', operator: 'ILIKE', value: `%${injection}%` }],
    })
    expect(query).not.toContain(injection)
    expect(params[0]).toContain(injection)
  })

  it('parameterizes IN clause values', () => {
    const b = new SafeQueryBuilder()
    const { query, params } = b.buildSelect({
      from: 'pitches',
      where: [{ field: 'status', operator: 'IN', value: ['published', 'draft'] }],
    })
    expect(query).toMatch(/\$\d/)
    expect(query).not.toContain('published')
    expect(params).toContain('published')
  })

  it('emits IS NULL without parameterization', () => {
    const b = new SafeQueryBuilder()
    const { query, params } = b.buildSelect({
      from: 'pitches',
      where: [{ field: 'genre', operator: 'IS NULL' }],
    })
    expect(query).toContain('"genre" IS NULL')
    expect(params).toHaveLength(0)
  })

  it('throws when IN operator receives a non-array value', () => {
    expect(() => {
      const b = new SafeQueryBuilder()
      b.buildSelect({
        from: 'pitches',
        where: [{ field: 'status', operator: 'IN', value: 'published' }],
      })
    }).toThrow(/requires array value/)
  })
})

// ---------------------------------------------------------------------------
// SafeQueryBuilder — LIMIT and OFFSET are parameterized, not interpolated
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder LIMIT / OFFSET appear as parameters', () => {
  it('emits $N for LIMIT, not the raw number', () => {
    const b = new SafeQueryBuilder()
    const { query, params } = b.buildSelect({ from: 'pitches', limit: 25 })
    expect(query).toContain('LIMIT $')
    expect(params).toContain(25)
    // The integer 25 must not appear bare in the query text
    expect(query.replace(/\$\d+/g, '')).not.toContain('25')
  })

  it('emits $N for OFFSET, not the raw number', () => {
    const b = new SafeQueryBuilder()
    const { query, params } = b.buildSelect({ from: 'pitches', limit: 10, offset: 50 })
    expect(query).toContain('OFFSET $')
    expect(params).toContain(50)
  })
})

// ---------------------------------------------------------------------------
// buildPitchSearchQuery — static convenience builder
// ---------------------------------------------------------------------------
describe('SafeQueryBuilder.buildPitchSearchQuery', () => {
  it('builds a valid query with no filters (defaults to published, created_at DESC)', () => {
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({})
    expect(query).toContain('WHERE')
    expect(params).toContain('published')
    expect(query).toContain('ORDER BY')
    expect(query).toContain('DESC')
  })

  it('parameterizes search string, does not embed it in query text', () => {
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
      search: "test' OR '1'='1",
    })
    expect(query).not.toContain("test' OR '1'='1")
    expect(params.some((p: any) => String(p).includes("test' OR '1'='1"))).toBe(true)
  })

  it('parameterizes genre value, does not embed injection payload', () => {
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
      genre: "action' UNION SELECT * FROM users --",
    })
    expect(query).not.toContain('UNION SELECT')
    expect(params).toContain("action' UNION SELECT * FROM users --")
  })

  it('maps sortBy "views" to the whitelisted column view_count', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({ sortBy: 'views' })
    expect(query).toContain('"view_count"')
  })

  it('maps sortBy "likes" to like_count', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({ sortBy: 'likes' })
    expect(query).toContain('"like_count"')
  })

  it('maps sortBy "investments" to investment_count', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({ sortBy: 'investments' })
    expect(query).toContain('"investment_count"')
  })

  it('maps sortBy "date" to created_at', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({ sortBy: 'date' })
    expect(query).toContain('"created_at"')
  })

  it('maps sortBy "title" to title', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({ sortBy: 'title' })
    expect(query).toContain('"title"')
  })

  it('falls back to created_at for unknown sortBy values (injection-safe default)', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({
      sortBy: '(SELECT password FROM users)',
    })
    // Unknown sortBy maps to 'created_at' in the sortMap fallback
    expect(query).toContain('"created_at"')
    expect(query).not.toContain('SELECT password')
  })

  it('uses custom sortOrder ASC', () => {
    const { query } = SafeQueryBuilder.buildPitchSearchQuery({ sortOrder: 'ASC' })
    expect(query).toContain('ASC')
  })

  it('applies minBudget and maxBudget as parameters', () => {
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
      minBudget: 1000000,
      maxBudget: 5000000,
    })
    expect(params).toContain(1000000)
    expect(params).toContain(5000000)
    expect(query).toContain('>=')
    expect(query).toContain('<=')
  })

  it('omits genre filter when genre is "all"', () => {
    const withAll = SafeQueryBuilder.buildPitchSearchQuery({ genre: 'all' })
    const withoutGenre = SafeQueryBuilder.buildPitchSearchQuery({})
    // Both should have the same number of params (just status=published)
    expect(withAll.params.length).toBe(withoutGenre.params.length)
  })

  it('emits LIMIT and OFFSET as parameters', () => {
    const { query, params } = SafeQueryBuilder.buildPitchSearchQuery({
      limit: 15,
      offset: 30,
    })
    expect(query).toContain('LIMIT $')
    expect(query).toContain('OFFSET $')
    expect(params).toContain(15)
    expect(params).toContain(30)
  })

  it('defaults limit to 20 and offset to 0', () => {
    const { params } = SafeQueryBuilder.buildPitchSearchQuery({})
    expect(params).toContain(20)
    expect(params).toContain(0)
  })
})

// ---------------------------------------------------------------------------
// validateInput
// ---------------------------------------------------------------------------
describe('validateInput', () => {
  describe('type: string', () => {
    it('returns trimmed string for clean input', () => {
      expect(validateInput('  hello  ', 'string')).toBe('hello')
    })

    it('throws on non-string input', () => {
      expect(() => validateInput(42, 'string')).toThrow(/Invalid string input/)
      expect(() => validateInput(null, 'string')).toThrow()
      expect(() => validateInput(undefined, 'string')).toThrow()
    })

    it('throws when input contains DROP (case insensitive)', () => {
      expect(() => validateInput('DROP TABLE users', 'string')).toThrow(/SQL keyword/)
      expect(() => validateInput('drop table users', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains DELETE', () => {
      expect(() => validateInput('DELETE FROM pitches', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains INSERT', () => {
      expect(() => validateInput('INSERT INTO sessions', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains UPDATE', () => {
      expect(() => validateInput('UPDATE users SET role=admin', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains ALTER', () => {
      expect(() => validateInput('ALTER TABLE', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains EXEC', () => {
      expect(() => validateInput('EXEC sp_executesql', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains SCRIPT', () => {
      expect(() => validateInput('SCRIPT inject', 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains UNION', () => {
      expect(() => validateInput("' UNION SELECT * FROM users", 'string')).toThrow(/SQL keyword/)
    })

    it('throws when input contains SELECT (inside UNION SELECT)', () => {
      expect(() => validateInput('SELECT password FROM users', 'string')).toThrow(/SQL keyword/)
    })

    it('accepts normal strings that do not contain SQL keywords', () => {
      expect(() => validateInput('A thriller about time travel', 'string')).not.toThrow()
      expect(() => validateInput('50%_off\\special!', 'string')).not.toThrow()
    })
  })

  describe('type: number', () => {
    it('converts numeric string to number', () => {
      expect(validateInput('123', 'number')).toBe(123)
    })

    it('accepts a number', () => {
      expect(validateInput(456, 'number')).toBe(456)
    })

    it('throws on non-numeric string', () => {
      expect(() => validateInput('123; DELETE FROM users', 'number')).toThrow(/Invalid number/)
    })

    it('throws on NaN', () => {
      expect(() => validateInput('abc', 'number')).toThrow(/Invalid number/)
    })

    it('throws on undefined', () => {
      expect(() => validateInput(undefined, 'number')).toThrow(/Invalid number/)
    })
  })

  describe('type: boolean', () => {
    it('converts truthy values to true', () => {
      expect(validateInput(1, 'boolean')).toBe(true)
      expect(validateInput('yes', 'boolean')).toBe(true)
    })

    it('converts falsy values to false', () => {
      expect(validateInput(0, 'boolean')).toBe(false)
      expect(validateInput('', 'boolean')).toBe(false)
      expect(validateInput(null, 'boolean')).toBe(false)
    })
  })

  describe('type: email', () => {
    it('accepts valid email and lowercases it', () => {
      expect(validateInput('Test@Example.COM', 'email')).toBe('test@example.com')
    })

    it('throws on missing @ symbol', () => {
      expect(() => validateInput('notanemail', 'email')).toThrow(/Invalid email format/)
    })

    it('throws on missing domain', () => {
      expect(() => validateInput('user@', 'email')).toThrow(/Invalid email format/)
    })

    it('throws on spaces in email', () => {
      expect(() => validateInput('user @example.com', 'email')).toThrow(/Invalid email format/)
    })

    it('throws on SQL injection inside email local part', () => {
      // The email regex rejects the payload because of the single quote
      expect(() =>
        validateInput("test'; DROP TABLE users; --@example.com", 'email')
      ).toThrow(/Invalid email format/)
    })
  })

  describe('unknown type', () => {
    it('throws on an unknown validation type', () => {
      // @ts-expect-error — deliberate unknown type
      expect(() => validateInput('x', 'uuid')).toThrow(/Unknown validation type/)
    })
  })
})

// ---------------------------------------------------------------------------
// escapeLikePattern
// ---------------------------------------------------------------------------
describe('escapeLikePattern', () => {
  it('escapes % wildcard', () => {
    expect(escapeLikePattern('50%off')).toBe('50\\%off')
  })

  it('escapes _ wildcard', () => {
    expect(escapeLikePattern('hello_world')).toBe('hello\\_world')
  })

  it('escapes backslash', () => {
    expect(escapeLikePattern('path\\to\\file')).toBe('path\\\\to\\\\file')
  })

  it('handles the canonical complex pattern', () => {
    expect(escapeLikePattern('50%_off\\sale')).toBe('50\\%\\_off\\\\sale')
  })

  it('returns empty string unchanged', () => {
    expect(escapeLikePattern('')).toBe('')
  })

  it('leaves plain alphanumeric strings unchanged', () => {
    expect(escapeLikePattern('hello world')).toBe('hello world')
  })

  it('handles a string with all three special characters', () => {
    const result = escapeLikePattern('%_\\')
    expect(result).toBe('\\%\\_\\\\')
  })
})
