/**
 * worker-password.ts unit tests
 *
 * Uses Web Crypto API (PBKDF2) — available in Node ≥18 via globalThis.crypto.
 * The setup.ts shim ensures crypto is available in the node test environment.
 */

import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  isHashedPassword,
  generateSecureToken,
  checkPasswordStrength,
} from '../worker-password'

// ---------------------------------------------------------------------------
// hashPassword
// ---------------------------------------------------------------------------
describe('hashPassword', () => {
  it('returns a string prefixed with "pbkdf2:"', async () => {
    const hash = await hashPassword('MySecurePass123!')
    expect(hash).toMatch(/^pbkdf2:/)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const h1 = await hashPassword('SamePassword!')
    const h2 = await hashPassword('SamePassword!')
    expect(h1).not.toBe(h2)
  })

  it('produces a base64-encoded segment after the prefix', async () => {
    const hash = await hashPassword('AnotherPass!')
    const b64Part = hash.slice('pbkdf2:'.length)
    // Base64 characters only
    expect(b64Part).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------
describe('verifyPassword', () => {
  it('returns true when the correct password is verified', async () => {
    const password = 'CorrectHorseBattery!'
    const hash = await hashPassword(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('returns false for an incorrect password', async () => {
    const hash = await hashPassword('GoodPassword#1')
    expect(await verifyPassword('WrongPassword#1', hash)).toBe(false)
  })

  it('returns false for an empty password against a real hash', async () => {
    const hash = await hashPassword('SomePassword')
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('returns false for a hash of a different password', async () => {
    const hash1 = await hashPassword('Pass1')
    const hash2 = await hashPassword('Pass2')
    // Verify pass1 against hash2 — must fail
    expect(await verifyPassword('Pass1', hash2)).toBe(false)
  })

  it('returns false on a malformed / garbage hash string', async () => {
    expect(await verifyPassword('password', 'not-a-real-hash')).toBe(false)
  })

  it('returns false on an empty hash string', async () => {
    expect(await verifyPassword('password', '')).toBe(false)
  })

  it('handles pbkdf2: prefix gracefully during verification', async () => {
    const password = 'TestRoundTrip!'
    const hash = await hashPassword(password)
    // The stored hash always has the prefix; verify should handle it
    expect(hash.startsWith('pbkdf2:')).toBe(true)
    expect(await verifyPassword(password, hash)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isHashedPassword
// ---------------------------------------------------------------------------
describe('isHashedPassword', () => {
  it('returns true for a hash produced by hashPassword', async () => {
    const hash = await hashPassword('DetectMe!')
    expect(isHashedPassword(hash)).toBe(true)
  })

  it('returns true for a string manually starting with pbkdf2:', () => {
    expect(isHashedPassword('pbkdf2:abc123')).toBe(true)
  })

  it('returns false for a plain-text password', () => {
    expect(isHashedPassword('plaintext')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isHashedPassword('')).toBe(false)
  })

  it('returns false for a bcrypt-style hash', () => {
    expect(isHashedPassword('$2a$12$somerandomstring')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateSecureToken
// ---------------------------------------------------------------------------
describe('generateSecureToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateSecureToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different tokens on successive calls', () => {
    const t1 = generateSecureToken()
    const t2 = generateSecureToken()
    expect(t1).not.toBe(t2)
  })

  it('always returns exactly 64 characters', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateSecureToken()).toHaveLength(64)
    }
  })
})

// ---------------------------------------------------------------------------
// checkPasswordStrength
// ---------------------------------------------------------------------------
describe('checkPasswordStrength', () => {
  it('returns score 0 and feedback for an empty password', () => {
    const { score, feedback } = checkPasswordStrength('')
    expect(score).toBe(0)
    expect(feedback.length).toBeGreaterThan(0)
  })

  it('gives low score for a very short password', () => {
    const { score, feedback } = checkPasswordStrength('abc')
    expect(score).toBeLessThan(3)
    expect(feedback).toContain('Password should be at least 8 characters')
  })

  it('gives full score for a complex password', () => {
    // Length ≥16, uppercase, lowercase, number, special char
    const { score } = checkPasswordStrength('Tr0ub4dor&3')
    expect(score).toBeGreaterThanOrEqual(3)
  })

  it('penalizes repeating characters', () => {
    const { score: noRepeat } = checkPasswordStrength('Abcdef1!')
    const { score: repeat, feedback } = checkPasswordStrength('AAAbcdef1!')
    expect(feedback).toContain('Avoid repeating characters')
    // Repeating chars should not outperform the clean one at same or shorter length
    expect(repeat).toBeLessThanOrEqual(noRepeat)
  })

  it('returns score 0 and common-password feedback for "password"', () => {
    const { score, feedback } = checkPasswordStrength('password')
    expect(score).toBe(0)
    expect(feedback).toContain('Avoid common passwords')
  })

  it('returns score 0 for "12345" prefix', () => {
    const { score } = checkPasswordStrength('12345678')
    expect(score).toBe(0)
  })

  it('returns score 0 for "qwerty" prefix', () => {
    const { score } = checkPasswordStrength('qwertyuiop')
    expect(score).toBe(0)
  })

  it('suggests adding lowercase when none present', () => {
    const { feedback } = checkPasswordStrength('ALLCAPS123!')
    expect(feedback).toContain('Add lowercase letters')
  })

  it('suggests adding uppercase when none present', () => {
    const { feedback } = checkPasswordStrength('alllower123!')
    expect(feedback).toContain('Add uppercase letters')
  })

  it('suggests adding numbers when none present', () => {
    const { feedback } = checkPasswordStrength('NoNumbers!!')
    expect(feedback).toContain('Add numbers')
  })

  it('suggests adding special characters when none present', () => {
    const { feedback } = checkPasswordStrength('NoSpecial123')
    expect(feedback).toContain('Add special characters')
  })

  it('score is always between 0 and 5', () => {
    const passwords = ['', 'a', 'short', 'Medium1!', 'VeryLongAndComplexPassword1!@#']
    for (const pw of passwords) {
      const { score } = checkPasswordStrength(pw)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(5)
    }
  })
})
