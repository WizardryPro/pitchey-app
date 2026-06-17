import { describe, it, expect } from 'vitest';
import { isProfileComplete } from '../profileCompleteness';
import type { User } from '@shared/types';

// Minimal valid user object
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    userType: 'creator',
    bio: 'A solid bio.',
    firstName: 'Jane',
    lastName: 'Doe',
    verified: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('isProfileComplete', () => {
  // ─── null / undefined ────────────────────────────────────────────────
  it('returns false for null', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  // ─── complete profiles ───────────────────────────────────────────────
  it('returns true when firstName + lastName + bio are present', () => {
    expect(isProfileComplete(makeUser())).toBe(true);
  });

  it('returns true when combined name string has two parts and bio is present', () => {
    const user = makeUser({ firstName: undefined, lastName: undefined, name: 'Jane Doe' });
    expect(isProfileComplete(user)).toBe(true);
  });

  it('returns true when combined name has more than two parts', () => {
    const user = makeUser({ firstName: undefined, lastName: undefined, name: 'Jane Marie Doe' });
    expect(isProfileComplete(user)).toBe(true);
  });

  // ─── missing bio ─────────────────────────────────────────────────────
  it('returns false when bio is empty string', () => {
    expect(isProfileComplete(makeUser({ bio: '' }))).toBe(false);
  });

  it('returns false when bio is whitespace only', () => {
    expect(isProfileComplete(makeUser({ bio: '   ' }))).toBe(false);
  });

  it('returns false when bio is undefined', () => {
    expect(isProfileComplete(makeUser({ bio: undefined }))).toBe(false);
  });

  // ─── missing name ────────────────────────────────────────────────────
  it('returns false when firstName is missing and no combined name', () => {
    const user = makeUser({ firstName: undefined, name: undefined });
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when lastName is missing and no combined name', () => {
    const user = makeUser({ lastName: undefined, name: undefined });
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when firstName is whitespace', () => {
    const user = makeUser({ firstName: '   ', name: undefined });
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when lastName is whitespace', () => {
    const user = makeUser({ lastName: '   ', name: undefined });
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when combined name has only one word', () => {
    const user = makeUser({ firstName: undefined, lastName: undefined, name: 'Jane' });
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when combined name is empty string', () => {
    const user = makeUser({ firstName: undefined, lastName: undefined, name: '' });
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when both name and firstName/lastName are absent', () => {
    const user = makeUser({ firstName: undefined, lastName: undefined, name: undefined });
    expect(isProfileComplete(user)).toBe(false);
  });

  // ─── firstName+lastName beats name string ────────────────────────────
  it('returns true when firstName+lastName present even if name is single word', () => {
    const user = makeUser({ firstName: 'Jane', lastName: 'Doe', name: 'Jane' });
    expect(isProfileComplete(user)).toBe(true);
  });

  // ─── edge: both missing ──────────────────────────────────────────────
  it('returns false when both name and bio are missing', () => {
    const user = makeUser({
      firstName: undefined,
      lastName: undefined,
      name: undefined,
      bio: undefined,
    });
    expect(isProfileComplete(user)).toBe(false);
  });
});
