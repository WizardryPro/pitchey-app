// Canonical user-type shape, plus a normalizer for the viewer↔watcher drift.
//
// Conceptual model:
//   - "Watcher" is the user-type for the fourth portal.
//   - "Viewer" is a behavioral role — anyone viewing a pitch, regardless of
//     their user_type. They're different things.
//
// Current drift: the DB conflates them. `users.user_type` stores `'viewer'`
// for watcher-tier accounts (legacy), and a CHECK constraint in
// `src/db/business-rules-enforcement.sql:425` enforces that spelling. The
// future refactor direction is DB → `'watcher'`; until that lands, every
// frontend caller narrowing on userType routes through `normalizeUserType()`
// so UI code only knows the canonical `'watcher'` spelling.
//
// See project_viewer_watcher_drift memory for the full inventory.

export type UserTypeCanonical = 'creator' | 'investor' | 'production' | 'watcher' | 'admin';

/**
 * Fold any known spelling of a user type to its canonical frontend form.
 * - 'viewer' (DB spelling) → 'watcher' (UI spelling)
 * - anything unrecognised → null
 *
 * Consumers that need the DB spelling (building a query, calling an endpoint
 * that expects the legacy value) should NOT call this — they should use the
 * raw backend value directly, and the refactor will rename those call sites.
 */
export function normalizeUserType(raw: string | null | undefined): UserTypeCanonical | null {
  if (!raw) return null;
  switch (raw) {
    case 'creator':
    case 'investor':
    case 'production':
    case 'admin':
      return raw;
    case 'watcher':
    case 'viewer':
      return 'watcher';
    default:
      return null;
  }
}
