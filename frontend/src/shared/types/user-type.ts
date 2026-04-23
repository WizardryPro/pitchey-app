// Canonical user-type shape, plus a normalizer for the viewer↔watcher drift.
//
// DB authority: the `users.user_type` column (with a CHECK constraint in
// `src/db/business-rules-enforcement.sql:425`) permits exactly:
//   'creator' | 'investor' | 'production' | 'viewer' | 'admin'
//
// UI authority: URL namespace (/watcher/*) and marketing label ("Watcher
// Portal") use `watcher`. Some handlers in src/worker-integrated.ts also
// branch on `userType === 'watcher'` for UI-facing logic, and some on
// `'viewer'` for DB-facing logic — the split is inconsistent.
//
// Until the fuller refactor (see the `project_viewer_watcher_drift` memory),
// every caller that narrows or switches on userType should route through
// `normalizeUserType()` so we only have one place to change when the
// canonical spelling is chosen.

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
