import type { User } from '@shared/types';

/**
 * Checks if a user's profile is complete enough to access their portal.
 * Requires a first+last name and a non-empty bio.
 *
 * Name can come from either:
 *  - user.name (combined "First Last" string)
 *  - user.firstName + user.lastName (separate fields)
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;

  // Check name: either firstName+lastName or a two-part name string
  const hasFirstLast = !!(user.firstName?.trim() && user.lastName?.trim());
  const nameParts = (user.name || '').trim().split(/\s+/);
  const hasFullName = hasFirstLast || (nameParts.length >= 2 && nameParts[0].length > 0 && nameParts[1].length > 0);

  const hasBio = (user.bio || '').trim().length > 0;

  return hasFullName && hasBio;
}
